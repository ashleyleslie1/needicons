import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconTile } from "./icon-tile";
import type { Requirement } from "@/lib/types";

const emptyReq: Requirement = {
  id: "r1", name: "tent", description: null, status: "pending", candidates: [],
};

const acceptedReq: Requirement = {
  id: "r2", name: "backpack", description: null, status: "accepted",
  candidates: [
    { id: "c1", requirement_id: "r2", source_path: "img.png", preview_path: "", origin: "single", selected: true },
  ],
};

test("shows name for empty requirement", () => {
  render(<IconTile requirement={emptyReq} selected={false} onSelect={() => {}} onClick={() => {}} />);
  expect(screen.getByText("tent")).toBeInTheDocument();
});

test("shows checkmark when accepted", () => {
  render(<IconTile requirement={acceptedReq} selected={false} onSelect={() => {}} onClick={() => {}} />);
  expect(screen.getByText("✓")).toBeInTheDocument();
});

test("calls onSelect when checkbox clicked", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<IconTile requirement={emptyReq} selected={false} onSelect={onSelect} onClick={() => {}} />);
  // Find the checkbox button (first button in the tile)
  const buttons = screen.getAllByRole("button");
  await user.click(buttons[0]);
  expect(onSelect).toHaveBeenCalledWith("r1");
});
