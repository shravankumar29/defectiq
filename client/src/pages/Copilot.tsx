import { CorrelationCausationBanner } from "@/components/CorrelationCausationBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CornerDownLeft, Sparkles, ChevronDown, User, Activity, Search, Box, Database, TrendingUp, AlertTriangle, Play, UploadCloud, Network, Thermometer } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useAnalysis } from "@/contexts/AnalysisContext";

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  evidence?: string;
  sources?: string[];
};

export default function CopilotPage() {
  const { status, results, generate } = useAnalysis();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const isLoaded = status?.loaded && results;
  const isHome = messages.length === 0;

  // Render the chat view if messages exist
  if (!isHome) {
    return (
      <div className="mx-auto max-w-4xl p-6 lg:p-8 animate-in fade-in duration-500">
        <div className="mb-8 flex flex-col gap-4 sticky top-0 z-20 bg-[#0a0c12]/80 backdrop-blur-md pb-4 pt-2">
          <div className="flex items-center gap-3 rounded-full border border-cyan-500/20 bg-black/40 px-4 py-2.5 shadow-[0_0_20px_rgba(6,182,212,0.05)] focus-within:border-cyan-500/50 focus-within:bg-black/60 transition-all duration-300">
            <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
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
              className="flex-1 bg-transparent text-[14.5px] font-light outline-none placeholder:text-white/30 text-white"
              disabled={isPending}
            />
            <Button 
              size="sm" 
              onClick={() => send(input)} 
              disabled={isPending || !input.trim()}
              className="rounded-full bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:text-white border border-cyan-500/30 h-8 px-4"
            >
              Send <CornerDownLeft className="h-3 w-3 ml-1.5 opacity-70" />
            </Button>
          </div>
          <div className="flex justify-center">
            <p className="text-[10px] text-white/30 font-data tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              ASSOCIATION ≠ CAUSATION
            </p>
          </div>
        </div>

        <div className="space-y-6 flex flex-col-reverse">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex w-full gap-4"}>
              {m.role === "user" ? (
                <div className="flex items-end gap-3 max-w-[80%]">
                  <div className="rounded-2xl rounded-br-sm bg-cyan-500/20 border border-cyan-500/30 px-5 py-3 text-[15px] font-light text-cyan-50 shadow-[0_0_15px_rgba(6,182,212,0.05)] backdrop-blur-md">
                    {m.text}
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-900/40 border border-cyan-500/30">
                    <User className="h-4 w-4 text-cyan-200" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 space-y-2 max-w-[90%] md:max-w-[85%]">
                    <Card className="w-full bg-card/40 backdrop-blur-md border-white/10 shadow-xl overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-transparent" />
                      <div className="p-5 sm:p-6">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-[14.5px] font-light leading-relaxed">
                          <Streamdown>{m.text}</Streamdown>
                        </div>
                        
                        {m.evidence ? (
                          <details className="mt-6 rounded-lg border border-white/5 bg-black/20 overflow-hidden group transition-all duration-300">
                            <summary className="cursor-pointer text-[10px] uppercase tracking-wider font-semibold px-4 py-3 hover:bg-white/[0.04] transition-colors flex items-center justify-between text-white/40 group-hover:text-white/60">
                              <span className="flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-cyan-500/70" />
                                View Analytical Evidence
                              </span>
                              <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" />
                            </summary>
                            <div className="p-4 text-[11.5px] text-white/50 whitespace-pre-wrap font-mono leading-relaxed bg-black/40 border-t border-white/5">
                              {m.evidence}
                            </div>
                          </details>
                        ) : null}

                        {m.sources?.length ? (
                          <div className="mt-5 border-t border-white/5 pt-4">
                            <p className="font-data text-[10px] uppercase tracking-widest text-white/30">
                              Sources: <span className="text-white/50">{m.sources.join(", ")}</span>
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )).reverse()}
          {isPending ? (
            <div className="flex w-full gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
              </div>
              <div className="space-y-4 w-full max-w-[85%] mt-1">
                <div className="text-[11px] uppercase tracking-widest font-semibold text-cyan-400/70 flex items-center gap-3">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400/70 border-r-transparent" />
                  Synthesizing Defect Intelligence...
                </div>
                <Card className="w-full bg-card/20 border-white/5 p-6">
                  <Skeleton className="h-4 w-3/4 mb-3 bg-white/5" />
                  <Skeleton className="h-4 w-1/2 bg-white/5" />
                </Card>
              </div>
            </div>
          ) : null}
        </div>


      </div>
    );
  }

  // --- HOME STATE ---

  const { kpis, filename, multi_factor_patterns, single_factor_signals, defect_types, overview, machine_analysis } = results || {};
  
  const topPattern = multi_factor_patterns?.[0] || single_factor_signals?.[0];
  const totalMachines = overview?.machine_breakdown?.length || 0;
  const totalShifts = overview?.shift_breakdown?.length || 0;
  
  // High-risk machine for dynamic questions
  const hrm = machine_analysis?.highest_risk_machine?.machine_id;
  const hrmName = hrm ? (String(hrm).toLowerCase().startsWith("machine") ? hrm : `M${hrm}`) : "M01";

  return (
    <div className={`min-h-full w-full bg-[#0a0c12] text-white overflow-y-auto overflow-x-hidden ${mounted ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 relative`}>
      {/* Background aesthetic */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-[1100px] px-6 py-16 relative z-10">
        
        {/* 2. HERO / HEADER */}
        <div className="text-center md:text-left mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <p className="font-data text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 mb-4">
            DEFECTIQ INTELLIGENCE
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-white mb-6">
            Ask Your Factory <span className="text-cyan-400">Data.</span>
          </h1>
          <p className="max-w-2xl text-base md:text-lg font-light text-white/55 leading-relaxed mx-auto md:mx-0">
            Investigate machines, shifts, batches, defects, anomalies and patterns using the evidence already calculated from your dataset.
          </p>
          
          <div className="mt-8 flex items-center justify-center md:justify-start gap-3">
            {isLoaded ? (
              <>
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                <span className="font-data text-[11px] uppercase tracking-widest text-cyan-300/80">
                  DATASET CONNECTED
                </span>
                <span className="text-[11px] text-white/30">•</span>
                <span className="font-mono text-[11px] text-white/60 bg-white/5 px-2 py-1 rounded">
                  {filename || "factory_data.csv"}
                </span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]" />
                <span className="font-data text-[11px] uppercase tracking-widest text-red-300/80">
                  NO DATASET CONNECTED
                </span>
              </>
            )}
          </div>
          
          {/* Moved Input Area for Home State */}
          <div className="mt-12 max-w-3xl mx-auto md:mx-0 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">
            <div className="flex items-center gap-3 rounded-full border border-cyan-500/30 bg-black/40 px-5 py-3 shadow-[0_0_30px_rgba(6,182,212,0.1)] backdrop-blur-xl focus-within:border-cyan-400 focus-within:shadow-[0_0_40px_rgba(6,182,212,0.2)] transition-all duration-300">
              <Sparkles className="h-5 w-5 text-cyan-400 shrink-0" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about machines, shifts, batches, defects, patterns or process conditions..."
                className="flex-1 bg-transparent text-[15px] font-light outline-none placeholder:text-white/30 text-white"
                disabled={isPending}
              />
              <Button 
                onClick={() => send(input)} 
                disabled={isPending || !input.trim()}
                className="rounded-full bg-cyan-400 text-cyan-950 hover:bg-cyan-300 h-10 px-6 font-medium tracking-wide transition-all active:scale-95"
              >
                Send
              </Button>
            </div>
            
            <div className="mt-4 flex flex-col md:flex-row items-center justify-between px-4 gap-4">
              <p className="text-[11px] font-light text-white/40">
                Examples: <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => send("Why is M02 high-risk?")}>"Why is M02 high-risk?"</span> • <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => send("Which batches need attention?")}>"Which batches need attention?"</span>
              </p>
              <div className="flex items-center gap-2 font-data text-[9px] uppercase tracking-widest text-white/20 divide-x divide-white/10">
                <span className="pr-2">DATA-GROUNDED</span>
                <span className="px-2">STATISTICAL</span>
                <span className="px-2">EVIDENCE-BACKED</span>
                <span className="pl-2">NON-CAUSAL</span>
              </div>
            </div>
          </div>
        </div>

        {isLoaded ? (
          <>
            {/* 3. DATASET CONTEXT STRIP */}
            <div className="w-full flex overflow-x-auto pb-4 md:pb-0 hide-scrollbar animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">
              <div className="flex w-max md:w-full min-w-full divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
                <div className="px-6 py-5 flex-1 min-w-[150px]">
                  <p className="font-data text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">RECORDS</p>
                  <p className="font-data text-2xl font-light text-white">{kpis?.total_inspections?.toLocaleString() || "0"}</p>
                </div>
                <div className="px-6 py-5 flex-1 min-w-[150px]">
                  <p className="font-data text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">DEFECT RATE</p>
                  <p className="font-data text-2xl font-light text-cyan-300">{kpis?.defect_rate_pct?.toFixed(2) || "0.00"}%</p>
                </div>
                <div className="px-6 py-5 flex-1 min-w-[150px]">
                  <p className="font-data text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">MACHINES</p>
                  <p className="font-data text-2xl font-light text-white">{totalMachines}</p>
                </div>
                <div className="px-6 py-5 flex-1 min-w-[150px]">
                  <p className="font-data text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">SHIFTS</p>
                  <p className="font-data text-2xl font-light text-white">{totalShifts}</p>
                </div>
                <div className="px-6 py-5 flex-1 min-w-[150px]">
                  <p className="font-data text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">DEFECT TYPES</p>
                  <p className="font-data text-2xl font-light text-white">{defect_types?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-16 border-t border-white/5 pt-16 grid grid-cols-1 md:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-200">
              
              {/* Left Column */}
              <div className="md:col-span-8">
                
                {/* 4. WHAT I CAN HELP WITH */}
                <p className="font-data text-[10px] uppercase tracking-[0.3em] text-white/40 mb-6">WHAT I CAN HELP YOU INVESTIGATE</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: Activity, title: "MACHINE RISK", desc: "Which machines have unusually high defect rates?", q: "Which machines have unusually high defect rates?" },
                    { icon: Network, title: "DEFECT PATTERNS", desc: "Find recurring machine + shift + process combinations.", q: "What are the strongest defect patterns?" },
                    { icon: Box, title: "BATCH / SHIFT", desc: "Identify batches or shifts that deserve investigation.", q: "Identify batches or shifts that deserve investigation." },
                    { icon: Thermometer, title: "PROCESS SIGNALS", desc: "Explore temperature, pressure, and speed associations.", q: "What process variables are associated with defects?" }
                  ].map((card, i) => (
                    <div 
                      key={i} 
                      onClick={() => send(card.q)}
                      className="group cursor-pointer rounded-xl border border-white/5 bg-white/[0.01] p-5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <card.icon className="h-5 w-5 text-cyan-500/70 mb-4 transition-transform group-hover:scale-110 group-hover:text-cyan-400" strokeWidth={1.5} />
                      <h3 className="font-display text-sm tracking-wide text-white mb-2">{card.title}</h3>
                      <p className="text-xs font-light text-white/50">{card.desc}</p>
                    </div>
                  ))}
                </div>

                {/* 6. SUGGESTED QUESTIONS */}
                <div className="mt-16">
                  <p className="font-data text-[10px] uppercase tracking-[0.3em] text-white/40 mb-6">START AN INVESTIGATION</p>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      `What makes ${hrmName} higher-risk?`,
                      "What should I investigate first?",
                      "Which defect type is most common?",
                      "Which batches are flagged?",
                      "What process variables are associated with defects?",
                      "Are there any significant anomalies?"
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-[12px] font-light text-white/70 transition-all hover:bg-white/[0.06] hover:text-white hover:border-white/20 active:scale-95"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column */}
              <div className="md:col-span-4 space-y-6">
                {/* 5. & 7. PRIORITY INVESTIGATION AREA / PREVIEW */}
                <p className="font-data text-[10px] uppercase tracking-[0.3em] text-white/40 mb-6">TOP INVESTIGATION PRIORITY</p>
                
                {topPattern ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)] backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-violet-500" />
                    
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      <span className="font-data text-[10px] uppercase tracking-widest text-cyan-300">DATA SIGNAL</span>
                    </div>

                    <h3 className="font-display text-xl font-light text-white mb-1 leading-tight">
                      {topPattern.description.replace(/^(Machine |Shift )/, '')}
                    </h3>
                    <p className="text-sm font-light text-white/70 mb-6">{topPattern.defect_type}</p>

                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="font-data text-[10px] uppercase tracking-wider text-white/40">DEFECT RATE</span>
                        <span className="font-data text-sm text-white">{topPattern.slice_rate?.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="font-data text-[10px] uppercase tracking-wider text-white/40">BASELINE</span>
                        <span className="font-data text-sm text-violet-300">{topPattern.lift?.toFixed(2)}×</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-data text-[10px] uppercase tracking-wider text-white/40">SAMPLES (N)</span>
                        <span className="font-data text-sm text-white/60">{topPattern.n_slice}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/50 font-light mb-5">
                      Strongest current association worth investigating.
                    </p>

                    <button 
                      onClick={() => send(`Why was ${topPattern.description} detected as high risk?`)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/[0.05] border border-white/10 px-4 py-2.5 text-xs font-light transition-colors hover:bg-white/[0.1] hover:text-white text-white/80"
                    >
                      Investigate This <CornerDownLeft className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center backdrop-blur-md">
                    <Database className="h-6 w-6 text-white/20 mx-auto mb-4" />
                    <p className="font-display text-sm tracking-wide text-white mb-2">NO HIGH-PRIORITY FINDING</p>
                    <p className="text-[11px] font-light text-white/40 leading-relaxed">
                      Current evidence does not indicate a strong investigation priority exceeding statistical filters.
                    </p>
                  </div>
                )}
              </div>
            </div>
            

          </>
        ) : (
          /* 12. EMPTY STATE WHEN NO DATASET EXISTS */
          <div className="mt-16 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="max-w-2xl mx-auto text-center rounded-2xl border border-white/5 bg-white/[0.01] p-12 backdrop-blur-sm">
              <Database className="h-10 w-10 text-cyan-500/50 mx-auto mb-6" strokeWidth={1} />
              <p className="font-data text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">CONNECT A DATASET</p>
              <h2 className="font-display text-2xl font-light text-white mb-4">Upload a CSV or Excel inspection file to activate DefectIQ Copilot.</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-6 py-3 text-[13px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 active:scale-[0.97]"
                >
                  <UploadCloud className="h-4 w-4" strokeWidth={1.5} />
                  Import Factory Data &rarr;
                </button>
                <button
                  onClick={async () => {
                    await generate();
                    toast.success("Demo dataset generated");
                  }}
                  className="flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.07] px-6 py-3 text-[13px] font-light tracking-wide text-violet-200 transition-all hover:bg-violet-400/12 active:scale-[0.97]"
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Explore Demo &rarr;
                </button>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-4xl mx-auto opacity-50 pointer-events-none">
              {[
                { icon: Activity, title: "MACHINE RISK" },
                { icon: Search, title: "DEFECT PATTERNS" },
                { icon: Box, title: "BATCH / SHIFT" },
                { icon: Thermometer, title: "PROCESS SIGNALS" }
              ].map((card, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 text-center">
                  <card.icon className="h-5 w-5 text-white/20 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="font-display text-xs tracking-wide text-white/40 mb-2">{card.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
