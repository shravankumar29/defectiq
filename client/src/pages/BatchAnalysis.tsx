import {
  ChartCard,
  PageHeader,
  StatRow,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import withDataset from "@/components/withDataset";

type Row = Record<string, unknown>;

function BatchAnalysisPage({ results }: { results: any; uploadCsv?: any }) {
  const kpis = (results.kpis ?? {}) as Record<string, any>;
  const batchInfo = (results.overview?.batch ?? {}) as Record<string, any>;
  const batch = (batchInfo.batches as any[]) ?? [];
  const global = Number(batchInfo.global_rate_pct ?? kpis.defect_rate_pct ?? 0);
  const flagged = batch.filter((b) => Number(b.flagged) === 1);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Batch Analysis"
        subtitle="Per-batch defect rates against the plant-wide baseline. Flagged batches exceed the global defect rate materially and are candidates for lot-level investigation."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <ChartCard title="Batches" sub="">
          <StatRow icon={Package} label="Total batches" value={batch.length} highlight />
          <div className="mt-2" />
          <StatRow icon={Package} label="Flagged" value={flagged.length} highlight />
        </ChartCard>
        <ChartCard title="Global baseline" sub="Plant-wide defect rate">
          <StatRow icon={Package} label="Rate" value={`${global.toFixed(2)}%`} highlight />
        </ChartCard>
      </div>

      <ChartCard
        title="Batch-level defect rates"
        sub="Rows shaded amber are flagged above baseline"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2 text-right">Units Inspected (n)</th>
                <th className="px-3 py-2 text-right">Defective Units</th>
                <th className="px-3 py-2 text-right">Defect rate</th>
                <th className="px-3 py-2 text-right">vs. baseline</th>
                <th className="px-3 py-2 text-right">Date Range</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((b: Row) => {
                const delta = Number(b.defect_rate_pct) - global;
                return (
                  <tr
                    key={String(b.batch_id)}
                    className={Number(b.flagged) === 1 ? "bg-amber-500/8" : "border-b border-border/50"}
                  >
                    <td className="px-3 py-2 font-data font-medium">{String(b.batch_id)}</td>
                    <td className="px-3 py-2 text-right font-data">{Number(b.units)?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-data">{Number(b.defects)?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-data">{Number(b.defect_rate_pct)?.toFixed(2)}%</td>
                    <td className={`px-3 py-2 text-right font-data ${delta > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)} pp
                    </td>
                    <td className="px-3 py-2 text-right font-data text-muted-foreground text-xs whitespace-nowrap">
                      {String(b.date_range ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(b.flagged) === 1 ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300">Flagged</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Within limits</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

export default withDataset(BatchAnalysisPage);
