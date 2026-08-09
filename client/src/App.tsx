import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import { AnalysisProvider } from "./contexts/AnalysisContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AnomalyDetection from "./pages/AnomalyDetection";
import BatchAnalysis from "./pages/BatchAnalysis";
import Clustering from "./pages/Clustering";
import Copilot from "./pages/Copilot";
import DataIngestion from "./pages/DataIngestion";
import DefectInvestigation from "./pages/DefectInvestigation";
import ErrorBoundary from "./components/ErrorBoundary";
import Landing from "./pages/Landing";
import MachineAnalysis from "./pages/MachineAnalysis";
import Overview from "./pages/Overview";
import PatternDiscovery from "./pages/PatternDiscovery";
import Recommendations from "./pages/Recommendations";
import Reports from "./pages/Reports";
import ShiftAnalysis from "./pages/ShiftAnalysis";
import AppShell from "./components/AppShell";

function Router() {
  return (
    <AnalysisProvider>
      <Switch>
        {/* Public cinematic landing page */}
        <Route path={"/"} component={Landing} />

        {/* App workspace, prefixed so the landing page keeps the root path */}
        <Route path={"/app"} nest>
          <AppShell>
            <Switch>
              <Route path={"/"} component={Overview} />
              <Route path={"/ingest"} component={DataIngestion} />
              <Route path={"/patterns"} component={PatternDiscovery} />
              <Route path={"/machines"} component={MachineAnalysis} />
              <Route path={"/shifts"} component={ShiftAnalysis} />
              <Route path={"/batches"} component={BatchAnalysis} />
              <Route path={"/investigation"} component={DefectInvestigation} />
              <Route path={"/anomalies"} component={AnomalyDetection} />
              <Route path={"/recommendations"} component={Recommendations} />
              <Route path={"/copilot"} component={Copilot} />
              <Route path={"/clustering"} component={Clustering} />
              <Route path={"/reports"} component={Reports} />
              <Route path={"/404"} component={NotFound} />
              <Redirect to={"/app"} />
            </Switch>
          </AppShell>
        </Route>

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AnalysisProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
