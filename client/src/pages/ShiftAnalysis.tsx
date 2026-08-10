import {
  ChartCard,
  PageHeader,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import withDataset from "@/components/withDataset";

const SHIFT_COLORS = ["oklch(0.68 0.14 220)", "oklch(0.78 0.14 75)", "oklch(0.65 0.16 155)"];

function ShiftAnalysisPage({ results }: { results: any; uploadCsv?: any }) {
  const kpis = (results.kpis ?? {}) as Record<string, any>;
  const overview = (results.overview ?? {}) as Record<string, any>;

  const shiftMap = (kpis.shift_comparison ?? {}) as Record<string, number>;
  const highest = kpis.highest_risk_shift ?? null;
  const shiftComparison = Object.entries(shiftMap)
    .sort((a, b) => b[1] - a[1])
    .map(([shift, defect_rate_pct]) => ({
      shift,
      defect_rate_pct: Number(defect_rate_pct),
      is_highest_risk: shift === highest,
    }));

  const shiftTrends = (overview.shift_trends ?? {}) as Record<string, { date: string; defect_rate_pct: number }[]>;
  const shifts = Object.keys(shiftTrends).sort();

  const series = Object.entries(shiftTrends).reduce<Record<string, any>[]>((acc, [s, rows]) => {
    (rows as { date: string; defect_rate_pct: number }[]).forEach((r) => {
      let row = acc.find((x) => x.date === r.date);
      if (!row) {
        row = { date: r.date };
        acc.push(row);
      }
      row[s] = r.defect_rate_pct;
    });
    return acc;
  }, []).sort((a, b) => (a.date > b.date ? 1 : -1));

  // shift_breakdown: [{shift, defect_type, defects, units, defect_rate_pct}]
  const breakdown = (overview.shift_breakdown as any[]) ?? [];
  const defectTypes = Array.from(new Set(breakdown.map((b) => String(b.defect_type)))).sort();
  const byShift = Object.values(
    breakdown.reduce<Record<string, { defects: number; units: number; top: Record<string, number>; shift: string }>>((acc, b) => {
      const key = String(b.shift);
      const entry = (acc[key] ??= { defects: 0, units: 0, top: {} as Record<string, number>, shift: key });
      entry.units += Number(b.units);
      entry.defects += Number(b.defects);
      entry.top[String(b.defect_type)] = (entry.top[String(b.defect_type)] ?? 0) + Number(b.defects);
      return acc;
    }, {}),
  );

  const daysSpan = kpis.days_span ?? 1;
  const dateRangeStr = kpis.date_range ? `${kpis.date_range[0]} to ${kpis.date_range[1]} (${daysSpan} days)` : "active dataset window";
  const shiftCiMap = (kpis.shift_ci ?? {}) as Record<string, { ci_lower: number; ci_upper: number }>;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Shift Analysis"
        subtitle={`Compare defect rates across shifts and review per-shift trends across the dataset window (${dateRangeStr}).`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Defect rate by shift" sub="Share of inspected units flagged defective">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={shiftComparison} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
              <XAxis dataKey="shift" tick={{ fontSize: 11, fill: "oklch(0.85 0.01 220)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Defect rate"]}
              />
              <Bar dataKey="defect_rate_pct" radius={[6, 6, 0, 0]} barSize={48} fill="oklch(0.78 0.14 75)" />
              {shiftComparison.map((_: any, i: number) => (
                <Cell key={i} fill={SHIFT_COLORS[i % SHIFT_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Per-shift trend (daily)" sub="Daily defect rate per shift">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.66 0.02 220)" }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: any) => [`${Number(v).toFixed(2)}%`, `Shift ${name}`]}
              />
              {shifts.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={SHIFT_COLORS[i % SHIFT_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => `Shift ${v}`} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-2">
            {shifts.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-5 rounded-sm" style={{ background: SHIFT_COLORS[i % SHIFT_COLORS.length] }} />
                Shift {s}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Shift × defect type mix" sub="Units inspected (n), defective units, 95% CI, and defect type distribution per shift">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2 text-right">Units (n)</th>
                <th className="px-3 py-2 text-right">Defects</th>
                <th className="px-3 py-2 text-right">Defect Rate</th>
                <th className="px-3 py-2 text-right">95% CI</th>
                {defectTypes.map((t) => (
                  <th key={t} className="px-3 py-2 text-right">{t}</th>
                ))}
                <th className="px-3 py-2 text-right">Top type</th>
              </tr>
            </thead>
            <tbody>
              {byShift.map((r) => {
                const topType = Object.entries(r.top).sort((a, b) => b[1] - a[1])[0];
                const ci = shiftCiMap[String(r.shift)];
                const rateVal = (100 * r.defects) / Math.max(r.units, 1);
                return (
                  <tr key={r.shift} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium">
                      Shift {r.shift}
                      {r.shift === highest ? (
                        <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-300">Highest risk</Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-data">{r.units?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-data">{r.defects?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-data">{rateVal.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-data text-muted-foreground">
                      {ci ? `${ci.ci_lower.toFixed(2)}%–${ci.ci_upper.toFixed(2)}%` : "—"}
                    </td>
                    {defectTypes.map((t) => (
                      <td key={t} className="px-3 py-2 text-right font-data">
                        {((100 * (r.top[t] ?? 0)) / Math.max(r.defects, 1)).toFixed(1)}%
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className="font-mono">{topType ? topType[0] : "—"}</Badge>
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

function ShiftBarCell({ i }: { i: number }) {
  return <rect fill={SHIFT_COLORS[i % SHIFT_COLORS.length]} />;
}

export default withDataset(ShiftAnalysisPage);
