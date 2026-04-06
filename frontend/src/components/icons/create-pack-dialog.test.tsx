import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CreatePackDialog } from "./create-pack-dialog";

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CreatePackDialog />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

test("opens dialog and shows form", async () => {
  const user = userEvent.setup();
  renderWithProviders();
  await user.click(screen.getByRole("button", { name: /new pack/i }));
  expect(screen.getByText("New Icon Pack")).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/camping app/i)).toBeInTheDocument();
});

test("create button is disabled when name is empty", async () => {
  const user = userEvent.setup();
  renderWithProviders();
  await user.click(screen.getByRole("button", { name: /new pack/i }));
  expect(screen.getByRole("button", { name: /create pack/i })).toBeDisabled();
});
