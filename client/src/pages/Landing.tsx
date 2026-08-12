import { useEffect, useRef, useState } from "react";
import DefectIQScene from "@/components/DefectIQScene";
import Spline3DHero from "@/components/Spline3DHero";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { SchemaMappingModal } from "@/components/SchemaMappingModal";

import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowDown,
  UploadCloud,
  FileSpreadsheet,
  FlaskConical,
  Play,
  Network,
  BarChart3,
  FileText
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Minimal floating navigation                                        */
/* ------------------------------------------------------------------ */
function LandingNav({ onImport }: { onImport: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-5 max-w-6xl px-6">
        <div
          className="flex items-center justify-between rounded-full border border-white/8 bg-white/[0.03] px-6 py-3 backdrop-blur-xl"
          style={{ backdropFilter: "blur(20px)" }}
        >
          <a href="#top" className="font-display text-sm font-semibold tracking-[0.22em] text-white">
            DEFECTIQ
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {["Product", "Intelligence", "Workflow", "Mapping", "Copilot"].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="text-[13px] font-light tracking-wide text-white/55 transition-colors hover:text-white"
              >
                {item}
              </a>
            ))}
          </nav>
          <button
            onClick={onImport}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/[0.08] px-5 py-2 text-[13px] font-light tracking-wide text-cyan-200 transition-all hover:bg-cyan-400/15 hover:text-white active:scale-[0.97]"
          >
            Import Data
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Section labels                                                     */
/* ------------------------------------------------------------------ */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-data mb-6 text-[11px] uppercase tracking-[0.35em] text-cyan-300/70">{children}</p>
  );
}

/* ------------------------------------------------------------------ */
/* Upload dialog                                                      */
/* ------------------------------------------------------------------ */
type UploadState = "idle" | "done";

function UploadDialog({
  open,
  onClose,
  onAnalyze,
  onUploadStateChange
}: {
  open: boolean;
  onClose: () => void;
  onAnalyze: () => void;
  onUploadStateChange?: (state: "idle" | "reading" | "mapping" | "analyzing" | "detected") => void;
}) {
  const { previewUpload, confirmUpload, generate, resultsLoading } = useAnalysis();
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingBase64, setPendingBase64] = useState<string>("");
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setState("idle");
      setDragOver(false);
    }
  }, [open]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !modalOpen) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, modalOpen, onClose]);

  async function handleFile(file: File) {
    try {
      onUploadStateChange?.("reading");
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = reader.result as string;
          resolve(raw.includes(",") ? raw.split(",")[1] : raw);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const analysis = await previewUpload(b64);
      setPendingBase64(b64);
      setPendingFileName(file.name);
      setAnalysisResult(analysis);
      setModalOpen(true);
      onUploadStateChange?.("mapping");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file. Please ensure it is a valid CSV or Excel file.");
      onUploadStateChange?.("idle");
    }
  }

  async function handleConfirmMappings(userMappings: Record<string, string | null>) {
    if (!pendingBase64) return;
    setIsSubmitting(true);
    onUploadStateChange?.("analyzing");
    try {
      const res = await confirmUpload(pendingBase64, userMappings);
      toast.success(`Mapped and analyzed ${res.rows?.toLocaleString?.() ?? 0} inspections`);
      onUploadStateChange?.("detected");
      setModalOpen(false);
      
      // Delay closing to show "PATTERN DETECTED" briefly
      setTimeout(() => {
        onClose();
        onAnalyze();
        onUploadStateChange?.("idle");
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirmation failed");
      onUploadStateChange?.("idle");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  }

  async function handleDemo() {
    try {
      onUploadStateChange?.("analyzing");
      await generate();
      toast.success("Demo dataset generated");
      onUploadStateChange?.("detected");
      setState("done");
      
      setTimeout(() => {
        onUploadStateChange?.("idle");
      }, 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the demo dataset.");
      onUploadStateChange?.("idle");
    }
  }

  if (!open) return null;

  if (modalOpen) {
    return (
      <SchemaMappingModal
        open={modalOpen}
        fileName={pendingFileName}
        analysis={analysisResult}
        onConfirm={handleConfirmMappings}
        onCancel={() => {
          setModalOpen(false);
          setPendingBase64("");
          setAnalysisResult(null);
          onUploadStateChange?.("idle");
        }}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => {
        onClose();
        onUploadStateChange?.("idle");
      }} />
      <div className="lp-border-glow relative w-full max-w-lg rounded-2xl bg-[#0a0c12]/95 p-8 backdrop-blur-xl">
        {state === "idle" ? (
          <>
            <p className="font-data mb-1 text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
              Import Experience
            </p>
            <h3 className="font-display mb-6 text-2xl font-light tracking-wide text-white">
              IMPORT FACTORY DATA
            </h3>

            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 transition-colors ${
                dragOver ? "border-cyan-300/60 bg-cyan-400/5" : "border-white/12 bg-white/[0.02]"
              }`}
            >
              <UploadCloud className="mb-3 h-7 w-7 text-cyan-300/60" strokeWidth={1.2} />
              <p className="mb-4 text-sm font-light text-white/60">Drop CSV or Excel file here</p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleBrowse}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={resultsLoading}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/[0.08] px-5 py-2 text-[13px] font-light tracking-wide text-cyan-200 transition-all hover:bg-cyan-400/15 disabled:opacity-50 active:scale-[0.97]"
              >
                Browse Files
              </button>
              <p className="mt-4 font-data text-[11px] tracking-[0.2em] text-white/35">
                CSV • XLSX supported
              </p>
              <p className="mt-1 font-data text-[11px] tracking-[0.2em] text-cyan-400/50">
                AI-assisted column mapping
              </p>
            </div>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/8" />
              <span className="font-data text-[10px] uppercase tracking-[0.3em] text-white/30">or</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            <button
              onClick={handleDemo}
              disabled={resultsLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.07] px-5 py-2.5 text-[13px] font-light tracking-wide text-violet-200 transition-all hover:bg-violet-400/12 disabled:opacity-50 active:scale-[0.97]"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
              Use Demo Dataset
            </button>
          </>
        ) : (
          <>
            <p className="font-data mb-1 text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
              Dataset Ready
            </p>
            <h3 className="font-display mb-6 text-2xl font-light tracking-wide text-white">
              Ready to decode
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                ["✓ Dataset loaded"],
                ["✓ Columns detected"],
                ["✓ Schema mapped"],
                ["✓ Data validated"],
              ].map(([label]) => (
                <div key={label} className="flex items-center gap-2 text-sm text-cyan-200">
                  <span className="text-cyan-400 font-bold">{label}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                onUploadStateChange?.("idle");
                onClose();
                onAnalyze();
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400/[0.12] px-5 py-3 text-[13px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 active:scale-[0.97]"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing copilot — live, grounded, scrollable Q&A                   */
/* ------------------------------------------------------------------ */
const LANDING_QUESTIONS = [
  "Why did Surface Defects increase?",
  "Which machine is the highest risk?",
  "What happened around day 60?",
];

function LandingCopilot() {
  type Msg = { role: "user" | "defectiq"; text: string };
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      role: "defectiq",
      text: "Ask me anything about your defect data — every answer is grounded in the analysis and framed as statistical association, not proven causation.",
    },
  ]);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const { copilot } = useAnalysis();

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setAsk("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await copilot.ask(q);
      const answer =
        typeof res?.answer === "string" && res.answer.trim().length > 0
          ? res.answer
          : "I could not find a relevant answer for that question right now. Try asking about machines, shifts, batches, or defect types.";
      setMessages(m => [...m, { role: "defectiq", text: answer }]);
    } catch {
      setMessages(m => [
        ...m,
        {
          role: "defectiq",
          text: "The copilot is not available right now. Load a dataset in the app to enable it.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {messages.slice(-4).map((m, i) => (
        <div key={i} className={i === 0 ? "" : "mt-5"}>
          {m.role === "user" ? (
            <>
              <span className="font-data text-[11px] uppercase tracking-[0.25em] text-violet-300/80">
                You
              </span>
              <p className="mt-1 text-[15px] font-light text-white/85">&ldquo;{m.text}&rdquo;</p>
            </>
          ) : (
            <>
              <span className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">
                DefectIQ
              </span>
              <p className="mt-1 leading-relaxed text-[15px] font-light text-white/70">{m.text}</p>
            </>
          )}
        </div>
      ))}
      {busy && (
        <div className="mt-5 flex items-center gap-2">
          <span className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">
            DefectIQ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300/60" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300/60"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300/60"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {LANDING_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={busy}
            className="rounded-full border border-white/12 px-4 py-2 text-[12px] font-light tracking-wide text-white/60 transition-all hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-50 active:scale-[0.97]"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-1.5 transition-colors focus-within:border-cyan-300/40"
        onSubmit={e => {
          e.preventDefault();
          send(ask);
        }}
      >
        <input
          value={ask}
          onChange={e => setAsk(e.target.value)}
          placeholder="Ask about defects, machines, shifts…"
          className="w-full bg-transparent py-2 text-[14px] font-light text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || ask.trim().length === 0}
          className="rounded-full bg-cyan-400/[0.12] px-4 py-1.5 text-[12px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 disabled:opacity-40 active:scale-[0.97]"
        >
          Ask
        </button>
      </form>
      <p className="mt-4 font-data text-[11px] tracking-[0.2em] text-amber-200/70">
        Correlation ≠ Causation
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing page                                                       */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isHoveringImport, setIsHoveringImport] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "reading" | "mapping" | "analyzing" | "detected">("idle");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = rootRef.current;
      if (!el) return;
      const max = el.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function openImport() {
    setUploadOpen(true);
  }

  return (
    <div ref={rootRef} className="landing-grain lp-bg relative min-h-screen text-white">
      <LandingNav onImport={openImport} />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadStateChange={setUploadState}
        onAnalyze={() => {
          window.location.hash = "";
          window.location.href = "/app";
        }}
      />

      {/* ========================================================== */}
      {/* HERO                                                        */}
      {/* ========================================================== */}
      <section id="top" className="relative flex min-h-screen items-center overflow-hidden pt-32 pb-20">
        <div className="relative z-10 mx-auto w-full max-w-[85rem] px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 pointer-events-auto">
          
          {/* LEFT COLUMN: TEXT (55%) */}
          <div className="w-full md:w-[52%] lg:w-[55%] flex-shrink-0 relative z-20 text-left pt-10 md:pt-0">
            <p className="lp-fade-up font-data mb-8 text-[11px] uppercase tracking-[0.4em] text-cyan-300/80">
              AI-Powered Manufacturing Intelligence
            </p>
            <h1 className="lp-fade-up font-display text-[2.75rem] font-light leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[5.5rem] lg:leading-[1.02]">
              Manufacturing Data.
              <br />
              <span className="lp-text-glow text-cyan-200/95">Decoded.</span>
            </h1>
            <p className="lp-fade-up mt-8 max-w-md text-base font-light leading-relaxed text-white/55">
              Upload factory inspection data and uncover recurring defect patterns across machines, batches, shifts, and process conditions.
            </p>
            <div className="lp-fade-up mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={openImport}
                onMouseEnter={() => setIsHoveringImport(true)}
                onMouseLeave={() => setIsHoveringImport(false)}
                className="group flex items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-7 py-3.5 text-[14px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 active:scale-[0.97]"
              >
                <UploadCloud className="h-4 w-4" strokeWidth={1.5} />
                Import CSV / Excel
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </button>
              <Link
                href="/app"
                className="flex items-center gap-2 rounded-full border border-white/12 px-7 py-3.5 text-[14px] font-light tracking-wide text-white/70 transition-all hover:border-white/25 hover:text-white active:scale-[0.97]"
              >
                <FlaskConical className="h-4 w-4" strokeWidth={1.5} />
                Explore Demo
              </Link>
            </div>
            <p className="lp-fade-up mt-5 font-data text-[11px] tracking-[0.25em] text-white/35">
              CSV • XLSX • AI-assisted column mapping
            </p>
          </div>

          {/* RIGHT COLUMN: ROBOT (48%) */}
          <div className="w-full md:w-[48%] lg:w-[48%] aspect-square md:aspect-auto md:h-[70vh] lg:h-[85vh] relative z-10 flex-shrink-0 mt-8 md:mt-0">
            <Spline3DHero 
              sceneUrl="https://prod.spline.design/dzwVweTh0XfFxn7p/scene.splinecode" 
              uploadState={uploadState}
              isHovering={isHoveringImport}
            />
          </div>

        </div>
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
          <ArrowDown className="h-5 w-5 animate-bounce text-white/30" strokeWidth={1.2} />
        </div>
      </section>

      {/* ========================================================== */}
      {/* DATA TO INSIGHT VISUAL STORY                                  */}
      {/* ========================================================== */}
      <section id="product" className="relative min-h-[70vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.3} />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center px-6 py-32 text-center md:text-left">
          <Eyebrow>The Problem</Eyebrow>
          <h2 className="font-display max-w-3xl text-4xl font-light leading-[1.15] tracking-tight text-white md:text-5xl">
            Factories Generate More Data
            <br />
            Than They Can <span className="lp-cyan">Interpret.</span>
          </h2>
          <p className="mt-8 max-w-lg text-base font-light leading-relaxed text-white/55">
            Machines, batches, shifts and inspections create thousands of signals. DefectIQ turns
            them into patterns worth investigating.
          </p>
          
          <div className="mt-20 flex flex-col items-center gap-8 md:flex-row md:items-stretch w-full max-w-4xl mx-auto md:mx-0">
            {/* RAW DATA TABLE */}
            <div className="flex-1 w-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
              <p className="font-data mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40">RAW FACTORY DATA</p>
              <div className="space-y-2 font-data text-[10px] sm:text-xs text-white/60">
                <div className="grid grid-cols-4 border-b border-white/10 pb-2 text-white/40">
                  <span>MACHINE</span><span>SHIFT</span><span>TEMP</span><span>DEFECT</span>
                </div>
                <div className="grid grid-cols-4 py-1"><span>M04</span><span>A</span><span>72°C</span><span>0</span></div>
                <div className="grid grid-cols-4 py-1 text-cyan-300 font-medium"><span>M04</span><span>C</span><span>79°C</span><span>1</span></div>
                <div className="grid grid-cols-4 py-1"><span>M02</span><span>B</span><span>74°C</span><span>0</span></div>
                <div className="grid grid-cols-4 py-1 text-cyan-300 font-medium"><span>M04</span><span>C</span><span>81°C</span><span>1</span></div>
              </div>
            </div>

            {/* TRANSFORMATION */}
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-cyan-500 to-transparent md:h-px md:w-10 md:bg-gradient-to-r" />
              <Network className="h-6 w-6 text-cyan-400" strokeWidth={1.5} />
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-cyan-500 to-transparent md:h-px md:w-10 md:bg-gradient-to-r" />
            </div>

            {/* INSIGHT */}
            <div className="lp-border-glow flex-1 w-full rounded-2xl bg-cyan-950/20 p-6 backdrop-blur-md">
              <p className="font-data mb-4 text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">PATTERN DETECTED</p>
              <h3 className="font-display text-xl sm:text-2xl font-light text-white">M04 + Shift C + Temp &gt;78°C</h3>
              <div className="mt-6 flex flex-wrap gap-6">
                <div>
                  <p className="font-data text-2xl text-white">8.4%</p>
                  <p className="font-data mt-1 text-[9px] uppercase tracking-wider text-white/40">DEFECT RATE</p>
                </div>
                <div>
                  <p className="font-data text-2xl text-violet-300">4.0×</p>
                  <p className="font-data mt-1 text-[9px] uppercase tracking-wider text-white/40">BASELINE</p>
                </div>
              </div>
              <p className="mt-6 font-data text-[9px] uppercase tracking-[0.2em] text-amber-200/50 inline-block border border-amber-200/20 px-2 py-1 rounded">SAMPLE ANALYSIS</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* INTELLIGENCE                                                */}
      {/* ========================================================== */}
      <section id="intelligence" className="relative min-h-[80vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.6} highlightedNodes={["c2", "c4"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-36 text-center md:text-left">
          <Eyebrow>Intelligence</Eyebrow>
          <h2 className="font-display text-4xl font-light leading-[1.15] tracking-tight text-white md:text-5xl">
            Find The Patterns
            <br />
            Humans <span className="lp-violet">Miss.</span>
          </h2>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm hover:bg-white/[0.04] transition-colors text-left">
              <BarChart3 className="h-6 w-6 text-cyan-400 mb-4" strokeWidth={1.5} />
              <h4 className="font-display text-lg text-white">Machine Risk Ranking</h4>
              <p className="mt-2 text-sm font-light text-white/50">Identify which equipment consistently produces the highest defect rates across all shifts.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm hover:bg-white/[0.04] transition-colors text-left">
              <Network className="h-6 w-6 text-violet-400 mb-4" strokeWidth={1.5} />
              <h4 className="font-display text-lg text-white">Defect-Type Distribution</h4>
              <p className="mt-2 text-sm font-light text-white/50">Break down failures by category to understand the primary drivers of quality loss.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm hover:bg-white/[0.04] transition-colors text-left">
              <FileSpreadsheet className="h-6 w-6 text-amber-400 mb-4" strokeWidth={1.5} />
              <h4 className="font-display text-lg text-white">Machine × Shift Heatmap</h4>
              <p className="mt-2 text-sm font-light text-white/50">Visualize intersecting risk factors to isolate shift-specific or machine-specific anomalies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* DYNAMIC DATA WORKFLOW                                       */}
      {/* ========================================================== */}
      <section id="workflow" className="relative min-h-[70vh] overflow-hidden bg-white/[0.01]">
        <DefectIQScene scrollProgress={progress} parallax={0.8} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center md:text-left">
          <Eyebrow>Workflow</Eyebrow>
          <h2 className="font-display text-4xl font-light tracking-tight text-white md:text-5xl">
            From Factory Data<br />
            to <span className="lp-cyan">Defect Intelligence.</span>
          </h2>
          
          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 text-left">
            {[
              { num: "01", title: "UPLOAD", desc: "CSV / XLSX files" },
              { num: "02", title: "MAP", desc: "AI understands column names" },
              { num: "03", title: "NORMALIZE", desc: "Standardize factory data" },
              { num: "04", title: "ANALYZE", desc: "Machine × Shift × Batch × Process" },
              { num: "05", title: "DETECT", desc: "Find recurring patterns" },
              { num: "06", title: "REPORT", desc: "Dashboard + PDF export" }
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.03] transition-colors">
                <span className="font-data text-xs text-cyan-500/80 tracking-widest">{step.num}</span>
                <p className="mt-4 font-display text-xl text-white tracking-wide">{step.title}</p>
                <p className="mt-2 font-light text-sm text-white/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* AI COLUMN MAPPING                                           */}
      {/* ========================================================== */}
      <section id="mapping" className="relative min-h-[70vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.9} highlightedNodes={["c3"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center">
          <Eyebrow>Flexible Data Ingestion</Eyebrow>
          <h2 className="font-display mx-auto max-w-2xl text-4xl font-light tracking-tight text-white md:text-5xl">
            No Rigid <span className="lp-violet">Data Template.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-light text-white/60">
            DefectIQ can understand different factory naming conventions instead of requiring users to manually rename every column.
          </p>

          <div className="mt-16 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-md">
            <p className="font-data mb-8 text-[10px] uppercase tracking-[0.3em] text-violet-300">AI-ASSISTED SCHEMA MAPPING</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 font-data text-sm text-left">
              {[
                ["equipment_code", "machine_id"],
                ["production_lot", "batch_id"],
                ["work_shift", "shift"],
                ["failure_category", "defect_type"],
                ["rejected_units", "defect_count"],
                ["temp_celsius", "temperature"]
              ].map(([source, target]) => (
                <div key={source} className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-white/40">{source}</span>
                  <ArrowRight className="h-4 w-4 text-violet-400/50" />
                  <span className="text-cyan-200">{target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* EVIDENCE                                                    */}
      {/* ========================================================== */}
      <section className="relative min-h-[60vh] overflow-hidden bg-white/[0.01]">
        <DefectIQScene scrollProgress={progress} parallax={1.2} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center md:text-left">
          <Eyebrow>Data-Driven Insights</Eyebrow>
          <h2 className="font-display text-4xl font-light tracking-tight text-white md:text-5xl">
            Evidence Before <span className="lp-cyan">Assumptions.</span>
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 md:max-w-2xl mx-auto md:mx-0">
            {[
              ["OBSERVED DEFECT RATE", "8.4%"],
              ["BASELINE", "2.1%"],
              ["OBSERVATIONS", "1,842"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="font-data text-4xl font-light text-white">{value}</p>
                <p className="mt-3 font-data text-[11px] uppercase tracking-[0.25em] text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col md:flex-row items-center gap-4 justify-center md:justify-start">
            <p className="inline-block rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-5 py-2.5 font-data text-[12px] tracking-wide text-amber-200/90">
              LIFT: 4.0×
            </p>
            <p className="font-data text-[10px] uppercase tracking-[0.2em] text-white/30 border border-white/10 rounded-full px-4 py-2">
              SAMPLE ANALYSIS
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* CORRELATION != CAUSATION                                    */}
      {/* ========================================================== */}
      <section className="relative overflow-hidden py-24 border-y border-white/5">
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <h3 className="font-display text-2xl sm:text-3xl font-light text-white leading-relaxed">
            Evidence identifies what to investigate.<br />It does not prove what caused it.
          </h3>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 font-data text-xs sm:text-sm tracking-widest text-white/60">
            <span className="text-white/80">OBSERVED ASSOCIATION</span>
            <ArrowRight className="hidden sm:block h-4 w-4 text-white/20" />
            <ArrowDown className="sm:hidden h-4 w-4 text-white/20" />
            <span className="text-cyan-300">INVESTIGATE</span>
            <ArrowRight className="hidden sm:block h-4 w-4 text-white/20" />
            <ArrowDown className="sm:hidden h-4 w-4 text-white/20" />
            <span className="text-violet-300">VALIDATE</span>
          </div>
          <p className="mt-16 font-data text-[10px] sm:text-[11px] tracking-[0.2em] text-white/40 border-t border-white/10 pt-8 inline-block">
            NO WORKER-LEVEL PERFORMANCE SCORING.
          </p>
        </div>
      </section>

      {/* ========================================================== */}
      {/* REPORT PREVIEW                                              */}
      {/* ========================================================== */}
      <section className="relative min-h-[80vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={1.5} highlightedNodes={["c4", "c5"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 text-center md:text-left">
              <Eyebrow>Export & Share</Eyebrow>
              <h2 className="font-display text-4xl font-light tracking-tight text-white md:text-5xl">
                From Pattern<br />to <span className="lp-cyan">Report.</span>
              </h2>
              <p className="mt-6 text-base font-light text-white/60 leading-relaxed max-w-md mx-auto md:mx-0">
                Automatically generate polished PDF reports documenting the pattern evidence, defect trends, and recommended investigations to share with engineering teams.
              </p>
              <button
                className="mt-10 mx-auto md:mx-0 flex items-center gap-2 rounded-full border border-white/12 px-6 py-3 text-[13px] font-light tracking-wide text-white/80 transition-all hover:bg-white/5 hover:text-white"
                onClick={openImport}
              >
                <FileText className="h-4 w-4" />
                EXPORT PDF
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
            
            {/* Mockup PDF Report */}
            <div className="order-1 md:order-2 relative aspect-[1/1.4] w-full max-w-sm mx-auto rounded-xl bg-white shadow-2xl overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500 opacity-90 hover:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-black/10 pointer-events-none" />
              <div className="relative p-6 sm:p-8 text-black/80 font-sans h-full flex flex-col">
                <div className="border-b border-black/10 pb-4 mb-6">
                  <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-black">DefectIQ Analysis</h4>
                  <p className="text-[10px] text-black/50 mt-1 uppercase tracking-wider font-semibold">Executive Summary • 24,582 Inspections</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="h-2 w-3/4 bg-black/10 rounded" />
                  <div className="h-2 w-full bg-black/10 rounded" />
                  <div className="h-2 w-5/6 bg-black/10 rounded" />
                </div>
                
                <h5 className="text-[11px] font-bold text-black uppercase tracking-wider mb-3">Machine Risk & Heatmap</h5>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="h-20 bg-blue-900/10 rounded border border-blue-900/20" />
                  <div className="h-20 bg-red-900/10 rounded border border-red-900/20" />
                </div>
                
                <h5 className="text-[11px] font-bold text-black uppercase tracking-wider mb-3">Recommended Investigations</h5>
                <ul className="space-y-2 text-[10px] sm:text-xs text-black/70 list-disc pl-4">
                  <li>Verify M04 temperature calibration.</li>
                  <li>Inspect cooling performance during Shift C.</li>
                  <li>Review affected batches.</li>
                </ul>

                <div className="mt-auto border-t border-black/10 pt-4 flex justify-between items-center text-[8px] uppercase tracking-widest text-black/40 font-bold">
                  <span>CONFIDENTIAL</span>
                  <span>PAGE 1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* AI COPILOT                                                  */}
      {/* ========================================================== */}
      <section id="copilot" className="relative min-h-[50vh] overflow-hidden bg-white/[0.01]">
        <DefectIQScene scrollProgress={progress} parallax={1.8} highlightedNodes={["c6"]} />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-28 text-center md:text-left">
          <Eyebrow>AI Copilot</Eyebrow>
          <div className="lp-border-glow rounded-3xl bg-white/[0.02] p-8 backdrop-blur-sm text-left">
            <LandingCopilot />
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* FINAL CTA                                                   */}
      {/* ========================================================== */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        <DefectIQScene scrollProgress={1} parallax={2.1} bleed highlightedNodes={["c1", "c2", "c3", "c6"]} />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-40 text-center">
          <h2 className="font-display text-5xl font-light leading-[1.08] tracking-tight text-white md:text-6xl">
            Your factory already has the data.
            <br />
            Find what it's <span className="lp-text-glow lp-cyan">telling you.</span>
          </h2>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={openImport}
              className="group flex items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-8 py-4 text-[15px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 active:scale-[0.97]"
            >
              <UploadCloud className="h-5 w-5" strokeWidth={1.5} />
              Upload Factory Data
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </button>
          </div>
          <p className="mt-8 font-data text-[11px] tracking-[0.25em] text-white/40">
            CSV • XLSX • Dynamic Analysis • Evidence-backed Reports
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-[12px] font-light text-white/35 md:flex-row">
          <span className="font-display tracking-[0.2em]">DEFECTIQ</span>
          <span className="font-data tracking-[0.15em]">Association ≠ Causation</span>
        </div>
      </footer>
    </div>
  );
}
