import { PageHeader } from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CornerDownLeft, Sparkles, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import withDataset from "@/components/withDataset";

const SUGGESTIONS = [
  "Which pattern has the highest confidence score and why?",
  "Summarize the detected change point and its impact.",
  "What should I investigate first on machine M04?",
  "Which batches are flagged and what defect type dominates?",
];

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  evidence?: string;
  sources?: string[];
};

function CopilotPage({ results: _results }: { results: any; uploadCsv?: any }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function send(question: string) {
    const q = question.trim();
    if (!q || isPending) return;
    
    const newMessages = [...messages, { role: "user" as const, text: q }];
    setMessages(newMessages);
    setInput("");
    setIsPending(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch copilot response");
      }

      let text = data.answer || "No response generated.";
      let evidence = "";
      
      const evidenceIndex = text.search(/\n\nEvidence\n/i);
      if (evidenceIndex !== -1) {
        evidence = text.slice(evidenceIndex + 10).trim();
        text = text.slice(0, evidenceIndex).trim();
      } else {
        const evidenceIndexAlt = text.search(/\nEvidence\n/i);
        if (evidenceIndexAlt !== -1) {
          evidence = text.slice(evidenceIndexAlt + 9).trim();
          text = text.slice(0, evidenceIndexAlt).trim();
        }
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text,
          evidence,
          sources: data.sources || [],
        },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Failed to connect to AI Copilot");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="AI Copilot"
        subtitle="Ask questions about the dataset. Answers are grounded exclusively in the precomputed statistical results — the model narrates, it does not compute."
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.text}
                </div>
              ) : (
                <Card className="w-full max-w-[85%]">
                  <div className="p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    {m.evidence ? (
                      <details className="mt-4 border border-border rounded-md overflow-hidden bg-muted/20">
                        <summary className="cursor-pointer text-xs font-semibold px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-between">
                          <span>Evidence</span>
                          <ChevronDown className="h-3 w-3" />
                        </summary>
                        <div className="p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {m.evidence}
                        </div>
                      </details>
                    ) : null}
                    {m.sources?.length ? (
                      <p className="mt-2 border-t border-border pt-2 font-data text-[11px] text-muted-foreground">
                        Sources: {m.sources.join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-amber-400">
                      This answer reflects statistical associations in the data; it does not establish causation.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          ))}
          {isPending ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                Analyzing DefectIQ evidence...
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about patterns, machines, shifts, or batches…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isPending}
          />
          <Button size="sm" onClick={() => send(input)} disabled={isPending || !input.trim()}>
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6">
          <CorrelationCausationBanner />
        </div>
      </div>
    </div>
  );
}

export default withDataset(CopilotPage);
