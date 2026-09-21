import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntakeUnavailable } from "./intake-unavailable";

it("disabled intake preserves navigation to saved reports", () => {
  render(<IntakeUnavailable />);
  expect(screen.getByText("New analyses are not available yet.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View saved reports" })).toHaveAttribute("href", "/readiness");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
