import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/stripe", () => ({
  getStripe: vi.fn(),
}));

vi.mock("../../../src/config/env", () => ({
  env: { frontendUrl: "http://localhost:3000" },
}));

import { createCheckoutSession } from "../../../src/services/stripe.service";
import { getStripe } from "../../../src/config/stripe";

const mockGetStripe = getStripe as ReturnType<typeof vi.fn>;

function mockStripe(sessionResult: { url: string | null } = { url: "https://checkout.stripe.com/session-123" }) {
  const createFn = vi.fn().mockResolvedValue(sessionResult);
  const client = {
    checkout: {
      sessions: {
        create: createFn,
      },
    },
  };
  mockGetStripe.mockReturnValue(client);
  return { client, createFn };
}

describe("stripe.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("calls stripe.checkout.sessions.create with correct params", async () => {
      const { createFn } = mockStripe();

      await createCheckoutSession("user-1", "user@test.com");

      expect(createFn).toHaveBeenCalledWith({
        mode: "payment",
        payment_method_types: ["card"],
        client_reference_id: "user-1",
        customer_email: "user@test.com",
        metadata: { product: "growth_credits_2" },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "2 Growth Credits",
                description: "AI-powered profile improvement advice",
              },
              unit_amount: 500,
            },
            quantity: 1,
          },
        ],
        success_url: "http://localhost:3000/checkout-complete",
        cancel_url: "http://localhost:3000/checkout-complete?canceled=true",
      });
    });

    it("returns session.url on success", async () => {
      mockStripe({ url: "https://checkout.stripe.com/abc" });

      const result = await createCheckoutSession("user-1", "user@test.com");

      expect(result).toBe("https://checkout.stripe.com/abc");
    });

    it("throws when session.url is null", async () => {
      mockStripe({ url: null });

      await expect(
        createCheckoutSession("user-1", "user@test.com"),
      ).rejects.toThrow("Stripe did not return a checkout URL");
    });

    it("throws when session.url is undefined", async () => {
      const createFn = vi.fn().mockResolvedValue({});
      mockGetStripe.mockReturnValue({
        checkout: { sessions: { create: createFn } },
      });

      await expect(
        createCheckoutSession("user-1", "user@test.com"),
      ).rejects.toThrow("Stripe did not return a checkout URL");
    });

    it("verifies unit_amount is 500 ($5.00)", async () => {
      const { createFn } = mockStripe();

      await createCheckoutSession("user-1", "user@test.com");

      const args = createFn.mock.calls[0][0];
      expect(args.line_items[0].price_data.unit_amount).toBe(500);
    });

    it("verifies success_url and cancel_url use frontendUrl", async () => {
      const { createFn } = mockStripe();

      await createCheckoutSession("user-1", "user@test.com");

      const args = createFn.mock.calls[0][0];
      expect(args.success_url).toBe(
        "http://localhost:3000/checkout-complete",
      );
      expect(args.cancel_url).toBe(
        "http://localhost:3000/checkout-complete?canceled=true",
      );
    });
  });
});
