import { useEffect, useRef, useState } from "react";
import DefectIQScene from "@/components/DefectIQScene";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowDown,
  UploadCloud,
  FileSpreadsheet,
  FlaskConical,
  Play,
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
            {["Product", "Intelligence", "Data", "How It Works"].map(item => (
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
}: {
  open: boolean;
  onClose: () => void;
  onAnalyze: () => void;
}) {
  const { uploadCsv, generate, resultsLoading } = useAnalysis();
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setState("idle");
      setDragOver(false);
    }
  }, [open]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  async function handleFile(file: File) {
    const text = await file.text();
    const b64 = btoa(
      text.split("").map(c => c.charCodeAt(0)).join("")
    );
    try {
      const res = await uploadCsv(b64);
      toast.success(`Imported ${res.rows?.toLocaleString?.() ?? 0} inspections`);
      setState("done");
    } catch {
      toast.error("Could not read that file. Please use a CSV with the required columns.");
    }
  }

  async function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  }

  async function handleDemo() {
    try {
      await generate();
      toast.success("Demo dataset generated");
      setState("done");
    } catch {
      toast.error("Could not generate the demo dataset.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="lp-border-glow relative w-full max-w-lg rounded-2xl bg-[#0a0c12]/95 p-8 backdrop-blur-xl">
        {state === "idle" ? (
          <>
            <p className="font-data mb-1 text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
              Import Experience
            </p>
            <h3 className="font-display mb-6 text-2xl font-light tracking-wide text-white">
              Upload Factory Data
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
                Supported: .csv &nbsp; .xlsx
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
            <div className="grid grid-cols-2 gap-3">
              {[
                ["24,582 INSPECTIONS", "24582"],
                ["5 MACHINES", "5"],
                ["32 BATCHES", "32"],
                ["3 SHIFTS", "3"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5"
                >
                  <p className="font-data text-lg font-medium text-white">{value}</p>
                  <p className="font-data mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                onClose();
                onAnalyze();
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400/[0.12] px-5 py-3 text-[13px] font-light tracking-wide text-cyan-100 transition-all hover:bg-cyan-400/20 active:scale-[0.97]"
            >
              Analyze Dataset
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
          onAnalyze={() => {
            window.location.hash = "";
            window.location.href = "/app";
          }}
      />

      {/* ========================================================== */}
      {/* HERO                                                        */}
      {/* ========================================================== */}
      <section id="top" className="relative flex min-h-screen items-center overflow-hidden">
        <DefectIQScene
          scrollProgress={progress}
          parallax={0}
          bleed
          highlightedNodes={["c3", "c1"]}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 pt-40">
          <p className="lp-fade-up font-data mb-8 text-[11px] uppercase tracking-[0.4em] text-cyan-300/80">
            AI-Powered Manufacturing Intelligence
          </p>
          <h1 className="lp-fade-up font-display text-[2.75rem] font-light leading-[1.08] tracking-tight text-white sm:text-6xl md:text-[5.5rem] md:leading-[1.02]">
            Manufacturing Data.
            <br />
            <span className="lp-text-glow text-cyan-200/95">Decoded.</span>
          </h1>
          <p className="lp-fade-up mt-8 max-w-md text-base font-light leading-relaxed text-white/55">
            Discover hidden defect patterns across machines, batches, shifts, and process
            conditions.
          </p>
          <div className="lp-fade-up mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button
              onClick={openImport}
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
              Analyze Demo
            </Link>
          </div>
          <p className="lp-fade-up mt-5 font-data text-[11px] tracking-[0.25em] text-white/35">
            CSV + XLSX supported
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
          <ArrowDown className="h-5 w-5 animate-bounce text-white/30" strokeWidth={1.2} />
        </div>
      </section>

      {/* ========================================================== */}
      {/* PROBLEM                                                     */}
      {/* ========================================================== */}
      <section id="product" className="relative min-h-[70vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.3} />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center px-6 py-32">
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
        </div>
      </section>

      {/* ========================================================== */}
      {/* INTELLIGENCE                                                */}
      {/* ========================================================== */}
      <section id="intelligence" className="relative min-h-[80vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.6} highlightedNodes={["c2", "c4"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-36">
          <div className="grid items-center gap-14 md:grid-cols-[1.2fr_1fr]">
            <div>
              <Eyebrow>Intelligence</Eyebrow>
              <h2 className="font-display text-4xl font-light leading-[1.15] tracking-tight text-white md:text-5xl">
                Find The Patterns
                <br />
                Humans <span className="lp-violet">Miss.</span>
              </h2>
              <div className="mt-12 font-data text-sm tracking-[0.3em] text-white/50">
                <div className="flex flex-wrap items-center gap-4">
                  <span>MACHINE</span>
                  <span className="lp-cyan">+</span>
                  <span>SHIFT</span>
                  <span className="lp-cyan">+</span>
                  <span>BATCH</span>
                  <span className="lp-cyan">+</span>
                  <span>PROCESS</span>
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <ArrowDown className="h-4 w-4 lp-cyan" strokeWidth={1.5} />
                  <span className="border-b border-cyan-300/40 pb-1 text-cyan-200/90">
                    DEFECT PATTERN
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:block" />
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* PATTERN                                                     */}
      {/* ========================================================== */}
      <section id="data" className="relative min-h-[70vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={0.9} highlightedNodes={["c3"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-36">
          <Eyebrow>Pattern Insight</Eyebrow>
          <p className="font-data mb-3 text-[11px] uppercase tracking-[0.3em] text-violet-300/80">
            High-Priority Pattern
          </p>
          <h3 className="font-display text-3xl font-light tracking-wide text-white md:text-4xl">
            M04 + Shift C + Temp &gt;78°C
          </h3>
          <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              ["SURFACE DEFECTS", "Dominant type", "lp-cyan"],
              ["8.4% DEFECT RATE", "In this condition", "text-white"],
              ["4.0× BASELINE", "Elevated risk", "lp-violet"],
            ].map(([title, sub, cls]) => (
              <div
                key={title}
                className="lp-border-glow rounded-2xl bg-white/[0.02] px-6 py-7 backdrop-blur-sm"
              >
                <p className={`font-display text-2xl font-light tracking-wide ${cls}`}>{title}</p>
                <p className="mt-2 font-data text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* EVIDENCE                                                    */}
      {/* ========================================================== */}
      <section className="relative min-h-[60vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={1.2} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-32">
          <h2 className="font-display text-4xl font-light tracking-tight text-white md:text-5xl">
            Evidence Before <span className="lp-cyan">Assumptions.</span>
          </h2>
          <div className="mt-14 grid grid-cols-3 gap-6 md:max-w-2xl">
            {[
              ["DEFECT RATE", "8.4%"],
              ["BASELINE", "2.1%"],
              ["OBSERVATIONS", "1,842"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="font-data text-3xl font-light text-white">{value}</p>
                <p className="mt-2 font-data text-[11px] uppercase tracking-[0.25em] text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 inline-block rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-5 py-2.5 font-data text-[12px] tracking-wide text-amber-200/90">
            Association detected. Causation is not established.
          </p>
        </div>
      </section>

      {/* ========================================================== */}
      {/* ACTION                                                      */}
      {/* ========================================================== */}
      <section id="how-it-works" className="relative min-h-[70vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={1.5} highlightedNodes={["c4", "c5"]} />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-36">
          <Eyebrow>Recommended Investigation</Eyebrow>
          <h2 className="font-display text-4xl font-light tracking-tight text-white md:text-5xl">
            Turn Patterns Into <span className="lp-cyan">Action.</span>
          </h2>
          <div className="mt-14 space-y-4 md:max-w-xl">
            {[
              "Verify M04 temperature calibration.",
              "Inspect cooling performance during Shift C.",
              "Review affected batches.",
            ].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-5 rounded-xl border border-white/8 bg-white/[0.02] px-6 py-4"
              >
                <span className="font-data text-sm text-cyan-300/70">0{i + 1}</span>
                <span className="text-[15px] font-light text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* AI COPILOT                                                  */}
      {/* ========================================================== */}
      <section className="relative min-h-[50vh] overflow-hidden">
        <DefectIQScene scrollProgress={progress} parallax={1.8} highlightedNodes={["c6"]} />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-28">
          <Eyebrow>AI Copilot</Eyebrow>
          <div className="lp-border-glow rounded-3xl bg-white/[0.02] p-8 backdrop-blur-sm">
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
            Your Factory Data
            <br />
            Already Contains <span className="lp-text-glow lp-cyan">The Clues.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-md text-base font-light leading-relaxed text-white/55">
            Upload your inspection data and discover the patterns worth investigating.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={openImport}
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
