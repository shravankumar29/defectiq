import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Database,
  FlaskConical,
  Lightbulb,
  Package,
  Thermometer,
} from "lucide-react";
import type { ReactNode } from "react";

/* ---------- priority styling ---------- */
export const PRIORITY_STYLES: Record<string, { dot: string; label: string; ring: string }> = {
  Critical: { dot: "bg-red-500", label: "text-red-400", ring: "border-red-500/40" },
  High: { dot: "bg-orange-500", label: "text-orange-400", ring: "border-orange-500/40" },
  Medium: { dot: "bg-amber-500", label: "text-amber-400", ring: "border-amber-500/40" },
  Low: { dot: "bg-emerald-500", label: "text-emerald-400", ring: "border-emerald-500/40" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.ring, s.label)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {priority}
    </span>
  );
}

/* ---------- page shell ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------- KPI card ---------- */
export function KPICard({
  label,
  value,
  sub,
  tone = "neutral",
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "up" | "down";
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-amber-500/40 bg-amber-500/5")}>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-2 font-data text-2xl font-semibold", accent && "text-amber-300")}>{value}</p>
        {sub ? (
          <p
            className={cn(
              "mt-1 text-xs",
              tone === "up" && "text-emerald-400",
              tone === "down" && "text-red-400",
              tone === "neutral" && "text-muted-foreground"
            )}
          >
            {sub}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ---------- evidence panel (Finding / Evidence / Interpretation / Action) ---------- */
export function EvidencePanel({ evidence }: { evidence: any }) {
  const ev = evidence?.evidence ?? {};
  const batches = (ev.affected_batches ?? []).slice(0, 8);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-primary" />
            Finding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{evidence?.finding}</p>
          {evidence?.disclaimer ? (
            <p className="mt-2 text-xs italic text-muted-foreground">{evidence.disclaimer}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            {Object.entries(ev as Record<string, unknown>).map(([k, v]) =>
              k.startsWith("affected") ? null : (
                <div key={k} className="flex justify-between gap-2 border-b border-border/50 pb-1.5">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {k.replace(/_/g, " ")}
                  </dt>
                  <dd className={cn("font-data text-right", typeof v === "number" && "font-semibold")}>
                    {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                  </dd>
                </div>
              )
            )}
          </dl>
          {batches.length ? (
            <div className="mt-3 flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Affected batches</p>
                <p className="mt-0.5 font-data text-xs text-foreground">{batches.join(", ")}</p>
              </div>
            </div>
          ) : null}
          {ev.date_range ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              {ev.date_range}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" />
            Interpretation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{evidence?.interpretation}</p>
          <div className="mt-3">
            <CorrelationCausationBanner compact />
          </div>
        </CardContent>
      </Card>

      {evidence?.recommendation?.text ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Recommended investigation
              <span className="ml-auto">
                <PriorityBadge priority={evidence.recommendation.priority} />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{evidence.recommendation.text}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ---------- chart card wrapper ---------- */
export function ChartCard({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ---------- empty / loading / error states ---------- */
export function AnalysisEmpty({ onGenerate, uploading }: { onGenerate: () => void; uploading?: boolean }) {
  return (
    <div className="mx-auto mt-16 flex max-w-xl flex-col items-center gap-6 rounded-xl border border-dashed border-border p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <AlertTriangle className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">No inspection dataset loaded</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate the 20,000-record synthetic inspection dataset (90 days of plant data with embedded
          defect patterns) or upload your own CSV/XLSX to begin analysis.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onGenerate}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition-all hover:opacity-90 active:scale-[0.97]"
        >
          Generate synthetic dataset
        </button>
        {uploading ? null : null}
      </div>
      <CorrelationCausationBanner compact />
    </div>
  );
}

export function StatRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon?: any;
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("ml-auto font-data", highlight && "font-semibold text-amber-300")}>{value}</span>
    </div>
  );
}

export { CheckCircle2 };
export { Thermometer };
export { ScorePill };

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80 ? "bg-red-500/15 text-red-300 border-red-500/40" :
    score >= 60 ? "bg-orange-500/15 text-orange-300 border-orange-500/40" :
    score >= 40 ? "bg-amber-500/15 text-amber-300 border-amber-500/40" :
    "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 font-data text-xs font-semibold", tone)}>
      {Math.round(score)}
    </span>
  );
}
