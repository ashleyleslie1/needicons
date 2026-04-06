import { render, screen } from "@testing-library/react";
import { App } from "./app";

test("renders app heading", () => {
  render(<App />);
  expect(screen.getByText("NeedIcons")).toBeInTheDocument();
});
