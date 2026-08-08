import DashboardLayout from "@/components/DashboardLayout";
import type { ReactNode } from "react";

/**
 * Single shared layout: sidebar navigation + content inset. DataIngestion
 * shows the dataset landing state when no dataset is loaded.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout>
      <div className="min-h-full">{children}</div>
    </DashboardLayout>
  );
}
