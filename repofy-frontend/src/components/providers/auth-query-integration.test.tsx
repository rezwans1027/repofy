import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

// vi.hoisted runs before vi.mock factories, so these are available in the mocks
const { authState, mockResetQueryClient, testQueryClient } = vi.hoisted(() => {
  const { QueryClient: QC } = require("@tanstack/react-query");
  return {
    authState: { user: { id: "user-1" } as any },
    mockResetQueryClient: vi.fn(),
    testQueryClient: new QC({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    }),
  };
});

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("@/lib/query-client", () => ({
  getQueryClient: () => testQueryClient,
  resetQueryClient: mockResetQueryClient,
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => null,
}));

// Import after mocks are hoisted
import { QueryProvider } from "./query-provider";

beforeEach(() => {
  authState.user = { id: "user-1" };
  mockResetQueryClient.mockClear();
});

describe("Auth + QueryProvider integration", () => {
  it("renders children inside QueryProvider", () => {
    render(
      <QueryProvider>
        <span>child</span>
      </QueryProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("calls resetQueryClient when user signs out", () => {
    const { rerender } = render(
      <QueryProvider>
        <span>content</span>
      </QueryProvider>,
    );

    // Simulate sign-out
    authState.user = null;
    rerender(
      <QueryProvider>
        <span>content</span>
      </QueryProvider>,
    );

    expect(mockResetQueryClient).toHaveBeenCalledTimes(1);
  });

  it("calls resetQueryClient when switching users", () => {
    const { rerender } = render(
      <QueryProvider>
        <span>content</span>
      </QueryProvider>,
    );

    // Simulate user switch
    authState.user = { id: "user-2" };
    rerender(
      <QueryProvider>
        <span>content</span>
      </QueryProvider>,
    );

    expect(mockResetQueryClient).toHaveBeenCalledTimes(1);
  });
});
