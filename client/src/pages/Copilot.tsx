import { PageHeader } from "@/components/analysis";
import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CornerDownLeft, Sparkles } from "lucide-react";
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
  sources?: string[];
};

function CopilotPage({ results: _results }: { results: any; uploadCsv?: any }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const chat = trpc.engine.copilot.useMutation();

  function send(question: string) {
    const q = question.trim();
    if (!q || chat.isPending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    chat.mutate(
      { question: q },
      {
        onSuccess: (data) => {
          const d = data as any;
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              text: String(d?.answer ?? "No answer available."),
              sources: Array.isArray(d?.sources_used) ? d.sources_used : [],
            },
          ]);
        },
        onError: (e) => {
          toast.error(e.message);
        },
      }
    );
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
                    <p className="text-sm leading-relaxed">{m.text}</p>
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
          {chat.isPending ? (
            <div className="space-y-2">
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
          />
          <Button size="sm" onClick={() => send(input)} disabled={chat.isPending || !input.trim()}>
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
