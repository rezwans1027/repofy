import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

vi.mock("next/navigation", () => navModule);

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar", () => {
  afterEach(() => resetNavState());

  it("renders all navigation links", () => {
    navState.pathname = "/dashboard";
    render(<AppSidebar />);
    expect(screen.getAllByText("Search")).toHaveLength(2);
    expect(screen.getAllByText("Reports")).toHaveLength(2);
    expect(screen.getAllByText("Advisor")).toHaveLength(2);
    expect(screen.getAllByText("Compare")).toHaveLength(2);
    expect(screen.getAllByText("Settings")).toHaveLength(2);
  });

  it("renders links with correct hrefs", () => {
    render(<AppSidebar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/advisor");
    expect(hrefs).toContain("/compare");
    expect(hrefs).toContain("/settings");
  });

  it("highlights active link based on pathname", () => {
    navState.pathname = "/reports";
    render(<AppSidebar />);
    // Desktop nav links with "Reports" text
    const reportsLinks = screen.getAllByText("Reports");
    // At least one should have the active class (text-cyan)
    const hasActive = reportsLinks.some((el) => {
      const link = el.closest("a");
      return link?.className.includes("text-cyan");
    });
    expect(hasActive).toBe(true);
  });

  it("highlights Search when on /profile path", () => {
    navState.pathname = "/profile/testuser";
    render(<AppSidebar />);
    const searchLinks = screen.getAllByText("Search");
    const hasActive = searchLinks.some((el) => {
      const link = el.closest("a");
      return link?.className.includes("text-cyan");
    });
    expect(hasActive).toBe(true);
  });
});
