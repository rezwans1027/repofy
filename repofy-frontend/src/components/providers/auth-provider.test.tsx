import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createUserFixture } from "@/__tests__/fixtures";

// The auth-provider calls createClient() at module scope,
// so we need stable function references that survive mockReset.
let getSessionImpl = vi.fn().mockResolvedValue({
  data: { session: null },
});
let onAuthStateChangeImpl = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      auth: {
        getSession: (...args: any[]) => getSessionImpl(...args),
        onAuthStateChange: (...args: any[]) => onAuthStateChangeImpl(...args),
      },
    }),
  };
});

vi.mock("@/lib/auth-token", () => ({
  setAccessToken: vi.fn(),
}));

// Import after mock setup
const { AuthProvider, useAuth } = await import("./auth-provider");

function TestConsumer() {
  const { user, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user?.email ?? "null"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getSessionImpl = vi.fn().mockResolvedValue({
      data: { session: null },
    });
    onAuthStateChangeImpl = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("shows loading then resolves to null user", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("provides user when getSession returns a session", async () => {
    const user = createUserFixture();
    getSessionImpl = vi.fn().mockResolvedValue({
      data: { session: { access_token: "test-token", user } },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("test@example.com"),
    );
  });

  it("sets up onAuthStateChange listener", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(onAuthStateChangeImpl).toHaveBeenCalledWith(expect.any(Function));
  });

  it("cleans up subscription on unmount", async () => {
    const unsubscribe = vi.fn();
    onAuthStateChangeImpl = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe } },
    });

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("throws when useAuth is used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used within AuthProvider",
    );
    consoleError.mockRestore();
  });
});
