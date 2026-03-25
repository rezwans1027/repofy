import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  navState,
  navModule,
  resetNavState,
} from "@/__tests__/helpers/mock-navigation";

// --- Mutable mock state ---------------------------------------------------

const authState = { user: { id: "user-123" } as any, isLoading: false };

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user, isLoading: authState.isLoading }),
}));

vi.mock("next/navigation", () => navModule);

const reportState = { data: 0, isLoading: false };
const creditState = { data: { growth_balance: 2, eval_balance: 0 } as any, isLoading: false };

vi.mock("@/hooks/use-reports", () => ({
  useReportCount: () => ({
    data: reportState.data,
    isLoading: reportState.isLoading,
  }),
}));

vi.mock("@/hooks/use-credits", () => ({
  useCreditBalance: () => ({
    data: creditState.data,
    isLoading: creditState.isLoading,
  }),
}));

vi.mock("@/hooks/use-advice-job", () => ({
  useActiveAdviceJob: () => ({ data: null }),
}));

// --- Import component after mocks -----------------------------------------

import { StickyCTABar } from "./sticky-cta-bar";

// --- Helpers ---------------------------------------------------------------

function resetMockState() {
  authState.user = { id: "user-123" } as any;
  authState.isLoading = false;
  reportState.data = 0;
  reportState.isLoading = false;
  creditState.data = { growth_balance: 2, eval_balance: 0 };
  creditState.isLoading = false;
}

// --- Tests -----------------------------------------------------------------

describe("StickyCTABar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMockState();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetNavState();
  });

  it("renders both CTA buttons", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("Start Analysis")).toBeInTheDocument();
    expect(screen.getByText("Get Advice")).toBeInTheDocument();
  });

  it("displays @{username} text", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("@octocat")).toBeInTheDocument();
  });

  it("has CSS slide-up animation class", () => {
    const { container } = render(<StickyCTABar username="octocat" />);

    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("animate-slide-up");
  });

  it("Start Analysis button is disabled", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    const btn = screen.getByText("Start Analysis").closest("button");
    expect(btn).toBeDisabled();
  });

  it("Start Analysis does not navigate when clicked", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Start Analysis"));

    expect(navState.push).not.toHaveBeenCalled();
  });

  it("Get Advice opens credit confirmation dialog", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

    expect(screen.getByText("Use 1 growth credit")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Continue"));

    expect(navState.push).toHaveBeenCalledWith(
      "/advisor/generate/octocat",
    );
  });

  it("Get Advice shows no-credits dialog when growth_balance is 0", async () => {
    creditState.data = { growth_balance: 0, eval_balance: 0 };
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

    expect(screen.getByText("No growth credits")).toBeInTheDocument();
    expect(screen.getByText("Buy Credits")).toBeInTheDocument();
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("Get Advice button is disabled while balance is loading", async () => {
    creditState.isLoading = true;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("Get Advice").closest("button")).toBeDisabled();
  });
});
