import { PageHeader } from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { AlertTriangle, FileDown, FileText, Table, Activity, Layers, Factory, Clock3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import withDataset from "@/components/withDataset";

function ReportsPage({ results: _results }: { results: any; uploadCsv?: any }) {
  const { downloadReport, results } = useAnalysis();
  const recs = ((results as any)?.recommendations ?? []) as any[];
  const kpis = ((results as any)?.kpis ?? {}) as any;
  const summary = [
    recs.length
      ? recs
          .slice(0, 3)
          .map(
            (r) =>
              `[${(r.priority_label ?? r.priority ?? "Low").replace(/[🔴🟠🟡🟢]/g, "").trim()}] ${r.text ?? r.recommendation ?? r.title ?? ""}`,
          )
          .join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const overviewKpis = {
    inspections: kpis.total_inspections ?? kpis.inspections,
    defectRate: kpis.defect_rate_pct,
    topMachine: kpis.highest_risk_machine,
    topShift: kpis.highest_risk_shift,
  };
  const [loading, setLoading] = useState(false);

  async function onDownload(format: "pdf" | "csv") {
    try {
      setLoading(true);
      await downloadReport(format);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Report Export"
        subtitle="One-click export of the full investigation: executive summary, detected patterns, machine/shift/batch analysis, anomalies, and recommended actions. Every report includes the mandatory correlation-vs-causation disclaimer."
      />

      <div className="mb-6 flex gap-3">
        <Button onClick={() => onDownload("pdf")} disabled={loading}>
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
        <Button variant="outline" onClick={() => onDownload("csv")} disabled={loading}>
          <Table className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Preview — executive summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : summary ? (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><Activity className="h-3 w-3" /> Inspections</div>
                  <p className="mt-1 font-data text-lg font-semibold">{Number(overviewKpis.inspections)?.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><Layers className="h-3 w-3" /> Defect rate</div>
                  <p className="mt-1 font-data text-lg font-semibold">{Number(overviewKpis.defectRate)?.toFixed(2)}%</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><Factory className="h-3 w-3" /> Highest-risk machine</div>
                  <p className="mt-1 font-data text-lg font-semibold">{String(overviewKpis.topMachine ?? "—")}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3 w-3" /> Highest-risk shift</div>
                  <p className="mt-1 font-data text-lg font-semibold">{String(overviewKpis.topShift ?? "—")}</p>
                </div>
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top recommended actions</p>
              <p className="max-h-64 whitespace-pre-line overflow-y-auto text-sm leading-relaxed text-muted-foreground">
                {summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate the report to preview the summary here.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="font-semibold">Correlation is not causation.</strong> All content in
          exported reports — summaries, patterns, anomalies, and recommendations — describes
          statistical associations found in inspection data. Associations must be validated through
          targeted experiments before any causal claim or process change is justified.
        </p>
      </div>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

export default withDataset(ReportsPage);
