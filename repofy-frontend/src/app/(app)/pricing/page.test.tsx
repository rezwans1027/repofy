import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api-client", () => ({
  api: {
    post: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/pricing";
vi.mock("next/navigation", () => navModule);

import PricingPage from "./page";
import { api } from "@/lib/api-client";

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/pricing";
    navState.searchParams = new URLSearchParams();
  });

  it("renders Developers and Recruiters cards", () => {
    render(<PricingPage />);

    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByText("Recruiters")).toBeInTheDocument();
  });

  it("renders the $5 price", () => {
    render(<PricingPage />);

    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders the checkout button", () => {
    render(<PricingPage />);

    expect(screen.getByRole("button", { name: /Get Started — \$5/i })).toBeInTheDocument();
  });

  it("renders Coming Soon for Recruiters", () => {
    render(<PricingPage />);

    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("renders feature list", () => {
    render(<PricingPage />);

    expect(screen.getByText("Full GitHub profile analysis")).toBeInTheDocument();
    expect(screen.getByText("AI-powered skill radar")).toBeInTheDocument();
    expect(screen.getByText("Exportable developer reports")).toBeInTheDocument();
  });

  it("shows success banner when ?success=true", () => {
    navState.searchParams = new URLSearchParams("success=true");

    render(<PricingPage />);

    expect(screen.getByText(/Payment successful/i)).toBeInTheDocument();
  });

  it("shows canceled banner when ?canceled=true", () => {
    navState.searchParams = new URLSearchParams("canceled=true");

    render(<PricingPage />);

    expect(screen.getByText(/Payment canceled/i)).toBeInTheDocument();
  });

  it("does not show banners by default", () => {
    render(<PricingPage />);

    expect(screen.queryByText(/Payment successful/i)).not.toBeInTheDocument();
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
    render(<PricingPage />);

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
    render(<PricingPage />);

    await user.click(screen.getByRole("button", { name: /Get Started — \$5/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows loading state during checkout", async () => {
    // Never-resolving promise to keep loading state
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<PricingPage />);

    await user.click(screen.getByRole("button", { name: /Get Started — \$5/i }));

    await waitFor(() => {
      expect(screen.getByText("Redirecting…")).toBeInTheDocument();
    });
  });
});
