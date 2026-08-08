import {
  ChartCard,
  KPICard,
  PageHeader,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import withDataset from "@/components/withDataset";

const CHART_COLORS = [
  "oklch(0.68 0.14 220)",
  "oklch(0.78 0.14 75)",
  "oklch(0.65 0.16 155)",
  "oklch(0.62 0.19 25)",
  "oklch(0.55 0.1 280)",
];

type Row = Record<string, unknown>;

function OverviewPage({ results }: { results: any; uploadCsv?: any }) {
  const { downloadReport } = useAnalysis();
  const kpis = results.kpis as any;
  const trend = results.trend_series as Row[];
  const pareto = (results.overview?.pareto as Row[]) ?? [];
  const heatmap = (results.overview?.heatmap as Row[]) ?? [];
  const batchRaw = results.overview?.batch;
  const batch = Array.isArray(batchRaw) ? batchRaw : (batchRaw?.batches ?? []) as Row[];

  const top30 = trend.slice(-30);
  const maxShift = (kpis?.highest_risk_shift as string | undefined) ?? "—";
  const maxMachine = (kpis?.highest_risk_machine as string | undefined) ?? "—";

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Executive Overview"
        subtitle="Quality inspection performance across the 90-day window. Click any item to investigate; every finding is an association, not a cause."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total inspections"
          value={kpis?.total_inspections?.toLocaleString()}
          sub={kpis?.total_defects !== undefined ? `${Number(kpis.total_defects).toLocaleString()} defects recorded` : "records"}
        />
        <KPICard
          label="Overall defect rate"
          value={`${kpis?.defect_rate_pct?.toFixed(2)}%`}
          sub={kpis?.delta_pp_30d !== undefined && kpis.delta_pp_30d !== null
            ? `${kpis.delta_pp_30d > 0 ? "+" : ""}${kpis.delta_pp_30d.toFixed(2)} pp vs. prior 30d`
            : "last 30 days"}
          tone={kpis?.delta_pp_30d > 0 ? "down" : "up"}
          accent
        />
        <KPICard
          label="Highest-risk machine"
          value={maxMachine}
          sub={kpis?.highest_risk_machine_rate_pct !== undefined ? `defect rate ${Number(kpis.highest_risk_machine_rate_pct).toFixed(2)}%` : ""}
          tone="down"
        />
        <KPICard
          label="Highest-risk shift"
          value={maxShift}
          sub={kpis?.highest_risk_shift_rate_pct !== undefined ? `defect rate ${Number(kpis.highest_risk_shift_rate_pct).toFixed(2)}%` : ""}
          tone="down"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="30-day defect rate trend"
          sub="Rolling view of the trailing month"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={top30} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.68 0.14 220)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="oklch(0.68 0.14 220)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Defect rate"]}
              />
              <Area
                type="monotone"
                dataKey="defect_rate_pct"
                stroke="oklch(0.68 0.14 220)"
                strokeWidth={2}
                fill="url(#trendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top-5 defect types</CardTitle>
            <p className="text-xs text-muted-foreground">Pareto — share of all defects</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pareto} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="defect_type"
                  tick={{ fontSize: 11, fill: "oklch(0.85 0.01 220)" }}
                  width={92}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, _n, item) => [`${Number(v).toFixed(1)}% of defects`, String(item?.payload?.defect_type)]}
                />
                <Bar dataKey="pct" fill="oklch(0.68 0.14 220)" radius={[0, 4, 4, 0]} barSize={22}>
                  {pareto.map((_: Row, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <ChartCard title="Machine × Shift defect rate heatmap (%)" sub="Cells colored by defect rate — darker means higher" className="mt-6">
        {heatmap.length ? (
          <HeatmapGrid heatmap={heatmap} />
        ) : (
          <p className="text-sm text-muted-foreground">No heatmap data</p>
        )}
      </ChartCard>

      <div className="mt-6">
        <ChartCard title="Batch-level defect rates" sub="Flagged batches are candidates for lot investigation">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Defects</TableHead>
                <TableHead className="text-right">Defect rate</TableHead>
                <TableHead className="text-right">Global rate</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.map((b: Row) => (
                <TableRow key={String(b.batch_id)}>
                  <TableCell className="font-data font-medium">{String(b.batch_id)}</TableCell>
                  <TableCell className="text-right font-data">{Number(b.units_inspected)?.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-data">{Number(b.defect_count)?.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-data">
                    {(Number(b.defect_rate_pct) * 1).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-data text-muted-foreground">
                    {Number(kpis?.defect_rate_pct).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {b.flagged ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Flagged
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Within limits</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartCard>
      </div>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

function HeatmapGrid({ heatmap }: { heatmap: Row[] }) {
  const machines = Array.from(new Set(heatmap.map((h) => String(h.machine_id)))).sort();
  const shifts = Array.from(new Set(heatmap.map((h) => String(h.shift)))).sort();
  const rates: Record<string, number> = {};
  let min = Infinity;
  let max = -Infinity;
  for (const h of heatmap) {
    rates[`${h.machine_id}:${h.shift}`] = Number(h.defect_rate_pct);
  }
  for (const v of Object.values(rates)) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[480px]">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `84px repeat(${shifts.length}, minmax(110px, 1fr))` }}>
          <div />
          {shifts.map((s) => (
            <div key={s} className="text-center text-xs font-medium text-muted-foreground">
              Shift {String(s)}
            </div>
          ))}
          {machines.map((m) => (
            <>
              <div key={`l-${m}`} className="flex items-center text-xs font-data text-muted-foreground">
                {m}
              </div>
              {shifts.map((s) => {
                const rate = rates[`${m}:${s}`] ?? 0;
                const t = max > min ? (rate - min) / (max - min) : 0;
                return (
                  <div
                    key={`${m}:${s}`}
                    className="flex flex-col items-center justify-center rounded-md px-2 py-2.5 transition-opacity hover:opacity-80"
                    style={{ background: `color-mix(in oklch, oklch(0.68 0.14 220) ${Math.round(t * 55)}%, oklch(0.26 0.015 240))` }}
                  >
                    <span className="font-data text-xs font-semibold">{rate.toFixed(2)}%</span>
                    <span className="text-[10px] text-muted-foreground">{t > 0.7 ? "elevated" : ""}</span>
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

export default withDataset(OverviewPage);
