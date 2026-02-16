import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";
import { createAdviceListItemSet } from "@/__tests__/fixtures";

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

  it("sort toggles order", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<AdvisorPage />);

    // Open the sort dropdown
    await user.click(screen.getByText("Newest first"));

    // Click "Oldest first"
    await user.click(screen.getByText("Oldest first"));

    // Charlie (Jan 13) should now be the first username rendered
    const usernames = screen.getAllByText(/@(alice|bob|charlie)/);
    expect(usernames[0]).toHaveTextContent("@charlie");
  });

  it("searches by analyzed_name", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<AdvisorPage />);

    await user.type(screen.getByPlaceholderText("Search…"), "Bob Coder");

    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.queryByText("@alice")).not.toBeInTheDocument();
    expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
  });

  it("shows empty search state", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<AdvisorPage />);

    await user.type(screen.getByPlaceholderText("Search…"), "zzz");

    expect(screen.getByText("No advice matches your search")).toBeInTheDocument();
  });

  it("clear search restores all", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<AdvisorPage />);

    await user.type(screen.getByPlaceholderText("Search…"), "zzz");

    expect(screen.getByText("No advice matches your search")).toBeInTheDocument();

    await user.click(screen.getByText("Clear search"));

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
  });

  it("delete flow calls mutateAsync with selected IDs", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();
    render(<AdvisorPage />);

    // Enter select mode
    await user.click(screen.getByText("Select"));

    // Click the first row to select it
    const rows = screen.getAllByText(/@\w+/);
    await user.click(rows[0]); // alice (first in Newest first order)

    // Selection bar should show "1 selected"
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Click Delete
    await user.click(screen.getByText("Delete"));

    expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith(["a1"]);
  });
});
