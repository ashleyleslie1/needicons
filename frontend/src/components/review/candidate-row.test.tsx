import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CandidateRow } from "./candidate-row";
import type { Requirement } from "@/lib/types";

const reqWithCandidates: Requirement = {
  id: "r1",
  name: "tent",
  description: null,
  status: "generated",
  candidates: [
    { id: "c1", requirement_id: "r1", source_path: "a.png", preview_path: "", origin: "single", selected: false },
    { id: "c2", requirement_id: "r1", source_path: "b.png", preview_path: "", origin: "single", selected: true },
  ],
};

function renderWithProviders(req: Requirement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CandidateRow requirement={req} />
    </QueryClientProvider>
  );
}

test("shows requirement name", () => {
  renderWithProviders(reqWithCandidates);
  expect(screen.getByText("tent")).toBeInTheDocument();
});

test("shows accepted badge when candidate is selected", () => {
  renderWithProviders(reqWithCandidates);
  expect(screen.getByText("accepted")).toBeInTheDocument();
});

test("shows candidate count", () => {
  renderWithProviders(reqWithCandidates);
  expect(screen.getByText("2 candidates")).toBeInTheDocument();
});
