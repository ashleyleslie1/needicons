import { render, screen } from "@testing-library/react";
import { App } from "./app";

test("renders app", () => {
  render(<App />);
  // The app should render something — at minimum the sidebar
  expect(screen.getByText("N")).toBeInTheDocument();
});
