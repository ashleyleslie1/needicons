import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
