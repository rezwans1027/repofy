import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/__tests__/helpers/test-providers";

vi.mock("@/lib/api-client", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));

const mockUseCreditBalance = vi.fn();
const mockUseAwaitCreditUpdate = vi.fn();
vi.mock("@/hooks/use-credits", () => ({
  useCreditBalance: () => mockUseCreditBalance(),
  useAwaitCreditUpdate: () => mockUseAwaitCreditUpdate(),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-123" }, isLoading: false }),
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/pricing";
vi.mock("next/navigation", () => navModule);

import PricingPage from "./page";
import { api } from "@/lib/api-client";

function renderPricing() {
  return render(
    <TestProviders>
      <PricingPage />
    </TestProviders>
  );
}

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/pricing";
    navState.searchParams = new URLSearchParams();
    mockUseCreditBalance.mockReturnValue({ data: { growth_balance: 0, eval_balance: 0 }, isLoading: false });
    mockUseAwaitCreditUpdate.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("renders Developers and Recruiters cards", () => {
    renderPricing();

    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByText("Recruiters")).toBeInTheDocument();
  });

  it("renders the $5 price", () => {
    renderPricing();

    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders the checkout button", () => {
    renderPricing();

    expect(screen.getByRole("button", { name: /Get Started — \$5/i })).toBeInTheDocument();
  });

  it("renders Coming Soon for Recruiters", () => {
    renderPricing();

    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("renders credit-based feature list", () => {
    renderPricing();

    expect(screen.getByText("2 growth credits per purchase")).toBeInTheDocument();
    expect(screen.getByText("1 credit per AI-powered advice session")).toBeInTheDocument();
    expect(screen.getByText("Full GitHub profile analysis")).toBeInTheDocument();
  });

  it("shows credit balance when loaded", () => {
    mockUseCreditBalance.mockReturnValue({
      data: { growth_balance: 3, eval_balance: 0 },
      isLoading: false,
    });

    renderPricing();

    expect(screen.getByText("3")).toBeInTheDocument();
    // Match the balance card text "You have N growth credits" (not feature list)
    expect(screen.getByText(/You have/)).toBeInTheDocument();
  });

  it("does not show credit balance card when loading", () => {
    mockUseCreditBalance.mockReturnValue({ data: undefined, isLoading: true });

    renderPricing();

    expect(screen.queryByText(/You have/)).not.toBeInTheDocument();
  });

  it("shows singular 'credit' for balance of 1", () => {
    mockUseCreditBalance.mockReturnValue({
      data: { growth_balance: 1, eval_balance: 0 },
      isLoading: false,
    });

    renderPricing();

    // The balance line renders "You have 1 growth credit" (no trailing 's')
    const balanceLine = screen.getByText(/You have/);
    expect(balanceLine.textContent).toContain("1");
    expect(balanceLine.textContent).toMatch(/growth credit$/);
  });

  it("shows success banner with credit message when ?success=true", async () => {
    navState.searchParams = new URLSearchParams("success=true");

    // Simulate pre-checkout balance stored before redirect
    sessionStorage.setItem("pre_checkout_balance", "0");

    // useCreditBalance returns current balance (after webhook)
    mockUseCreditBalance.mockReturnValue({
      data: { growth_balance: 2, eval_balance: 0 },
      isLoading: false,
    });

    // Polling starts loading, then returns increased balance.
    // The polledBalance changing from undefined → data triggers the effect
    // that detects the credit increase and sets creditsReceived = true.
    mockUseAwaitCreditUpdate
      .mockReturnValueOnce({ data: undefined, isLoading: true })
      .mockReturnValue({
        data: { growth_balance: 2, eval_balance: 0 },
        isLoading: false,
      });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText(/2 growth credits added/i)).toBeInTheDocument();
    });
  });

  it("shows canceled banner when ?canceled=true", () => {
    navState.searchParams = new URLSearchParams("canceled=true");

    renderPricing();

    expect(screen.getByText(/Payment canceled/i)).toBeInTheDocument();
  });

  it("does not show banners by default", () => {
    renderPricing();

    expect(screen.queryByText(/growth credits added/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment canceled/i)).not.toBeInTheDocument();
  });

  it("calls API and redirects on checkout button click", async () => {
    vi.mocked(api.post).mockResolvedValue({ url: "https://checkout.stripe.com/session-123" });

    // Mock window.location.href assignment
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: hrefSetter,
      get: () => "",
    });

    const user = userEvent.setup();
    renderPricing();

    await user.click(screen.getByRole("button", { name: /Get Started — \$5/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/stripe/create-checkout-session", { auth: true });
    });

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith("https://checkout.stripe.com/session-123");
    });
  });

  it("shows error message when checkout fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    renderPricing();

    await user.click(screen.getByRole("button", { name: /Get Started — \$5/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows loading state during checkout", async () => {
    // Never-resolving promise to keep loading state
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderPricing();

    await user.click(screen.getByRole("button", { name: /Get Started — \$5/i }));

    await waitFor(() => {
      expect(screen.getByText("Redirecting…")).toBeInTheDocument();
    });
  });
});
