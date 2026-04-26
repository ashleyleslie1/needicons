import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/ui/use-theme";
import { SidebarProvider } from "@/hooks/ui/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home";
import { SettingsPage } from "@/pages/settings";
import { recreatePool } from "@/lib/recreate-pool";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Recreate (add-variation) requests live outside any component's lifecycle
// so closing the image modal mid-generation doesn't cancel a billed call.
recreatePool.setQueryClient(queryClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SidebarProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/generate" element={<Navigate to="/" replace />} />
                  <Route path="/project" element={<Navigate to="/" replace />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/:tab" element={<SettingsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
