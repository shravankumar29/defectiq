import {
  ChartCard,
  PageHeader,
  StatRow,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import withDataset from "@/components/withDataset";

const CLUSTER_COLORS = [
  "oklch(0.68 0.14 220)",
  "oklch(0.78 0.14 75)",
  "oklch(0.65 0.16 155)",
  "oklch(0.62 0.19 25)",
  "oklch(0.55 0.1 280)",
];

type Row = Record<string, unknown>;

function ClusterScatter({ scatter }: { scatter: Row[] }) {
  const clusters = Array.from(new Set(scatter.map((p) => Number(p.cluster)))).filter((c) => Number.isFinite(c)).sort();
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 8, right: 8, left: -24, bottom: 4 }}>
        <XAxis type="number" dataKey="pc1" name="PC1" tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} label={{ value: "PC1", position: "insideBottom", fontSize: 11, fill: "oklch(0.6 0.02 220)" }} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={{ fontSize: 11, fill: "oklch(0.66 0.02 220)" }} tickLine={false} label={{ value: "PC2", angle: -90, position: "insideLeft", fontSize: 11, fill: "oklch(0.6 0.02 220)" }} />
        <ZAxis range={[28, 28]} />
        <Tooltip
          contentStyle={{ background: "oklch(0.21 0.015 240)", border: "1px solid oklch(0.9 0.01 240 / 12%)", borderRadius: 8, fontSize: 12 }}
          formatter={(value: any, name: string) => [String(value), name === "pc1" ? "PC1" : "PC2"]}
        />
        {clusters.map((c, i) => (
          <Scatter
            key={c}
            name={`Cluster ${c}`}
            data={scatter.filter((p) => Number(p.cluster) === c)}
            fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ClusteringPage({ results }: { results: any; uploadCsv?: any }) {
  const kmeans = (results.clustering_kmeans ?? {}) as Record<string, any>;
  const dbscan = (results.clustering_dbscan ?? {}) as Record<string, any>;

  const k = Number(kmeans.best_k ?? 3);
  // silhouette_scores is a map like {3: score, 4: score, 5: score}
  const silhouette =
    kmeans.silhouette_scores !== undefined
      ? (kmeans.silhouette_scores as Record<string, number>)[String(k)] ??
        (kmeans.silhouette_scores as Record<string, number>)[k]
      : undefined;
  const clusters = (kmeans.profiles as any[]) ?? [];
  const scatter = (kmeans.points as Row[]) ?? [];
  const dbScatter = (dbscan.points as Row[]) ?? [];

  const outlierCount = dbScatter.filter((p) => Number(p.cluster) === -1).length;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Clustering"
        subtitle="Unsupervised structure of inspection records projected onto the first two principal components. K was selected via silhouette score within k ∈ [3, 5]; DBSCAN provides a secondary anomaly-cluster view."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <StatRow label="Selected k" value={k} highlight />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <StatRow label="Silhouette score" value={silhouette !== undefined && silhouette !== null ? Number(silhouette).toFixed(3) : "—"} highlight />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <StatRow label="Cluster count" value={clusters.length} highlight />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <StatRow label="DBSCAN anomalies" value={outlierCount.toLocaleString()} highlight />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="kmeans">
        <TabsList>
          <TabsTrigger value="kmeans">KMeans + PCA</TabsTrigger>
          <TabsTrigger value="dbscan">DBSCAN anomaly view</TabsTrigger>
        </TabsList>

        <TabsContent value="kmeans" className="mt-4">
          <ChartCard title="PCA 2D projection — KMeans" sub="Each point is an aggregated inspection slice; colors are cluster assignments">
            <ClusterScatter scatter={scatter} />
          </ChartCard>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {clusters.map((c, i) => {
              const name = (c.name ?? `Cluster ${c.cluster ?? i + 1}`) as string;
              return (
                <Card key={i} className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-3 w-3 rounded-sm" style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
                      {String(name)}
                      <Badge variant="outline" className="ml-auto font-mono">
                        n = {Number(c.records ?? c.size ?? 0)?.toLocaleString()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {c.avg_defect_rate_pct !== undefined && c.avg_defect_rate_pct !== null ? (
                        <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                          <dt className="text-muted-foreground">Defect rate</dt>
                          <dd className="font-data">{Number(c.avg_defect_rate_pct).toFixed(2)}%</dd>
                        </div>
                      ) : null}
                      {c.defect_rate_vs_global !== undefined && c.defect_rate_vs_global !== null ? (
                        <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                          <dt className="text-muted-foreground">vs. global</dt>
                          <dd className={`font-data ${Number(c.defect_rate_vs_global) >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {Number(c.defect_rate_vs_global) >= 0 ? "+" : ""}{Number(c.defect_rate_vs_global).toFixed(2)} pp
                          </dd>
                        </div>
                      ) : null}
                      {c.machines !== undefined ? (
                        <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                          <dt className="text-muted-foreground">Machines</dt>
                          <dd className="font-data">{String(c.machines)}</dd>
                        </div>
                      ) : null}
                      {c.shifts !== undefined ? (
                        <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                          <dt className="text-muted-foreground">Shifts</dt>
                          <dd className="font-data">{String(c.shifts)}</dd>
                        </div>
                      ) : null}
                      {c.defect_types !== undefined ? (
                        <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                          <dt className="text-muted-foreground">Defect types</dt>
                          <dd className="font-data">{String(c.defect_types)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="dbscan" className="mt-4">
          <ChartCard title="DBSCAN projection" sub="Gray points are anomalies not assigned to any dense cluster">
            <ClusterScatter scatter={dbScatter} />
            <div className="mt-2 flex gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" /> Anomaly (cluster −1)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-primary/80" /> Core cluster
              </span>
            </div>
          </ChartCard>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

export default withDataset(ClusteringPage);
