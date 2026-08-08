import {
  ChartCard,
  PageHeader,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, CircleDot } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import withDataset from "@/components/withDataset";

type Row = Record<string, unknown>;

function AnomalyDetectionPage({ results }: { results: any; uploadCsv?: any }) {
  const trend = (results.trend_series as Row[]) ?? [];
  const changePoints = (results.change_points as Row[]) ?? [];
  const beforeAfter = (results.before_after ?? {}) as Record<string, any>;

  const globalBA = {
    before_rate_pct: Number(beforeAfter.before?.defect_rate ?? NaN) * 100,
    after_rate_pct: Number(beforeAfter.after?.defect_rate ?? NaN) * 100,
    lift: Number(beforeAfter.after?.defect_rate ?? 0) / Math.max(Number(beforeAfter.before?.defect_rate ?? 1), 1e-9),
    abs_change_pp: beforeAfter.absolute_change_pp,
    rel_change_pct: beforeAfter.relative_change_pct,
  } as Record<string, any>;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Anomaly &amp; Change Detection"
        subtitle="Rolling z-score and CUSUM analysis over daily defect rates, with exact change-point dates marked on the control chart."
      />

      <ChartCard
        title="Control chart — daily defect rate"
        sub="Vertical markers indicate detected change points. Hover for details."
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.66 0.02 220)" }} tickLine={false} interval="preserveStartEnd" minTickGap={44} />
            <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={44} />
            <Tooltip
              contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Defect rate"]}
            />
            <ReferenceLine
              y={Number.isFinite(globalBA?.before_rate_pct) ? globalBA.before_rate_pct : undefined}
              stroke="oklch(0.65 0.16 155 / 60%)"
              strokeDasharray="4 4"
              label={Number.isFinite(globalBA?.before_rate_pct) ? { value: `Baseline ${globalBA.before_rate_pct.toFixed(2)}%`, position: "insideTopLeft", fontSize: 10, fill: "oklch(0.75 0.1 155)" } : undefined}
            />
            {changePoints.map((cp, i) => (
              <ReferenceLine
                key={i}
                x={String(cp.date)}
                stroke="oklch(0.72 0.17 65 / 80%)"
                strokeDasharray="2 2"
                label={{
                  value: String(cp.label ?? cp.date),
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "oklch(0.8 0.12 75)",
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="defect_rate_pct"
              stroke="oklch(0.68 0.14 220)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-2">
          {changePoints.length ? (
            changePoints.map((cp, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                <CircleDot className="h-3 w-3" />
                {String(cp.label ?? cp.date)}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No change points detected in this window.</span>
          )}
        </div>
      </ChartCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Number.isFinite(globalBA.before_rate_pct) ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Global before / after</CardTitle>
              <p className="text-xs text-muted-foreground">
                Split at the strongest detected change point
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <BeforeAfterCell label="Before" value={globalBA.before_rate_pct} />
                <BeforeAfterCell label="After" value={globalBA.after_rate_pct} />
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lift</p>
                  <p className="mt-1 font-data text-lg font-semibold">
                    {Number(globalBA.abs_change_pp)?.toFixed(2)} pp · +{Number(globalBA.rel_change_pct)?.toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Detected change points</CardTitle>
            <p className="text-xs text-muted-foreground">
              Z-score peaks and CUSUM crossings across the window
            </p>
          </CardHeader>
          <CardContent>
            {changePoints.length ? (
              <ul className="space-y-2">
                {changePoints.map((cp, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
                    {String(cp.direction ?? cp.label ?? "") === "up" ? (
                      <ArrowUp className="h-4 w-4 text-red-400" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-emerald-400" />
                    )}
                    <span className="font-data text-sm font-medium">{String(cp.label ?? cp.date)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {Number(cp.before_rate)?.toFixed(2)}% → {Number(cp.after_rate)?.toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No change points detected.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {beforeAfter.per_group ? (
        <ChartCard
          title="Per-machine before / after"
          sub="Defect-rate lift at the change point, per machine"
          className="mt-4"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Machine</th>
                  <th className="px-3 py-2 text-right">Before</th>
                  <th className="px-3 py-2 text-right">After</th>
                  <th className="px-3 py-2 text-right">Lift</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(beforeAfter.per_group as Record<string, Row>).map(
                  ([machine_id, m]: [string, Row]) => (
                    <tr key={machine_id} className="border-b border-border/50">
                      <td className="px-3 py-2 font-data font-medium">{machine_id}</td>
                      <td className="px-3 py-2 text-right font-data">{Number(m.before_rate)?.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-data">{Number(m.after_rate)?.toFixed(2)}%</td>
                      <td className={`px-3 py-2 text-right font-data ${Number(m.lift) > 1 ? "text-red-400" : "text-emerald-400"}`}>
                        {Number(m.lift)?.toFixed(2)}×
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

function BeforeAfterCell({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-lg font-semibold">
        {value !== null && value !== undefined ? `${Number(value).toFixed(2)}%` : "—"}
      </p>
    </div>
  );
}

export default withDataset(AnomalyDetectionPage);
