import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { createSearchResultFixture } from "@/__tests__/fixtures";

// Mock api-client - the factory can't reference outer variables, so use vi.fn() inline
vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/dashboard";
vi.mock("next/navigation", () => navModule);

import DashboardPage from "./page";
import { api } from "@/lib/api-client";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/dashboard";
  });

  it("renders search input", () => {
    render(
      <TestProviders>
        <DashboardPage />
      </TestProviders>,
    );

    expect(screen.getByPlaceholderText("username...")).toBeInTheDocument();
  });

  it("renders prompt text when search is empty", () => {
    render(
      <TestProviders>
        <DashboardPage />
      </TestProviders>,
    );

    expect(screen.getByText("Type a GitHub username to search")).toBeInTheDocument();
  });

  it("shows search results when API returns data", async () => {
    const results = [
      createSearchResultFixture({ username: "alice", name: "Alice Dev" }),
      createSearchResultFixture({ username: "bob", name: "Bob Coder" }),
    ];
    vi.mocked(api.get).mockResolvedValue(results);

    const user = userEvent.setup();

    render(
      <TestProviders>
        <DashboardPage />
      </TestProviders>,
    );

    await user.type(screen.getByPlaceholderText("username..."), "alice");

    // Wait for debounce (300ms) + React Query fetch + re-render
    await waitFor(
      () => {
        expect(screen.getByText("Alice Dev")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });
});
