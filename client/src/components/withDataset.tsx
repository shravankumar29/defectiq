import { AnalysisEmpty } from "@/components/analysis";
import { useAnalysis } from "@/contexts/AnalysisContext";
import type { ComponentType } from "react";
import type { RouteComponentProps } from "wouter";

/**
 * Wraps a page: shows the dataset landing state until a dataset is loaded,
 * then renders the page with the engine results.
 */
export default function withDataset<P extends object>(
  Page: ComponentType<P & { results: any; uploadCsv?: (csv: string) => Promise<{ rows: number; defect_rate_pct: number }> }>
) {
  function DatasetGuardedPage(props: RouteComponentProps<any> & P) {
    const { results: _r, uploadCsv: _u, ...rest } = props as any;
    const { status, statusLoading, results, resultsLoading, generate, uploadCsv } = useAnalysis();

    if (statusLoading) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
    }

    if (status?.loaded !== true) {
      return (
        <div className="p-2">
          <AnalysisEmpty onGenerate={generate} />
        </div>
      );
    }

    if (resultsLoading || !results) {
      return (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Running analysis — this usually takes a few seconds…
        </div>
      );
    }

    return <Page {...(rest as P)} results={results} uploadCsv={uploadCsv} />;
  }

  return DatasetGuardedPage as unknown as ComponentType<any>;
}
