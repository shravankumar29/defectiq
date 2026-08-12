import { PageHeader } from "@/components/analysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { AlertTriangle, FileDown, FileText, Table, Activity, Layers, Factory, Clock3, CheckCircle2, ChevronRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import withDataset from "@/components/withDataset";
import { trpc } from "@/lib/trpc";

function ReportsPage({ results: _results }: { results: any; uploadCsv?: any }) {
  const { downloadReport, results } = useAnalysis();
  
  const hasData = Boolean((results as any)?.kpis?.inspections || (results as any)?.kpis?.total_inspections);
  
  const { data: patternsData, isLoading: patternsLoading } = trpc.engine.patterns.useQuery(undefined, {
    staleTime: Infinity,
    enabled: hasData,
  });

  const recs = ((patternsData as any)?.recommendations ?? []) as any[];
  const patterns = ((patternsData as any)?.patterns ?? []) as any[];
  
  const kpis = ((results as any)?.kpis ?? {}) as any;
  const defectTypes = ((results as any)?.defect_types ?? []) as string[];

  const overviewKpis = {
    inspections: kpis.total_inspections ?? kpis.inspections,
    defectRate: kpis.defect_rate_pct,
    topMachine: kpis.highest_risk_machine,
    topShift: kpis.highest_risk_shift,
  };
  
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [reportState, setReportState] = useState<"READY" | "GENERATING" | "GENERATED" | "ERROR">(hasData ? "READY" : "ERROR");

  async function onDownload(format: "pdf" | "csv") {
    try {
      if (format === "pdf") setLoadingPdf(true);
      else setLoadingCsv(true);
      setReportState("GENERATING");
      
      await downloadReport(format);
      
      setReportState("GENERATED");
      toast.success(`${format.toUpperCase()} report downloaded`);
      
      // Reset state after a few seconds
      setTimeout(() => setReportState("READY"), 3000);
    } catch (e) {
      setReportState("ERROR");
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoadingPdf(false);
      setLoadingCsv(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 2xl:px-12 max-w-[1600px] mx-auto space-y-8">
      {/* 2. HERO HEADER */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.2em] text-primary/80 uppercase">Investigation • Export</span>
        <PageHeader
          title="Investigation Report Center"
          subtitle="Generate a structured investigation report containing the key findings, detected patterns, anomalies, machine analysis, and recommended actions."
        />
      </div>

      {/* 4. TOP SUMMARY STRIP (Dataset / Report Metadata) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 3. REPORT STATUS CARD */}
        <Card className="border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Report Status</span>
            </div>
            <div className="flex items-center gap-2">
              {hasData ? (
                <>
                  <div className={`h-2.5 w-2.5 rounded-full ${reportState === "GENERATING" ? "bg-amber-400 animate-pulse" : reportState === "ERROR" ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"}`} />
                  <span className="font-data text-lg font-semibold tracking-tight">
                    {reportState === "GENERATING" ? "GENERATING..." : reportState === "ERROR" ? "FAILED" : "ANALYSIS READY"}
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                  <span className="font-data text-lg font-semibold tracking-tight text-muted-foreground">WAITING FOR DATA</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dataset</span>
            </div>
            <span className="font-data text-lg font-semibold tracking-tight text-primary">
              {hasData ? `${Number(overviewKpis.inspections)?.toLocaleString()} rows` : "—"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Findings</span>
            </div>
            <span className="font-data text-lg font-semibold tracking-tight">
              {patternsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : hasData ? (
                `${patterns.length} patterns detected`
              ) : (
                "—"
              )}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Defect Types</span>
            </div>
            <span className="font-data text-lg font-semibold tracking-tight">
              {hasData ? defectTypes.length : "—"}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">
        {/* LEFT COLUMN: 5. EXPORT ACTION AREA & 8. WHAT'S INCLUDED */}
        <div className="space-y-6">
          
          <Card className="border-primary/20 bg-secondary/10 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/80 to-primary/20"></div>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">Investigation Report</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Complete statistical investigation of the uploaded manufacturing dataset. Export the findings for external review.
              </p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  size="lg" 
                  className="w-full justify-start gap-3 transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:border-primary/50 relative overflow-hidden" 
                  onClick={() => onDownload("pdf")} 
                  disabled={loadingPdf || loadingCsv || !hasData}
                >
                  {loadingPdf ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : reportState === "GENERATED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <FileDown className="h-5 w-5 group-hover:-translate-y-0.5 transition-transform" />
                  )}
                  
                  <span className="font-medium text-[15px]">
                    {loadingPdf ? "Generating Report..." : reportState === "GENERATED" ? "Report Generated" : "Export PDF Report"}
                  </span>
                  
                  {!loadingPdf && reportState !== "GENERATED" && (
                    <ChevronRight className="h-4 w-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full justify-start gap-3 transition-colors hover:border-primary/40 hover:bg-primary/5" 
                  onClick={() => onDownload("csv")} 
                  disabled={loadingPdf || loadingCsv || !hasData}
                >
                  {loadingCsv ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Table className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium text-[15px]">Export CSV Data</span>
                </Button>
              </div>
              
              {reportState === "ERROR" && (
                <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Report generation failed. Please try again.</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-4">What's Included</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
              {[
                "Executive summary",
                "Defect distribution",
                "Machine analysis",
                "Shift & batch analysis",
                "Pattern detection",
                "Anomaly detection",
                "Recommended actions",
                "Statistical evidence"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground/80">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 6. & 7. REPORT CONTENT PREVIEW */}
        <div className="flex flex-col h-full">
          <div className="flex-1 rounded-xl border border-border/60 bg-[#0f1115] shadow-2xl overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group relative">
            {/* Document styling accents */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/40"></div>
            
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-10 opacity-70">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold tracking-widest text-primary uppercase">DefectIQ</span>
                <span className="text-xs tracking-widest text-muted-foreground uppercase ml-auto">Manufacturing Investigation Report</span>
              </div>

              {hasData ? (
                <div className="space-y-10 animate-in fade-in duration-700">
                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Executive Summary</h2>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      Analysis of {Number(overviewKpis.inspections)?.toLocaleString()} inspections revealed an overall defect rate of <span className="text-primary font-data font-medium">{Number(overviewKpis.defectRate)?.toFixed(2)}%</span>.
                      The highest risk areas were identified as Machine <span className="text-primary font-data font-medium">{String(overviewKpis.topMachine ?? "—")}</span> and Shift <span className="text-primary font-data font-medium">{String(overviewKpis.topShift ?? "—")}</span>.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Key Findings</h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground mb-1"><Activity className="h-3 w-3" /> Inspections</div>
                        <div className="font-data text-xl">{Number(overviewKpis.inspections)?.toLocaleString()}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground mb-1"><Layers className="h-3 w-3" /> Defect rate</div>
                        <div className="font-data text-xl text-primary">{Number(overviewKpis.defectRate)?.toFixed(2)}%</div>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground mb-1"><Factory className="h-3 w-3" /> Top Machine</div>
                        <div className="font-data text-xl">{String(overviewKpis.topMachine ?? "—")}</div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Detected Patterns</h2>
                    <ul className="space-y-3">
                      {patterns.slice(0, 3).map((p, i) => (
                        <li key={i} className="flex gap-3 text-sm text-foreground/80">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{p.description ?? p.pattern_text ?? "Pattern detected"} (Lift: <span className="font-data">{Number(p.lift).toFixed(1)}x</span>)</span>
                        </li>
                      ))}
                      {patterns.length > 3 && (
                        <li className="text-xs text-muted-foreground italic pl-5">+ {patterns.length - 3} more patterns...</li>
                      )}
                      {patterns.length === 0 && !patternsLoading && (
                        <li className="text-sm text-muted-foreground italic pl-5">
                          No statistically significant patterns detected.
                          <br />
                          <span className="text-xs opacity-70 mt-1 block">Analyzed multiple candidate combinations across parameters.</span>
                        </li>
                      )}
                      {patternsLoading && (
                        <li className="text-sm text-muted-foreground italic pl-5 flex items-center gap-2">
                           <Loader2 className="h-3 w-3 animate-spin" /> Mining patterns...
                        </li>
                      )}
                    </ul>
                  </section>
                </div>
              ) : (
                <div className="space-y-10 opacity-30 select-none">
                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Executive Summary</h2>
                    <div className="space-y-2">
                      <div className="h-3 bg-secondary rounded w-full"></div>
                      <div className="h-3 bg-secondary rounded w-[90%]"></div>
                      <div className="h-3 bg-secondary rounded w-[75%]"></div>
                    </div>
                  </section>
                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Key Findings</h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-20 rounded-lg bg-secondary/30 border border-border/30"></div>
                      <div className="h-20 rounded-lg bg-secondary/30 border border-border/30"></div>
                      <div className="h-20 rounded-lg bg-secondary/30 border border-border/30"></div>
                    </div>
                  </section>
                  <section>
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 pb-2 border-b border-border/50">Detected Patterns</h2>
                    <div className="space-y-3">
                      <div className="h-3 bg-secondary rounded w-[60%]"></div>
                      <div className="h-3 bg-secondary rounded w-[80%]"></div>
                      <div className="h-3 bg-secondary rounded w-[50%]"></div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
          
          {/* 9. STATISTICAL DISCLAIMER (Single Warning) */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 max-w-3xl">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <p>
              <strong className="font-semibold text-amber-400">Statistical interpretation: </strong> 
              Findings describe statistical associations in inspection data and do not establish causation. Validate important findings through targeted investigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withDataset(ReportsPage);
