import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  HelpCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

export interface ColumnMappingItem {
  original_column: string;
  mapped_field: string | null;
  confidence: number;
  confidence_label: string;
  stage: string;
  sample_values: string[];
  reasoning?: string;
}

export interface SchemaAnalysisResult {
  total_rows: number;
  total_cols: number;
  columns_detected: number;
  columns_used: number;
  columns_ignored: number;
  column_mappings: ColumnMappingItem[];
  derived_fields: { field: string; reasoning: string; formula?: string }[];
  missing_required: string[];
  can_auto_proceed: boolean;
  sample_rows?: any[];
}

const CANONICAL_OPTIONS = [
  { value: "timestamp", label: "Timestamp / Date (Required)", group: "Required" },
  { value: "machine_id", label: "Machine ID (Required)", group: "Required" },
  { value: "batch_id", label: "Batch / Lot ID (Required)", group: "Required" },
  { value: "shift", label: "Shift (Required)", group: "Required" },
  { value: "defect_type", label: "Defect Type (Required)", group: "Required" },
  { value: "defect_count", label: "Defect Count (Required)", group: "Required" },
  { value: "units_inspected", label: "Units Inspected (Optional)", group: "Optional" },
  { value: "temperature", label: "Temperature °C (Optional)", group: "Optional" },
  { value: "pressure", label: "Pressure bar (Optional)", group: "Optional" },
  { value: "speed", label: "Speed / RPM (Optional)", group: "Optional" },
  { value: "vibration", label: "Vibration Level (Optional)", group: "Optional" },
  { value: "humidity", label: "Humidity % (Optional)", group: "Optional" },
  { value: "__IGNORE__", label: "[ Ignore / Do Not Map ]", group: "Action" },
];

interface SchemaMappingModalProps {
  open: boolean;
  fileName: string;
  analysis: SchemaAnalysisResult | null;
  onConfirm: (mappings: Record<string, string | null>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SchemaMappingModal({
  open,
  fileName,
  analysis,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: SchemaMappingModalProps) {
  const [userMappings, setUserMappings] = useState<Record<string, string | null>>({});
  const [stepIdx, setStepIdx] = useState(0);

  const loadingSteps = [
    "Understanding your dataset...",
    "Mapping columns...",
    "Analyzing inspection data...",
    "Discovering patterns...",
    "Generating insights...",
    "Analysis complete."
  ];

  useEffect(() => {
    if (isSubmitting) {
      setStepIdx(0);
      const iv = setInterval(() => {
        setStepIdx((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 700);
      return () => clearInterval(iv);
    }
  }, [isSubmitting]);

  useEffect(() => {
    if (analysis?.column_mappings) {
      const initial: Record<string, string | null> = {};
      analysis.column_mappings.forEach((item) => {
        initial[item.original_column] = item.mapped_field;
      });
      setUserMappings(initial);
    }
  }, [analysis]);

  if (!analysis) return null;

  const handleMappingChange = (originalCol: string, val: string) => {
    setUserMappings((prev) => ({
      ...prev,
      [originalCol]: val === "__IGNORE__" ? null : val,
    }));
  };

  // Check currently selected required fields
  const selectedCanonicalValues = new Set(Object.values(userMappings).filter(Boolean));
  const missingRequired = ["timestamp", "machine_id", "batch_id", "shift", "defect_type", "defect_count"].filter(
    (req) => !selectedCanonicalValues.has(req) && !analysis.derived_fields.some((d) => d.field === req)
  );

  const mappedCount = Object.values(userMappings).filter(Boolean).length;
  const ignoredCount = Object.keys(userMappings).length - mappedCount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 text-slate-100 border-slate-800 shadow-2xl z-[200]">

        <DialogHeader className="pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono tracking-wider uppercase">
            <Sparkles className="h-4 w-4" />
            AI Data Schema Mapping Layer
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileCheck className="h-6 w-6 text-emerald-400" />
            WE UNDERSTOOD YOUR DATA
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Review how DefectIQ mapped columns from <span className="font-semibold text-slate-200">{fileName}</span> to our canonical schema. You can adjust any mapping manually.
          </DialogDescription>
        </DialogHeader>

        {/* Dataset Transparency Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 px-4 bg-slate-900/80 rounded-lg border border-slate-800 text-xs font-mono">
          <div>
            <div className="text-slate-500 uppercase">Dataset Rows</div>
            <div className="text-base font-bold text-emerald-400">{analysis.total_rows.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase">Columns Detected</div>
            <div className="text-base font-bold text-white">{analysis.total_cols}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase">Columns Mapped</div>
            <div className="text-base font-bold text-cyan-400">{mappedCount}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase">Columns Ignored</div>
            <div className="text-base font-bold text-slate-400">{ignoredCount}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase">Derived Fields</div>
            <div className="text-base font-bold text-amber-400">{analysis.derived_fields.length}</div>
          </div>
        </div>

        {/* Warnings / Alerts */}
        {missingRequired.length > 0 && (
          <Alert className="bg-amber-950/40 border-amber-800/80 text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="font-semibold">Missing Required Field Confirmation</AlertTitle>
            <AlertDescription className="text-xs text-amber-300/90 mt-1">
              We couldn't automatically match the following required field(s):{" "}
              <span className="font-bold underline">{missingRequired.join(", ")}</span>. Please map them to a column below or continue to auto-derive standard defaults.
            </AlertDescription>
          </Alert>
        )}

        {analysis.derived_fields.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {analysis.derived_fields.map((df, i) => (
              <Badge key={i} variant="outline" className="bg-cyan-950/40 border-cyan-700 text-cyan-300 font-mono py-1">
                ⚡ Derived: {df.field} ({df.reasoning})
              </Badge>
            ))}
          </div>
        )}

        {/* Schema Mapping Table */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[420px] border border-slate-800 rounded-lg p-2 bg-slate-900/30">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Uploaded Column</th>
                <th className="py-2.5 px-3">Sample Values</th>
                <th className="py-2.5 px-3">DefectIQ Canonical Field</th>
                <th className="py-2.5 px-3">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analysis.column_mappings.map((item, idx) => {
                const currentVal = userMappings[item.original_column] ?? "__IGNORE__";
                const isMapped = currentVal !== "__IGNORE__";

                return (
                  <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200 font-mono">
                      {item.original_column}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {item.sample_values.slice(0, 3).map((sv, sidx) => (
                          <span
                            key={sidx}
                            className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[11px] truncate max-w-[90px]"
                            title={sv}
                          >
                            {sv}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 min-w-[220px]">
                      <Select
                        value={currentVal}
                        onValueChange={(val) => handleMappingChange(item.original_column, val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-100">
                          <SelectValue placeholder="Select target field..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-60">
                          {CANONICAL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2.5 px-3">
                      {!isMapped ? (
                        <Badge variant="outline" className="border-slate-700 text-slate-500 bg-slate-900/50">
                          IGNORED
                        </Badge>
                      ) : item.confidence >= 0.9 ? (
                        <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-700 font-mono">
                          HIGH CONFIDENCE
                        </Badge>
                      ) : item.confidence >= 0.75 ? (
                        <Badge className="bg-amber-950/80 text-amber-300 border border-amber-700 font-mono">
                          MEDIUM CONFIDENCE
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-950/80 text-rose-300 border border-rose-700 font-mono">
                          LOW CONFIDENCE
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isSubmitting && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 space-y-4">
            <div className="relative">
              <RefreshCw className="h-12 w-12 text-sky-400 animate-spin" />
              <Sparkles className="h-5 w-5 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 tracking-tight">Processing Inspection Data</h3>
            <p className="text-sm text-sky-400 font-mono animate-pulse font-semibold">
              {loadingSteps[stepIdx]}
            </p>
            <div className="w-64 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full transition-all duration-500 ease-out"
                style={{ width: `${((stepIdx + 1) / loadingSteps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-800 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="text-slate-400 hover:text-white">
            Cancel &amp; Choose File
          </Button>
          <Button
            onClick={() => onConfirm(userMappings)}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 px-6"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {loadingSteps[stepIdx]}
              </>
            ) : (
              <>
                Confirm &amp; Analyze Dataset
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
