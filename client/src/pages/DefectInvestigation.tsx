import {
  PageHeader,
  PriorityBadge,
  ScorePill,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import withDataset from "@/components/withDataset";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

type Row = Record<string, unknown>;

function DefectInvestigationPage({ results }: { results: any; uploadCsv?: any }) {
  const defectTypes = (results.defect_types as string[]) ?? [];
  const [type, setType] = useState(defectTypes[0] ?? "");

  const { data: invData, isLoading: invLoading } = trpc.engine.investigation.useQuery(
    { defect_type: type },
    { enabled: !!type, staleTime: Infinity }
  );
  const { data: patData } = trpc.engine.patterns.useQuery(undefined, { staleTime: Infinity });

  const contribution = (invData as any)?.contribution ?? {};
  const mi = (invData as any)?.mutual_information ?? {};
  const tree = (invData as any)?.decision_tree;
  const evidence = (patData as any)?.evidence ?? {};
  const patterns = (patData as any)?.patterns ?? [];

  const ranking = contribution?.factors ?? [];
  const miRanking = mi ?? [];

  const topFactors = useMemo(() => {
    const evs: any[] = [];
    for (const p of patterns) {
      if (String(p.defect_type) !== type) continue;
      const ev = evidence[String(p.pattern_id)];
      if (ev) evs.push({ ...p, ev });
    }
    evs.sort((a, b) => Number(b.pattern_score) - Number(a.pattern_score));
    return evs.slice(0, 4);
  }, [type, ranking, patterns, evidence]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Defect Investigation"
        subtitle="Contribution ranking, mutual information, and a depth-limited decision tree per defect type — tools to prioritize which factor combinations deserve root-cause investigation."
      />

      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Defect type</label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {defectTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {invLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {tree ? (
          <span className="text-xs text-muted-foreground">
            Decision tree: max depth {Number(tree?.max_depth ?? 3)} · {Number((tree?.top_splits as any[])?.length ?? 0)} top splits
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Contribution ranking</CardTitle>
            <p className="text-xs text-muted-foreground">
              Lift and chi-square association for each factor value — ranked by lift.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Lift</TableHead>
                  <TableHead className="text-right">p-value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.length ? (
                  ranking.slice(0, 12).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{String(r.factor)}</TableCell>
                      <TableCell className="font-data text-xs font-medium">{String(r.factor_value)}</TableCell>
                      <TableCell className="text-right font-data">{Number(r.lift)?.toFixed(2)}×</TableCell>
                      <TableCell className="text-right font-data">
                        {r.p_value === null || r.p_value === undefined ? "—" : Number(r.p_value) < 0.001 ? "<.001" : Number(r.p_value).toFixed(3)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No contribution data for this type
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mutual information ranking</CardTitle>
            <p className="text-xs text-muted-foreground">
              Global dependence of each factor on the defect outcome (normalized 0–1).
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {miRanking.length ? (
                miRanking.slice(0, 8).map((r, i) => (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-data text-xs">{String(r.factor)}</span>
                      <span className="font-data text-xs text-muted-foreground">
                        {Number(r.mutual_information) >= 0 ? Number(r.mutual_information).toFixed(3) : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, Number(r.mutual_information ?? 0)) * 100 * 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground">No MI data for this type</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {tree?.top_splits ? (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Decision-tree splits (max depth 3)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Top splits learned on this defect type — strongest factor/value conditions first.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {(tree.top_splits as Row[]).slice(0, 6).map((s, i) => {
                const impVal = Number(s.importance_pct ?? (Number(s.importance) * 100));
                return (
                  <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">
                        Split {i + 1}
                      </Badge>
                      <span className="font-data text-xs text-muted-foreground">
                        importance {impVal.toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-2 font-data text-sm font-medium">{String(s.feature)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      threshold: {Number(s.threshold)?.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">Highest-confidence associations</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {topFactors.map((p) => (
            <Card key={String(p.pattern_id)} className="border-border/70">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{String(p.description ?? (p.ev as any)?.finding ?? "")}</p>
                  <ScorePill score={Number(p.pattern_score ?? 0)} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {String((p.ev as any)?.finding ?? "No detailed evidence available.")}
                </p>
                {((p.ev as any)?.recommendation) ? (
                  <div className="mt-3">
                    <PriorityBadge priority={(p.ev as any).recommendation.priority} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

export default withDataset(DefectInvestigationPage);
