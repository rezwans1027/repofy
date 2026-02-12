import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

// Use a stable reference that mockReset won't touch
const authState = { user: null as any, isLoading: false };
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user, isLoading: authState.isLoading }),
}));

vi.mock("next/navigation", () => navModule);

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

import { Navbar } from "./navbar";

describe("Navbar", () => {
  afterEach(() => {
    authState.user = null;
    authState.isLoading = false;
    resetNavState();
  });

  it("renders the logo link", () => {
    render(<Navbar />);
    expect(screen.getByText("repofy")).toBeInTheDocument();
  });

  it("shows Get Started link for unauthenticated user", () => {
    authState.user = null;
    render(<Navbar />);
    const links = screen.getAllByText("Get Started");
    expect(links).toHaveLength(1);
    expect(links[0].closest("a")).toHaveAttribute("href", "/login");
  });

  it("shows Dashboard button for authenticated user on landing page", () => {
    authState.user = { id: "user-1", email: "test@test.com" };
    navState.pathname = "/";
    render(<Navbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("hides CTA buttons for authenticated user on non-landing page", () => {
    authState.user = { id: "user-1", email: "test@test.com" };
    navState.pathname = "/dashboard";
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
