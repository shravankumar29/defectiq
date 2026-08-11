import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import type { TRPCClientErrorLike } from "@trpc/client";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

type Status = { loaded: boolean; rows?: number; busy?: boolean; defect_rate_pct?: number | null };

type AnalysisCtx = {
  status: Status | null;
  statusLoading: boolean;
  results: any | null;
  resultsLoading: boolean;
  resultsError: TRPCClientErrorLike<AppRouter> | null;
  generate: () => Promise<void>;
  uploadCsv: (csvBase64: string) => Promise<{ rows: number; defect_rate_pct: number }>;
  previewUpload: (csvBase64: string) => Promise<any>;
  confirmUpload: (csvBase64: string, userMappings: Record<string, string | null>) => Promise<{ rows: number; defect_rate_pct: number }>;
  downloadReport: (format: "pdf" | "csv") => Promise<void>;
  copilot: {
    ask: (question: string) => Promise<{ answer: string; sources_used?: string[] }>;
    busy: boolean;
  };
};


const Ctx = createContext<AnalysisCtx | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  // Simple polling-free status query: enabled by default, refreshed after mutations.
  const statusQ = trpc.engine.status.useQuery(undefined, { refetchInterval: false, staleTime: 0 });
  const status = (statusQ.data ?? null) as Status | null;

  const resultsQ = trpc.engine.results.useQuery(undefined, {
    staleTime: 0,
    enabled: Boolean(status?.loaded),
  });

  const generateMut = trpc.engine.generate.useMutation({
    onSuccess: async () => {
      await utils.engine.status.invalidate();
      await utils.engine.results.invalidate();
      await utils.engine.results.refetch();
    },
  });



  const uploadMut = trpc.engine.upload.useMutation({
    onSuccess: async () => {
      await utils.engine.status.invalidate();
      await utils.engine.results.invalidate();
      await utils.engine.results.refetch();
    },
  });

  const previewUploadMut = trpc.engine.previewUpload.useMutation();

  const confirmUploadMut = trpc.engine.confirmUpload.useMutation({
    onSuccess: async () => {
      await utils.engine.status.invalidate();
      await utils.engine.results.invalidate();
      await utils.engine.results.refetch();
    },
  });


  async function downloadReport(format: "pdf" | "csv") {
    const fn = (resultsQ.data as any)?.filename ? String((resultsQ.data as any).filename).replace(/[^a-zA-Z0-9_-]/g, "_") : "Dataset";
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === "pdf") {
      const data = (await utils.engine.reportPdf.fetch()) as unknown;
      let b64 = typeof data === "string" ? data : String(data ?? "");
      b64 = b64.replace(/^"|"$/g, "").trim();
      const binaryString = window.atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DefectIQ_Report_${fn}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const csv = String(await utils.engine.reportCsv.fetch());
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DefectIQ_Report_${fn}_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  const value = useMemo<AnalysisCtx>(
    () => ({
      status,
      statusLoading: statusQ.isLoading,
      results: resultsQ.data ?? null,
      resultsLoading: resultsQ.isLoading,
      resultsError: resultsQ.error ?? null,
      generate: async () => {
        await generateMut.mutateAsync();
        await utils.engine.status.invalidate();
        await utils.engine.results.refetch();
      },
      uploadCsv: async (csvBase64: string) => {
        const res = (await uploadMut.mutateAsync({ csv_base64: csvBase64 })) as {
          rows: number;
          defect_rate_pct: number;
        };
        await utils.engine.status.invalidate();
        await utils.engine.results.refetch();
        return res;
      },
      previewUpload: async (csvBase64: string) => {
        return await previewUploadMut.mutateAsync({ csv_base64: csvBase64 });
      },
      confirmUpload: async (csvBase64: string, userMappings: Record<string, string | null>) => {
        const res = (await confirmUploadMut.mutateAsync({
          csv_base64: csvBase64,
          user_mappings: userMappings,
        })) as { rows: number; defect_rate_pct: number };
        await utils.engine.status.invalidate();
        await utils.engine.results.refetch();
        return res;
      },
      downloadReport,


    }),
    [status, statusQ, resultsQ, generateMut, uploadMut, downloadReport, utils]
  );

  // We can inject copilot directly without useMemo dependency since it's just a fetch
  value.copilot = {
    ask: async (question: string) => {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", text: question }] })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch copilot response");
      }
      return {
        answer: String(data.answer ?? "No answer available."),
        sources_used: Array.isArray(data.sources) ? data.sources : [],
      };
    },
    busy: false,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysis(): AnalysisCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return ctx;
}
