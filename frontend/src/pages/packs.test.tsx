import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/ui/use-theme";
import { SidebarProvider } from "@/hooks/ui/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PacksPage } from "./packs";

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SidebarProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={["/packs"]}>
              <PacksPage />
            </MemoryRouter>
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

test("renders packs heading", () => {
  renderWithProviders();
  expect(screen.getByText("Packs")).toBeInTheDocument();
});

test("shows pack from API", async () => {
  renderWithProviders();
  expect(await screen.findByText("Test Pack")).toBeInTheDocument();
});
