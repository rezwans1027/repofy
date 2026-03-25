import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Supabase client
const mockSignInWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/login";
vi.mock("next/navigation", () => navModule);

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/login";
  });

  it("renders the terminal-style header", () => {
    render(<LoginPage />);
    expect(screen.getByText("repofy auth login")).toBeInTheDocument();
  });

  it("renders the Continue with GitHub button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
  });

  it("renders the GitHub token disclosure", () => {
    render(<LoginPage />);
    expect(screen.getByText(/we use your github token/i)).toBeInTheDocument();
  });

  it("calls signInWithOAuth on button click", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: expect.objectContaining({
        scopes: "read:user user:email",
      }),
    });
  });

  it("shows loading state after click", async () => {
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows error when OAuth returns an error", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: "OAuth failed" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(await screen.findByText("OAuth failed")).toBeInTheDocument();
  });

  it("shows error when signInWithOAuth throws", async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  it("shows callback error from search params", () => {
    navState.searchParams = new URLSearchParams("error=exchange_failed");
    render(<LoginPage />);

    expect(screen.getByText(/could not complete sign-in/i)).toBeInTheDocument();
  });
});
