import { AnalysisEmpty } from "@/components/analysis";
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
  const { generate, uploadCsv, status } = useAnalysis();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status?.loaded === true) navigate("/", { replace: true });
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
      await uploadCsv(base64);
      toast.success(`Uploaded and analyzed ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
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
