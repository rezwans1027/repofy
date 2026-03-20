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

    expect(screen.getByRole("button", { name: /Get Started/i })).toBeInTheDocument();
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
    expect(screen.getByText("Your balance")).toBeInTheDocument();
  });

  it("does not show credit balance card when loading", () => {
    mockUseCreditBalance.mockReturnValue({ data: undefined, isLoading: true });

    renderPricing();

    expect(screen.queryByText(/Your balance/i)).not.toBeInTheDocument();
  });

  it("shows singular 'credit' for balance of 1", () => {
    mockUseCreditBalance.mockReturnValue({
      data: { growth_balance: 1, eval_balance: 0 },
      isLoading: false,
    });

    renderPricing();

    expect(screen.getByText("1")).toBeInTheDocument();
    // Should show singular "credit" not "credits"
    expect(screen.getByText("credit")).toBeInTheDocument();
  });

  it("does not show banners by default", () => {
    renderPricing();

    expect(screen.queryByText(/Credits added/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Checkout in progress/i)).not.toBeInTheDocument();
  });

  it("calls API and opens Stripe in new tab on checkout", async () => {
    vi.mocked(api.post).mockResolvedValue({ url: "https://checkout.stripe.com/session-123" });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const user = userEvent.setup();
    renderPricing();

    await user.click(screen.getByRole("button", { name: /Get Started/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/stripe/create-checkout-session", {});
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://checkout.stripe.com/session-123",
        "_blank",
        "noopener,noreferrer",
      );
    });

    // Should show "Checkout in progress" banner
    expect(screen.getByText(/Checkout in progress/i)).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it("shows error message when checkout fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    renderPricing();

    await user.click(screen.getByRole("button", { name: /Get Started/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
