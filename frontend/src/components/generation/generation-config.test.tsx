import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GenerationConfig } from "./generation-config";
import { SidebarProvider } from "@/hooks/ui/use-sidebar";

function renderWithProviders(props: Partial<React.ComponentProps<typeof GenerationConfig>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = { selectedCount: 6, onGenerate: vi.fn(), isGenerating: false, ...props };
  return render(
    <QueryClientProvider client={qc}>
      <SidebarProvider>
        <GenerationConfig {...defaultProps} />
      </SidebarProvider>
    </QueryClientProvider>
  );
}

test("shows generate button with icon count", () => {
  renderWithProviders({ selectedCount: 6 });
  expect(screen.getByRole("button", { name: /generate 6 icons/i })).toBeInTheDocument();
});

test("shows cost estimate", () => {
  renderWithProviders({ selectedCount: 6 });
  expect(screen.getByText(/est\. cost/i)).toBeInTheDocument();
});

test("generate button is disabled when generating", () => {
  renderWithProviders({ isGenerating: true });
  expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
});
