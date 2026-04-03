import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/login";
vi.mock("next/navigation", () => navModule);

// Capture window.location.href assignments
let capturedHref: string | undefined;
const originalLocation = window.location;

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/login";
    capturedHref = undefined;

    // Mock window.location.href setter
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        origin: "http://localhost:3000",
        protocol: "http:",
        href: "http://localhost:3000/login",
      },
    });
    Object.defineProperty(window.location, "href", {
      set(value: string) { capturedHref = value; },
      get() { return "http://localhost:3000/login"; },
      configurable: true,
    });

    // Mock crypto APIs for deterministic PKCE/state values
    vi.stubGlobal("crypto", {
      ...crypto,
      randomUUID: () => "test-state-uuid",
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
      subtle: {
        digest: async (_algo: string, _data: ArrayBuffer) =>
          new Uint8Array(32).buffer, // deterministic hash for test
      },
    });

    // Set env var
    vi.stubEnv("NEXT_PUBLIC_GITHUB_APP_CLIENT_ID", "test-client-id");
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // Clear cookies
    document.cookie = "github_oauth_state=; max-age=0";
    document.cookie = "github_oauth_code_verifier=; max-age=0";
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

  it("redirects to GitHub with PKCE and state on button click", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    // Should redirect to GitHub authorization endpoint
    expect(capturedHref).toBeDefined();
    const url = new URL(capturedHref!);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
    expect(url.searchParams.get("state")).toBe("test-state-uuid");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    // No scope param — GitHub App permissions come from app config
    expect(url.searchParams.get("scope")).toBeNull();
  });

  it("sets state and code_verifier cookies", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(document.cookie).toContain("github_oauth_state=test-state-uuid");
    expect(document.cookie).toContain("github_oauth_code_verifier=");
  });

  it("shows error when NEXT_PUBLIC_GITHUB_APP_CLIENT_ID is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_GITHUB_APP_CLIENT_ID", "");
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(await screen.findByText(/github login is not configured/i)).toBeInTheDocument();
    expect(capturedHref).toBeUndefined();
  });

  it("shows callback error from search params", () => {
    navState.searchParams = new URLSearchParams("error=exchange_failed");
    render(<LoginPage />);

    expect(screen.getByText(/could not complete sign-in/i)).toBeInTheDocument();
  });

  it("shows error for missing_state callback error", () => {
    navState.searchParams = new URLSearchParams("error=missing_state");
    render(<LoginPage />);

    expect(screen.getByText(/authentication session expired/i)).toBeInTheDocument();
  });

  it("shows error for invalid_state callback error", () => {
    navState.searchParams = new URLSearchParams("error=invalid_state");
    render(<LoginPage />);

    expect(screen.getByText(/authentication verification failed/i)).toBeInTheDocument();
  });
});
