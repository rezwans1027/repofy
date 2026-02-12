import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

let mockAdviceItems: any[] = [];
let mockAdviceLoading = false;
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/use-advice", () => ({
  useAdviceList: () => ({
    data: mockAdviceItems,
    isLoading: mockAdviceLoading,
  }),
  useDeleteAdvice: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

import AdvisorPage from "./page";

describe("AdvisorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdviceItems = [];
    mockAdviceLoading = false;
  });

  it("shows loading state when isLoading is true", () => {
    mockAdviceLoading = true;

    const { container } = render(<AdvisorPage />);

    // Skeleton components render with data-slot="skeleton"
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when items is empty array", () => {
    mockAdviceItems = [];

    render(<AdvisorPage />);

    expect(screen.getByText("No advice generated yet")).toBeInTheDocument();
  });

  it("renders advice list when items exist", () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
      },
      {
        id: "a2",
        analyzed_username: "bob",
        analyzed_name: "Bob",
        generated_at: "2025-01-14T10:00:00Z",
      },
    ];

    render(<AdvisorPage />);

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
      },
      {
        id: "a2",
        analyzed_username: "bob",
        analyzed_name: "Bob",
        generated_at: "2025-01-14T10:00:00Z",
      },
    ];

    const user = userEvent.setup();
    render(<AdvisorPage />);

    await user.type(screen.getByPlaceholderText("Search…"), "alice");

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.queryByText("@bob")).not.toBeInTheDocument();
  });

  it("shows sort dropdown button with 'Newest first'", () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
      },
    ];

    render(<AdvisorPage />);

    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("Select button exists and toggles select mode", async () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
      },
    ];

    const user = userEvent.setup();
    render(<AdvisorPage />);

    expect(screen.getByText("Select")).toBeInTheDocument();

    await user.click(screen.getByText("Select"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it('shows "Advisor" heading', () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
      },
    ];

    render(<AdvisorPage />);

    expect(screen.getByText("Advisor")).toBeInTheDocument();
  });
});
