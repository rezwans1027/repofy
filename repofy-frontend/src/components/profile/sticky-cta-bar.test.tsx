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

  // 6. "Start Analysis" navigates when no report exists
  it("Start Analysis navigates to /generate/{username} when no report exists", async () => {
    reportState.data = false;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Start Analysis"));

    expect(navState.push).toHaveBeenCalledWith("/generate/octocat");
  });

  // 7. "Start Analysis" opens dialog when report exists
  it("Start Analysis opens dialog when report exists", async () => {
    reportState.data = true as any;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Start Analysis"));

    expect(screen.getByText("Report already exists")).toBeInTheDocument();
    expect(navState.push).not.toHaveBeenCalled();
  });

  // 8. "Get Advice" navigates when no advice exists
  it("Get Advice navigates to /advisor/generate/{username} when no advice exists", async () => {
    adviceState.data = false;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    fireEvent.click(screen.getByText("Get Advice"));

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

  // 10. Dialog confirm navigates and closes
  it("dialog confirm navigates and closes dialog", async () => {
    reportState.data = true as any;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    // Open dialog
    fireEvent.click(screen.getByText("Start Analysis"));
    expect(screen.getByText("Report already exists")).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByText("Replace report"));

    expect(navState.push).toHaveBeenCalledWith("/generate/octocat");
    expect(screen.queryByText("Report already exists")).not.toBeInTheDocument();
  });

  // 11. Dialog cancel closes without navigation
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

  // 12. Buttons disabled when user exists and loading is true
  it("buttons are disabled when user exists and loading is true", async () => {
    reportState.isLoading = true;
    adviceState.isLoading = true;
    render(<StickyCTABar username="octocat" />);
    await act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText("Start Analysis").closest("button")).toBeDisabled();
    expect(screen.getByText("Get Advice").closest("button")).toBeDisabled();
  });
});
