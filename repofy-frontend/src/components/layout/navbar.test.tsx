import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Use a stable reference that mockReset won't touch
const authState = { user: null as any, isLoading: false };
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user, isLoading: authState.isLoading }),
}));

let currentPathname = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => currentPathname,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

import { Navbar } from "./navbar";

describe("Navbar", () => {
  afterEach(() => {
    cleanup();
    authState.user = null;
    authState.isLoading = false;
    currentPathname = "/";
  });

  it("renders the logo link", () => {
    render(<Navbar />);
    expect(screen.getByText("repofy")).toBeInTheDocument();
  });

  it("shows Get Started link for unauthenticated user", () => {
    authState.user = null;
    render(<Navbar />);
    const links = screen.getAllByText("Get Started");
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].closest("a")).toHaveAttribute("href", "/login");
  });

  it("shows Dashboard button for authenticated user on landing page", () => {
    authState.user = { id: "user-1", email: "test@test.com" };
    currentPathname = "/";
    render(<Navbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("hides CTA buttons for authenticated user on non-landing page", () => {
    authState.user = { id: "user-1", email: "test@test.com" };
    currentPathname = "/dashboard";
    render(<Navbar />);
    expect(screen.queryByText("Get Started")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("links logo to dashboard when authenticated", () => {
    authState.user = { id: "user-1", email: "test@test.com" };
    render(<Navbar />);
    const logo = screen.getByText("repofy").closest("a");
    expect(logo).toHaveAttribute("href", "/dashboard");
  });

  it("links logo to / when not authenticated", () => {
    authState.user = null;
    render(<Navbar />);
    const logo = screen.getByText("repofy").closest("a");
    expect(logo).toHaveAttribute("href", "/");
  });

  it("shows theme toggle sr-only text", () => {
    render(<Navbar />);
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
  });
});
