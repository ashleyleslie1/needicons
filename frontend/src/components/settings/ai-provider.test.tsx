import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiProviderSettings } from "./ai-provider";

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AiProviderSettings /></QueryClientProvider>);
}

test("shows AI Provider heading", () => {
  renderWithProviders();
  expect(screen.getByText("AI Provider")).toBeInTheDocument();
});

test("shows key status after loading", async () => {
  renderWithProviders();
  expect(await screen.findByText(/key verified/i)).toBeInTheDocument();
});

test("shows model options", async () => {
  renderWithProviders();
  expect(await screen.findByText("GPT-4o")).toBeInTheDocument();
  expect(screen.getByText("DALL-E 3")).toBeInTheDocument();
});
