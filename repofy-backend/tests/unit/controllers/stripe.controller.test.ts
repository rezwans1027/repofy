import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/stripe.service", () => ({
  createCheckoutSession: vi.fn(),
}));
vi.mock("../../../src/config/stripe", () => ({
  getStripe: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createCheckout, handleWebhook } from "../../../src/controllers/stripe.controller";
import { createCheckoutSession } from "../../../src/services/stripe.service";
import { getStripe } from "../../../src/config/stripe";

const mockCreateCheckoutSession = createCheckoutSession as ReturnType<typeof vi.fn>;
const mockGetStripe = getStripe as ReturnType<typeof vi.fn>;

describe("createCheckout controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when userId is missing", async () => {
    const { req, res, next } = createControllerMocks();
    // No userId/userEmail on req

    await createCheckout(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Authentication required",
    });
  });

  it("returns 401 when userEmail is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await createCheckout(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Authentication required",
    });
  });

  it("returns checkout URL on success", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).userEmail = "test@example.com";
    mockCreateCheckoutSession.mockResolvedValue("https://checkout.stripe.com/session-123");

    await createCheckout(req, res, next);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith("user-123", "test@example.com");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { url: "https://checkout.stripe.com/session-123" },
    });
  });

  it("returns 500 when service throws", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).userEmail = "test@example.com";
    mockCreateCheckoutSession.mockRejectedValue(new Error("Stripe down"));

    await createCheckout(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to create checkout session",
    });
  });
});

describe("handleWebhook controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).headers = {};

    await handleWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Missing stripe-signature header",
    });
  });

  it("returns 400 when signature verification fails", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_bad" };
    (req as any).body = Buffer.from("{}");
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error("Invalid signature");
        }),
      },
    });

    await handleWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Webhook signature verification failed",
    });
  });

  it("returns { received: true } for checkout.session.completed", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_123",
              client_reference_id: "user-123",
              customer_email: "test@example.com",
              amount_total: 500,
            },
          },
        }),
      },
    });

    await handleWebhook(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("returns { received: true } for unhandled event types", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          type: "payment_intent.succeeded",
          data: { object: {} },
        }),
      },
    });

    await handleWebhook(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
