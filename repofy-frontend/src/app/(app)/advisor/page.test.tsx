import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { createAdviceListItemSet } from "@/__tests__/fixtures";
import type { AdviceListItem } from "@/hooks/use-advice";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

let mockAdviceItems: AdviceListItem[] = [];
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
vi.mock("@/hooks/use-advice-job", () => ({
  useActiveAdviceJob: () => ({ data: null }),
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

    const { container } = render(<TestProviders><AdvisorPage /></TestProviders>);

    // Skeleton components render with data-slot="skeleton"
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when items is empty array", () => {
    mockAdviceItems = [];

    render(<TestProviders><AdvisorPage /></TestProviders>);

    expect(screen.getByText("No advice generated yet")).toBeInTheDocument();
  });

  it("renders advice list when items exist", () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
        avatar_url: null,
      },
      {
        id: "a2",
        analyzed_username: "bob",
        analyzed_name: "Bob",
        generated_at: "2025-01-14T10:00:00Z",
        avatar_url: null,
      },
    ];

    render(<TestProviders><AdvisorPage /></TestProviders>);

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
        avatar_url: null,
      },
      {
        id: "a2",
        analyzed_username: "bob",
        analyzed_name: "Bob",
        generated_at: "2025-01-14T10:00:00Z",
        avatar_url: null,
      },
    ];

    const user = userEvent.setup();
    render(<TestProviders><AdvisorPage /></TestProviders>);

    await user.type(screen.getByPlaceholderText("Search by username or name…"), "alice");

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
        avatar_url: null,
      },
    ];

    render(<TestProviders><AdvisorPage /></TestProviders>);

    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("Select button exists and toggles select mode", async () => {
    mockAdviceItems = [
      {
        id: "a1",
        analyzed_username: "alice",
        analyzed_name: "Alice",
        generated_at: "2025-01-15T10:00:00Z",
        avatar_url: null,
      },
    ];

    const user = userEvent.setup();
    render(<TestProviders><AdvisorPage /></TestProviders>);

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
        avatar_url: null,
      },
    ];

    render(<TestProviders><AdvisorPage /></TestProviders>);

    expect(screen.getByText("Advisor")).toBeInTheDocument();
  });

  it("sort toggles order", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<TestProviders><AdvisorPage /></TestProviders>);

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

    render(<TestProviders><AdvisorPage /></TestProviders>);

    await user.type(screen.getByPlaceholderText("Search by username or name…"), "Bob Coder");

    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.queryByText("@alice")).not.toBeInTheDocument();
    expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
  });

  it("shows empty search state", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<TestProviders><AdvisorPage /></TestProviders>);

    await user.type(screen.getByPlaceholderText("Search by username or name…"), "zzz");

    expect(screen.getByText("No advice matches your search")).toBeInTheDocument();
  });

  it("clear search restores all", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();

    render(<TestProviders><AdvisorPage /></TestProviders>);

    await user.type(screen.getByPlaceholderText("Search by username or name…"), "zzz");

    expect(screen.getByText("No advice matches your search")).toBeInTheDocument();

    await user.click(screen.getByText("Clear search"));

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
  });

  it("delete flow calls mutateAsync with selected IDs", async () => {
    mockAdviceItems = createAdviceListItemSet();
    const user = userEvent.setup();
    render(<TestProviders><AdvisorPage /></TestProviders>);

    // Enter select mode
    await user.click(screen.getByText("Select"));

    // Click the first row to select it
    const rows = screen.getAllByText(/@\w+/);
    await user.click(rows[0]); // alice (first in Newest first order)

    // Selection bar should show count and "selected" label
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("selected")).toBeInTheDocument();

    // Click Delete trigger to open AlertDialog
    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    // Click the confirmation Delete button inside the AlertDialog
    const confirmButtons = screen.getAllByText("Delete");
    // The last "Delete" is the AlertDialogAction confirmation button
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith(["a1"]);
  });
});
