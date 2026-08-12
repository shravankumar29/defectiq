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
        <Route path={"/"}>
          <AppShell><Landing /></AppShell>
        </Route>

        {/* App workspace sub-pages */}
        <Route path={"/app"}>
          <AppShell><Overview /></AppShell>
        </Route>
        <Route path={"/app/ingest"}>
          <AppShell><DataIngestion /></AppShell>
        </Route>
        <Route path={"/app/patterns"}>
          <AppShell><PatternDiscovery /></AppShell>
        </Route>
        <Route path={"/app/machines"}>
          <AppShell><MachineAnalysis /></AppShell>
        </Route>
        <Route path={"/app/shifts"}>
          <AppShell><ShiftAnalysis /></AppShell>
        </Route>
        <Route path={"/app/batches"}>
          <AppShell><BatchAnalysis /></AppShell>
        </Route>
        <Route path={"/app/investigation"}>
          <AppShell><DefectInvestigation /></AppShell>
        </Route>
        <Route path={"/app/anomalies"}>
          <AppShell><AnomalyDetection /></AppShell>
        </Route>
        <Route path={"/app/recommendations"}>
          <AppShell><Recommendations /></AppShell>
        </Route>
        <Route path={"/app/copilot"}>
          <AppShell><Copilot /></AppShell>
        </Route>
        <Route path={"/app/clustering"}>
          <AppShell><Clustering /></AppShell>
        </Route>
        <Route path={"/app/reports"}>
          <AppShell><Reports /></AppShell>
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
