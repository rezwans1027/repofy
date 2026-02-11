import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock usePathname
let mockPathname = "/dashboard";
vi.mock("next/navigation", async () => {
  const original = await vi.importActual("next/navigation");
  return {
    ...original,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => mockPathname,
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
  };
});

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar", () => {
  it("renders all navigation links", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Search").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Advisor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Compare").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
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
    mockPathname = "/reports";
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
    mockPathname = "/profile/testuser";
    render(<AppSidebar />);
    const searchLinks = screen.getAllByText("Search");
    const hasActive = searchLinks.some((el) => {
      const link = el.closest("a");
      return link?.className.includes("text-cyan");
    });
    expect(hasActive).toBe(true);
  });
});
