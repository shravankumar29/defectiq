import { SchemaMappingModal } from "@/components/SchemaMappingModal";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { AlertTriangle, FileUp, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

/**
 * Landing state when no dataset is loaded: generate the synthetic dataset or
 * upload your own CSV/XLSX inspection log.
 */
export default function DataIngestion() {
  const { generate, previewUpload, confirmUpload, status, results } = useAnalysis();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingBase64, setPendingBase64] = useState<string>("");
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const dq = results?.data_quality;

  useEffect(() => {
    if (status?.loaded === true) navigate("/app", { replace: true });
  }, [status?.loaded, navigate]);

  async function onGenerate() {
    setBusy(true);
    try {
      await generate();
      toast.success("Synthetic dataset generated and analyzed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      toast.error("Please upload a .csv or .xlsx file");
      return;
    }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = reader.result as string;
          resolve(raw.includes(",") ? raw.split(",")[1] : raw);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const analysis = await previewUpload(base64);
      setPendingBase64(base64);
      setPendingFileName(file.name);
      setAnalysisResult(analysis);
      setModalOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schema analysis failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirmMappings(userMappings: Record<string, string | null>) {
    if (!pendingBase64) return;
    setBusy(true);
    try {
      const res = await confirmUpload(pendingBase64, userMappings);
      toast.success(`Successfully mapped and analyzed ${res.rows.toLocaleString()} rows`);
      setModalOpen(false);
      setPendingBase64("");
      setAnalysisResult(null);
      navigate("/app");

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis confirmation failed");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="p-6 lg:p-8">
      {status?.loaded === true ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Dataset loaded</h2>
            <span className="rounded bg-secondary px-2 py-0.5 font-data text-xs">
              {status.rows?.toLocaleString()} rows
            </span>
            <span className="font-data text-xs text-muted-foreground">
              defect rate {status.defect_rate_pct?.toFixed(2)}%
            </span>
          </div>

          {dq ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-emerald-300">
                  Data Validation Layer — Ingestion Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> records loaded: <strong>{dq.records_loaded?.toLocaleString()}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> valid records: <strong>{dq.valid_records_retained?.toLocaleString()}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> columns recognized: <strong>{dq.columns_recognized}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> missing values: <strong>{dq.missing_values}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> duplicate records: <strong>{dq.duplicate_records}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> invalid dates: <strong>{dq.invalid_dates}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> invalid numerics: <strong>{dq.invalid_numeric_values}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> machines: <strong>{dq.detected_machines?.join(", ")}</strong></div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> shifts: <strong>{dq.detected_shifts?.join(", ")}</strong></div>
                </div>
                <div className="border-t border-border/50 pt-2 text-muted-foreground">
                  ✓ detected defect categories: <span className="font-data text-foreground">{dq.detected_defect_categories?.join(", ")}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Load a different dataset</CardTitle>
              <CardDescription>
                Generate fresh synthetic plant data or upload your own inspection log (CSV/XLSX).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={onGenerate} disabled={busy}>
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Generate synthetic dataset
              </Button>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={onFile}
                disabled={busy}
                className="max-w-xs"
              />
            </CardContent>
          </Card>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            Synthetic data is for demonstration and training only; patterns reflect embedded
            correlations, not proven causes.
          </p>
        </div>
      ) : (
        <AnalysisEmptyPage onGenerate={onGenerate} busy={busy} onChooseFile={() => fileRef.current?.click()} />
      )}
      <Input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} disabled={busy} />
      <SchemaMappingModal
        open={modalOpen}
        fileName={pendingFileName}
        analysis={analysisResult}
        onConfirm={handleConfirmMappings}
        onCancel={() => {
          setModalOpen(false);
          setPendingBase64("");
          setAnalysisResult(null);
        }}
        isSubmitting={busy}
      />
    </div>
  );
}


function AnalysisEmptyPage({
  onGenerate,
  busy,
  onChooseFile,
}: {
  onGenerate: () => void;
  busy: boolean;
  onChooseFile: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-3xl">
      <div className="mb-8 text-center">
        <p className="font-data text-xs uppercase tracking-widest text-primary">Defect Intelligence Platform</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Defect<span className="text-primary">IQ</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Explore defect patterns, detect process changes, and generate prioritized investigation
          recommendations from quality-inspection data. All findings reflect statistical association,
          not proven causation.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate synthetic dataset</CardTitle>
            <CardDescription>
              20,000 inspection records over 90 days — 5 machines, 3 shifts, 40 batches, 4 defect types,
              with embedded process patterns for hands-on exploration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onGenerate} disabled={busy} className="w-full">
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Generate &amp; analyze
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload your own data</CardTitle>
            <CardDescription>
              CSV/XLSX inspection log with columns: timestamp, machine_id, shift, batch_id,
              defect_type, units_inspected, defect_count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={onChooseFile} className="w-full">
              <FileUp className="h-4 w-4" />
              Choose file…
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
