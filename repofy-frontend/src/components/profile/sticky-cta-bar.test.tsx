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

const reportState = { data: false, isLoading: false };
const adviceState = { data: false, isLoading: false };
const creditState = { data: { growth_balance: 2, eval_balance: 0 } as any, isLoading: false };

vi.mock("@/hooks/use-reports", () => ({
  useExistingReport: () => ({
    data: reportState.data,
    isLoading: reportState.isLoading,
  }),
}));

vi.mock("@/hooks/use-advice", () => ({
  useExistingAdvice: () => ({
    data: adviceState.data,
    isLoading: adviceState.isLoading,
  }),
}));

vi.mock("@/hooks/use-credits", () => ({
  useCreditBalance: () => ({
    data: creditState.data,
    isLoading: creditState.isLoading,
  }),
}));

// --- Import component after mocks -----------------------------------------

import { StickyCTABar } from "./sticky-cta-bar";

// --- Helpers ---------------------------------------------------------------

function resetMockState() {
  authState.user = { id: "user-123" } as any;
  authState.isLoading = false;
  reportState.data = false;
  reportState.isLoading = false;
  adviceState.data = false;
  adviceState.isLoading = false;
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

  // 1. Renders both CTA buttons
  it("renders both CTA buttons", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("Start Analysis")).toBeInTheDocument();
    expect(screen.getByText("Get Advice")).toBeInTheDocument();
  });

  // 2. Displays @{username} text
  it("displays @{username} text", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("@octocat")).toBeInTheDocument();
  });

  // 3. Bar hidden initially before delay
  it("is hidden initially before delay", () => {
    const { container } = render(<StickyCTABar username="octocat" />);

    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("translate-y-full");
    expect(bar.className).toContain("opacity-0");
  });

  // 4. Bar visible after delay
  it("becomes visible after delay", async () => {
    const { container } = render(<StickyCTABar username="octocat" />);

    await act(() => vi.advanceTimersByTime(50));

    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("translate-y-0");
    expect(bar.className).toContain("opacity-100");
  });

  // 5. Respects custom delay prop
  it("respects custom delay prop", async () => {
    const { container } = render(
      <StickyCTABar username="octocat" delay={200} />,
    );

    // Still hidden at 100ms
    await act(() => vi.advanceTimersByTime(100));
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("translate-y-full");

    // Visible at 200ms
    await act(() => vi.advanceTimersByTime(100));
    expect(bar.className).toContain("translate-y-0");
  });

  // 6. "Start Analysis" button is disabled (Coming Soon)
  it("Start Analysis button is disabled", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    const btn = screen.getByText("Start Analysis").closest("button");
    expect(btn).toBeDisabled();
  });

  // 7. "Start Analysis" does not navigate when clicked
  it("Start Analysis does not navigate when clicked", async () => {
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Start Analysis"));

    expect(navState.push).not.toHaveBeenCalled();
  });

  // 8. "Get Advice" opens credit confirmation when no advice exists
  it("Get Advice opens credit confirmation dialog when no advice exists", async () => {
    adviceState.data = false;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

    expect(screen.getByText("Use 1 growth credit")).toBeInTheDocument();

    // Clicking Continue navigates
    fireEvent.click(screen.getByText("Continue"));

    expect(navState.push).toHaveBeenCalledWith(
      "/advisor/generate/octocat",
    );
  });

  // 9. "Get Advice" opens dialog when advice exists
  it("Get Advice opens dialog when advice exists", async () => {
    adviceState.data = true as any;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

    expect(screen.getByText("Advice already exists")).toBeInTheDocument();
    expect(navState.push).not.toHaveBeenCalled();
  });

  // 10. Dialog cancel closes without navigation
  it("dialog cancel closes without navigation", async () => {
    adviceState.data = true as any;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    // Open dialog
    fireEvent.click(screen.getByText("Get Advice"));
    expect(screen.getByText("Advice already exists")).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByText("Cancel"));

    expect(navState.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Advice already exists")).not.toBeInTheDocument();
  });

  // 11. "Get Advice" shows no_credits dialog when balance is 0
  it("Get Advice shows no-credits dialog when growth_balance is 0", async () => {
    creditState.data = { growth_balance: 0, eval_balance: 0 };
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

    expect(screen.getByText("No growth credits")).toBeInTheDocument();
    expect(screen.getByText("Buy Credits")).toBeInTheDocument();
    expect(navState.push).not.toHaveBeenCalled();
  });

  // 12. "Get Advice" button disabled while balance is loading
  it("Get Advice button is disabled while balance is loading", async () => {
    creditState.isLoading = true;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("Get Advice").closest("button")).toBeDisabled();
  });
});
