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
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import withDataset from "@/components/withDataset";

const MACHINE_COLORS = [
  "oklch(0.68 0.14 220)",
  "oklch(0.78 0.14 75)",
  "oklch(0.65 0.16 155)",
  "oklch(0.62 0.19 25)",
  "oklch(0.55 0.1 280)",
];

function MachineAnalysisPage({ results }: { results: any; uploadCsv?: any }) {
  const kpis = (results.kpis ?? {}) as Record<string, any>;
  const overview = (results.overview ?? {}) as Record<string, any>;

  const machineMap = (kpis.machine_comparison ?? {}) as Record<string, number>;
  const highest = kpis.highest_risk_machine ?? null;
  const machineComparison = Object.entries(machineMap)
    .sort((a, b) => b[1] - a[1])
    .map(([machine_id, defect_rate_pct]) => ({
      machine_id,
      defect_rate_pct: Number(defect_rate_pct),
      is_highest_risk: machine_id === highest,
    }));

  const machineTrends = (overview.machine_trends ?? {}) as Record<string, { date: string; defect_rate_pct: number }[]>;
  const machines = Object.keys(machineTrends).sort();

  // Merge per-machine daily series into one array of rows keyed by date
  const series = Object.entries(machineTrends).reduce<Record<string, any>[]>((acc, [m, rows]) => {
    (rows as { date: string; defect_rate_pct: number }[]).forEach((r) => {
      let row = acc.find((x) => x.date === r.date);
      if (!row) {
        row = { date: r.date };
        acc.push(row);
      }
      row[m] = r.defect_rate_pct;
    });
    return acc;
  }, []).sort((a, b) => (a.date > b.date ? 1 : -1));

  // Breakdown by machine x defect type
  const breakdown = (overview.machine_breakdown as any[]) ?? [];
  const byMachine = Object.values(
    breakdown.reduce<Record<string, { units: number; defects: number; top: Record<string, number>; machine_id: string }>>((acc, b) => {
      const key = String(b.machine_id);
      const entry = (acc[key] ??= { units: 0, defects: 0, top: {} as Record<string, number>, machine_id: key });
      entry.units += Number(b.units);
      entry.defects += Number(b.defects);
      entry.top[String(b.defect_type)] = (entry.top[String(b.defect_type)] ?? 0) + Number(b.defects);
      return acc;
    }, {}),
  ).map((v) => {
    const topType = Object.entries(v.top).sort((a, b) => b[1] - a[1])[0];
    return { ...v, topType: topType ? topType[0] : "—" };
  });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Machine Analysis"
        subtitle="Compare defect rates across machines and inspect per-machine trends over the full 90-day window."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Defect rate by machine" sub="Share of inspected units flagged defective">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={machineComparison} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
              <XAxis dataKey="machine_id" tick={{ fontSize: 11, fill: "oklch(0.85 0.01 220)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Defect rate"]}
              />
              <Bar dataKey="defect_rate_pct" radius={[6, 6, 0, 0]} barSize={44}>
                {machineComparison.map((_: any, i: number) => (
                  <BarCell key={i} i={i} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Per-machine trend (daily)" sub="Daily defect rate per machine across the dataset window">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240 / 8%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.66 0.02 220)" }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: any) => [`${Number(v).toFixed(2)}%`, String(name)]}
              />
              {machines.map((m, i) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={MACHINE_COLORS[i % MACHINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-2">
            {machines.map((m, i) => (
              <span key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-5 rounded-sm" style={{ background: MACHINE_COLORS[i % MACHINE_COLORS.length] }} />
                {m}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Machine comparison summary" sub="Units, defects, defect rate, and top defect type per machine" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2 text-right">Units</th>
                <th className="px-3 py-2 text-right">Defects</th>
                <th className="px-3 py-2 text-right">Defect rate</th>
                <th className="px-3 py-2 text-right">Top defect type</th>
              </tr>
            </thead>
            <tbody>
              {byMachine.map((m) => (
                <tr key={m.machine_id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-data font-medium">{String(m.machine_id)}</td>
                  <td className="px-3 py-2 text-right font-data">{Number(m.units)?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-data">{Number(m.defects)?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-data">
                    {((100 * Number(m.defects)) / Number(m.units || 1)).toFixed(2)}%
                    {String(m.machine_id) === String(highest) ? (
                      <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-300">Highest risk</Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant="outline" className="font-mono">{m.topType}</Badge>
                  </td>
                </tr>
              ))}
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

function BarCell({ i }: { i: number }) {
  return <rect fill={MACHINE_COLORS[i % MACHINE_COLORS.length]} />;
}

export default withDataset(MachineAnalysisPage);
