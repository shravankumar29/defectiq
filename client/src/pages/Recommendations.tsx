import {
  PageHeader,
  PriorityBadge,
} from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import withDataset from "@/components/withDataset";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type Rec = Record<string, unknown>;

function RecommendationsPage({ results }: { results: any; uploadCsv?: any }) {
  const { data: patternsData, isLoading } = trpc.engine.patterns.useQuery(undefined, {
    staleTime: Infinity,
  });

  const recs = (patternsData as any)?.recommendations ?? [];
  const evidence = (patternsData as any)?.evidence ?? {};
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Generating recommendations...</p>
      </div>
    );
  }

  const sorted = [...recs].sort(
    (a, b) => (PRIORITY_ORDER as Record<string, number>)[String(a.priority)] - (PRIORITY_ORDER as Record<string, number>)[String(b.priority)]
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Recommended Actions"
        subtitle="Priority-tagged investigation actions derived from detected patterns. Actions reflect statistical association — validate with targeted experiments before committing resources."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        {sorted.length} recommendations, ordered by priority tier.
      </p>

      <div className="space-y-3">
        {sorted.map((r, i) => {
          const ev = evidence?.[String(r.pattern_id ?? i)] as any;
          return (
            <Card key={i} className="border-border/70">
              <CardContent className="flex items-start gap-4 pt-5">
                <PriorityBadge priority={String(r.priority)} />
                <div className="flex-1">
                  <p className="font-medium">{String(r.text ?? r.title)}</p>
                  {r.pattern_id ? (
                    <p className="mt-1 font-data text-xs text-muted-foreground">
                      Pattern: {String(r.pattern_id)}
                    </p>
                  ) : null}
                  <Collapsible
                    open={openId === String(i)}
                    onOpenChange={(o) => setOpenId(o ? String(i) : null)}
                  >
                    <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                      Evidence behind this recommendation
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      {ev?.finding ? (
                        <p className="rounded-md bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
                          {String(ev.finding)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No structured evidence attached.</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                <span className="hidden font-data text-xs text-muted-foreground sm:block">
                  {r.pattern_id ? `#${String(r.pattern_id)}` : ""}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <CorrelationCausationBanner />
      </div>
    </div>
  );
}

export default withDataset(RecommendationsPage);
