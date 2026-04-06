import { render, screen } from "@testing-library/react";
import { Button } from "./button";

test("renders button with text", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
});

test("applies variant classes", () => {
  render(<Button variant="secondary">Secondary</Button>);
  const btn = screen.getByRole("button");
  expect(btn.className).toContain("bg-muted");
});

test("renders as child element when asChild", () => {
  render(
    <Button asChild>
      <a href="/test">Link Button</a>
    </Button>
  );
  expect(screen.getByRole("link", { name: "Link Button" })).toBeInTheDocument();
});
