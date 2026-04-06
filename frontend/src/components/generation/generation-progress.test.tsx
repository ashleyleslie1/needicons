import { render, screen } from "@testing-library/react";
import { GenerationProgress } from "./generation-progress";
import type { Requirement } from "@/lib/types";

const reqs: Requirement[] = [
  { id: "r1", name: "tent", description: null, status: "pending", candidates: [] },
  { id: "r2", name: "axe", description: null, status: "pending", candidates: [] },
];

test("shows progress count", () => {
  render(
    <GenerationProgress
      requirements={reqs}
      completedIds={new Set(["r1"])}
      activeId="r2"
      totalCount={2}
      onCancel={() => {}}
    />
  );
  expect(screen.getByText("1 of 2 complete")).toBeInTheDocument();
});

test("shows done state for completed icons", () => {
  render(
    <GenerationProgress
      requirements={reqs}
      completedIds={new Set(["r1"])}
      activeId="r2"
      totalCount={2}
      onCancel={() => {}}
    />
  );
  expect(screen.getByText("✓")).toBeInTheDocument();
});
