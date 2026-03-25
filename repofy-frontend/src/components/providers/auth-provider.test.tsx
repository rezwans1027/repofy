import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock api-client: stable mock reference that can be reconfigured per test
let getMeImpl = vi.fn().mockRejectedValue(new Error("Not authenticated"));

vi.mock("@/lib/api-client", () => ({
  api: {
    get: (...args: any[]) => getMeImpl(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: Error,
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
    getMeImpl = vi.fn().mockRejectedValue(new Error("Not authenticated"));
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

  it("provides user when /auth/me returns a user", async () => {
    getMeImpl = vi.fn().mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
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

  it("calls /auth/me on mount", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(getMeImpl).toHaveBeenCalledWith("/auth/me");
  });

  it("throws when useAuth is used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used within AuthProvider",
    );
    consoleError.mockRestore();
  });
});
