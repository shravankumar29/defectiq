import { AlertTriangle } from "lucide-react";

/**
 * Amber, persistent banner required on every finding card and every
 * AI-generated answer. Correlations are not causation.
 */
export function CorrelationCausationBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p className={compact ? "text-xs leading-snug" : "text-xs leading-snug"}>
        <span className="font-semibold text-amber-300">Correlation is not causation.</span>{" "}
        All findings on this platform reflect statistical associations, not proven causes.
        Investigate — do not conclude.
      </p>
    </div>
  );
}
