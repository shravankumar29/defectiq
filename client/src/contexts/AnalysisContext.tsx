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
  downloadReport: (format: "pdf" | "csv") => Promise<void>;
};

const Ctx = createContext<AnalysisCtx | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  // Simple polling-free status query: enabled by default, refreshed after mutations.
  const statusQ = trpc.engine.status.useQuery(undefined, { refetchInterval: false });
  const status = (statusQ.data ?? null) as Status | null;

  const resultsQ = trpc.engine.results.useQuery(undefined, {
    staleTime: 5 * 60_000,
    enabled: Boolean(status?.loaded),
  });

  const generateMut = trpc.engine.generate.useMutation({
    onSuccess: async () => {
      await utils.engine.status.invalidate();
      await utils.engine.results.invalidate();
    },
  });

  const uploadMut = trpc.engine.upload.useMutation({
    onSuccess: async () => {
      await utils.engine.status.invalidate();
      await utils.engine.results.invalidate();
    },
  });

  async function downloadReport(format: "pdf" | "csv") {
    if (format === "pdf") {
      const data = (await utils.engine.reportPdf.fetch()) as unknown;
      const b64 = typeof data === "string" ? data : String(data ?? "");
      const blob = new Blob([new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)))], {
        type: "application/pdf",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `DefectIQ-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const csv = String(await utils.engine.reportCsv.fetch());
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `DefectIQ-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
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
      },
      uploadCsv: async (csvBase64: string) => {
        const res = (await uploadMut.mutateAsync({ csv_base64: csvBase64 })) as {
          rows: number;
          defect_rate_pct: number;
        };
        return res;
      },
      downloadReport,
    }),
    [status, statusQ, resultsQ, generateMut, uploadMut, downloadReport, utils]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysis(): AnalysisCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return ctx;
}
