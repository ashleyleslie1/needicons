import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepControl } from "./step-control";

test("shows label and toggle", () => {
  render(<StepControl label="Stroke" enabled={true} onEnabledChange={() => {}}><span>Controls</span></StepControl>);
  expect(screen.getByText("Stroke")).toBeInTheDocument();
});

test("expands on label click when enabled", async () => {
  const user = userEvent.setup();
  render(<StepControl label="Stroke" enabled={true} onEnabledChange={() => {}}><span>Controls here</span></StepControl>);
  await user.click(screen.getByText("Stroke"));
  expect(screen.getByText("Controls here")).toBeInTheDocument();
});

test("does not expand when disabled", async () => {
  const user = userEvent.setup();
  render(<StepControl label="Stroke" enabled={false} onEnabledChange={() => {}}><span>Controls here</span></StepControl>);
  await user.click(screen.getByText("Stroke"));
  expect(screen.queryByText("Controls here")).not.toBeInTheDocument();
});
