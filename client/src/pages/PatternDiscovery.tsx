import {
  EvidencePanel,
  PageHeader,
  PriorityBadge,
  ScorePill,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import withDataset from "@/components/withDataset";

type Pattern = Record<string, unknown>;

const SORT_KEYS = [
  { key: "pattern_score", label: "Confidence Score" },
  { key: "lift", label: "Lift" },
  { key: "p_value", label: "p-value" },
  { key: "sample_size", label: "Support (n)" },
  { key: "effect_size_pp", label: "Effect Size" },
];

function PatternDiscoveryPage({ results }: { results: any; uploadCsv?: any }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("pattern_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [factorTab, setFactorTab] = useState<"all" | "multi" | "single">("multi");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const patterns = (results.patterns as Pattern[]) ?? [];
  const evidence = (results.evidence ?? {}) as Record<string, any>;
  const defectTypes = (results.defect_types as string[]) ?? [];

  const sorted = useMemo(() => {
    let list = patterns.filter((p) => {
      const isMulti = Boolean((p as any).is_multi_factor ?? (Array.isArray((p as any).factors) && (p as any).factors.length >= 2));
      if (factorTab === "multi" && !isMulti) return false;
      if (factorTab === "single" && isMulti) return false;

      const dtMatch = typeFilter === "all" || String(p.defect_type ?? "").toLowerCase() === typeFilter.toLowerCase();
      const queryMatch = query === "" || String(p.description ?? p.pattern_text ?? "").toLowerCase().includes(query.toLowerCase());
      return dtMatch && queryMatch;
    });
    list = [...list].sort((a, b) => {
      let av = Number((a as any)[sortKey] ?? 0);
      let bv = Number((b as any)[sortKey] ?? 0);
      if (sortKey === "effect_size_pp") {
        av = Number((a as any).effect_size_pp ?? (Number(a.slice_rate) - Number(a.baseline_rate)));
        bv = Number((b as any).effect_size_pp ?? (Number(b.slice_rate) - Number(b.baseline_rate)));
      }
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [patterns, query, sortKey, sortAsc, typeFilter, factorTab]);

  const openPattern = sorted.find((p) => p.pattern_id === openId);
  const openEvidence = openPattern ? evidence[String(openPattern.pattern_id)] : null;

  function cycleSort(key: string) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "p_value");
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Pattern Discovery"
        subtitle="Multi-factor combinatorial patterns ranked by a weighted confidence composite (30% lift, 25% significance, 20% sample size, 15% recurrence, 10% effect size). Score is 0–100."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-1">
          <Button
            size="sm"
            variant={factorTab === "multi" ? "default" : "ghost"}
            onClick={() => setFactorTab("multi")}
            className="text-xs"
          >
            Multi-Factor Patterns
          </Button>
          <Button
            size="sm"
            variant={factorTab === "single" ? "default" : "ghost"}
            onClick={() => setFactorTab("single")}
            className="text-xs"
          >
            Single-Factor Signals
          </Button>
          <Button
            size="sm"
            variant={factorTab === "all" ? "default" : "ghost"}
            onClick={() => setFactorTab("all")}
            className="text-xs"
          >
            All Findings
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patterns…"
              className="w-56 pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Defect type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All defect types</SelectItem>
              {defectTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {sorted.length} shown
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead>Defect type</TableHead>
              {SORT_KEYS.map((s) => (
                <TableHead key={s.key} className="cursor-pointer select-none text-right" onClick={() => cycleSort(s.key)}>
                  <div className="flex items-center justify-end gap-1">
                    {s.label}
                    {sortKey === s.key ? <ArrowUpDown className={cn("h-3.5 w-3.5", sortAsc ? "rotate-180" : "")} /> : null}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">Action Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const ev = evidence[String(p.pattern_id)];
              const effectPp = Number(p.effect_size_pp ?? (Number(p.slice_rate) - Number(p.baseline_rate)));
              return (
                <TableRow
                  key={String(p.pattern_id)}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => setOpenId(String(p.pattern_id))}
                >
                  <TableCell className="max-w-xs truncate font-medium" title={String(p.description)}>
                    {String(p.description ?? p.pattern_text)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {String(p.defect_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ScorePill score={Number(p.pattern_score ?? 0)} />
                  </TableCell>
                  <TableCell className="text-right font-data">{Number(p.lift)?.toFixed(2)}×</TableCell>
                  <TableCell className="text-right font-data">
                    {p.p_value === null || p.p_value === undefined ? "—" : Number(p.p_value) < 0.001 ? "<.001" : Number(p.p_value).toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-data">{Number(p.sample_size)?.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-data">{effectPp > 0 ? "+" : ""}{effectPp.toFixed(2)} pp</TableCell>
                  <TableCell className="text-right">
                    {ev?.recommendation ? (
                      <PriorityBadge priority={ev.recommendation.priority} />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CardNote
          title="How the confidence score is computed"
          body="score = 0.30·lift + 0.25·significance + 0.20·sample_size + 0.15·recurrence + 0.10·effect_size, each normalized to 0–1 and scaled to 0–100."
        />
        <CardNote
          title="Interpreting results"
          body="A high score means the slice is strongly associated with a defect rate above baseline. It does not prove the factor caused the defects — validate with targeted experiments."
        />
      </div>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>

      <Drawer open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="font-data text-base">
              {openPattern ? String(openPattern.description ?? openPattern.pattern_text) : ""}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            {openEvidence ? <EvidencePanel evidence={openEvidence} /> : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function CardNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        {title}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export default withDataset(PatternDiscoveryPage);
