import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mutable auth state -- the Wrapper component reads this on every render,
// so changing authState.user between render / rerender drives the test.
// ---------------------------------------------------------------------------
const authState: { user: { id: string } | null } = { user: { id: "user-1" } };

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user }),
}));

// ---------------------------------------------------------------------------
// Query-client mocks
// ---------------------------------------------------------------------------
const mockResetQueryClient = vi.fn();
const testClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

vi.mock("@/lib/query-client", () => ({
  getQueryClient: () => testClient,
  resetQueryClient: mockResetQueryClient,
}));

// ---------------------------------------------------------------------------
// Devtools stub (not relevant to the logic under test)
// ---------------------------------------------------------------------------
vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => null,
}));

// ---------------------------------------------------------------------------
// Import after all mocks are registered
// ---------------------------------------------------------------------------
const { QueryProvider } = await import("./query-provider");

/** Thin wrapper so rerender picks up the latest authState. */
function Wrapper() {
  return (
    <QueryProvider>
      <span>child</span>
    </QueryProvider>
  );
}

describe("QueryProvider", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" };
    mockResetQueryClient.mockClear();
  });

  it("renders children inside QueryClientProvider", () => {
    render(<Wrapper />);
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("does NOT call resetQueryClient on initial mount", () => {
    render(<Wrapper />);
    expect(mockResetQueryClient).not.toHaveBeenCalled();
  });

  it("calls resetQueryClient when user.id changes", () => {
    const { rerender } = render(<Wrapper />);
    expect(mockResetQueryClient).not.toHaveBeenCalled();

    // Simulate account switch
    authState.user = { id: "user-2" };
    rerender(<Wrapper />);

    expect(mockResetQueryClient).toHaveBeenCalledTimes(1);
  });

  it("calls resetQueryClient on sign-out (user becomes null)", () => {
    const { rerender } = render(<Wrapper />);
    expect(mockResetQueryClient).not.toHaveBeenCalled();

    // Simulate sign-out
    authState.user = null;
    rerender(<Wrapper />);

    expect(mockResetQueryClient).toHaveBeenCalledTimes(1);
  });

  it("does NOT call resetQueryClient when user stays the same", () => {
    const { rerender } = render(<Wrapper />);

    // Rerender with the exact same user
    rerender(<Wrapper />);
    rerender(<Wrapper />);

    expect(mockResetQueryClient).not.toHaveBeenCalled();
  });
});
