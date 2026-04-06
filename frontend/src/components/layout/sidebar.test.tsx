import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./sidebar";

test("renders logo and nav links", () => {
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
  expect(screen.getByText("N")).toBeInTheDocument();
  expect(screen.getByTitle("Packs")).toBeInTheDocument();
  expect(screen.getByTitle("Settings")).toBeInTheDocument();
});
