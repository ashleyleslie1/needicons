import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiKeyModal } from "./api-key-modal";

function renderWithProviders(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = { open: true, onClose: vi.fn(), onSaved: vi.fn(), ...props };
  return render(
    <QueryClientProvider client={qc}><ApiKeyModal {...defaultProps} /></QueryClientProvider>
  );
}

test("shows API key prompt", () => {
  renderWithProviders();
  expect(screen.getByText("API Key Required")).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/sk-/i)).toBeInTheDocument();
});

test("shows model options", () => {
  renderWithProviders();
  expect(screen.getByText("GPT-4o")).toBeInTheDocument();
  expect(screen.getByText("DALL-E 3")).toBeInTheDocument();
});

test("save button disabled when no key entered", () => {
  renderWithProviders();
  expect(screen.getByRole("button", { name: /save & generate/i })).toBeDisabled();
});
