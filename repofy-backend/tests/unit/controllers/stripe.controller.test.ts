import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/stripe.service", () => ({
  createCheckoutSession: vi.fn(),
}));
vi.mock("../../../src/services/credit.service", () => ({
  grantGrowthCredits: vi.fn(),
}));
vi.mock("../../../src/config/stripe", () => ({
  getStripe: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createCheckout, handleWebhook } from "../../../src/controllers/stripe.controller";
import { createCheckoutSession } from "../../../src/services/stripe.service";
import { grantGrowthCredits } from "../../../src/services/credit.service";
import { getStripe } from "../../../src/config/stripe";
import { logger } from "../../../src/lib/logger";

const mockCreateCheckoutSession = createCheckoutSession as ReturnType<typeof vi.fn>;
const mockGrantGrowthCredits = grantGrowthCredits as ReturnType<typeof vi.fn>;
const mockGetStripe = getStripe as ReturnType<typeof vi.fn>;

function buildWebhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        client_reference_id: "user-123",
        customer_email: "test@example.com",
        amount_total: 500,
        currency: "usd",
        payment_status: "paid",
        mode: "payment",
        payment_intent: "pi_abc",
        metadata: { product: "growth_credits_2" },
        ...overrides,
      },
    },
  };
}

function mockStripeWithEvent(event: unknown) {
  mockGetStripe.mockReturnValue({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
  });
}

describe("createCheckout controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("grants credits on valid checkout.session.completed", async () => {
    const event = buildWebhookEvent();
    mockStripeWithEvent(event);
    mockGrantGrowthCredits.mockResolvedValue(true);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).toHaveBeenCalledWith("user-123", 2, "pi_abc", {
      stripe_event_id: "evt_123",
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { received: true } });
  });

  it("logs idempotent skip when grant returns false", async () => {
    const event = buildWebhookEvent();
    mockStripeWithEvent(event);
    mockGrantGrowthCredits.mockResolvedValue(false);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).toHaveBeenCalledWith("user-123", 2, "pi_abc", {
      stripe_event_id: "evt_123",
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Growth credits already granted (idempotent)",
      expect.objectContaining({ userId: "user-123", paymentIntentId: "pi_abc" }),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { received: true } });
  });

  it("skips grant when client_reference_id is null", async () => {
    const event = buildWebhookEvent({ client_reference_id: null });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Webhook: missing client_reference_id",
      expect.any(Object),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { received: true } });
  });

  it("skips grant when payment_status is not paid", async () => {
    const event = buildWebhookEvent({ payment_status: "unpaid" });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Webhook: payment_status not paid",
      expect.any(Object),
    );
  });

  it("returns 500 when amount_total is not 500 (invariant violation)", async () => {
    const event = buildWebhookEvent({ amount_total: 1000 });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Webhook invariant: unexpected amount",
      expect.any(Object),
    );
  });

  it("returns 500 when currency is not usd (invariant violation)", async () => {
    const event = buildWebhookEvent({ currency: "eur" });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Webhook invariant: unexpected currency",
      expect.any(Object),
    );
  });

  it("returns 500 when product metadata doesn't match (invariant violation)", async () => {
    const event = buildWebhookEvent({ metadata: { product: "other" } });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Webhook invariant: unexpected product metadata",
      expect.any(Object),
    );
  });

  it("returns 500 when payment_intent is missing (invariant violation)", async () => {
    const event = buildWebhookEvent({ payment_intent: null });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Webhook invariant: missing or invalid payment_intent",
      expect.any(Object),
    );
  });

  it("returns 500 when mode is not payment (invariant violation)", async () => {
    const event = buildWebhookEvent({ mode: "subscription" });
    mockStripeWithEvent(event);

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(mockGrantGrowthCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Webhook invariant: unexpected mode",
      expect.any(Object),
    );
  });

  it("returns 500 when credit grant throws (processing error, not signature)", async () => {
    const event = buildWebhookEvent();
    mockStripeWithEvent(event);
    mockGrantGrowthCredits.mockRejectedValue(new Error("DB connection lost"));

    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");

    await handleWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Webhook processing failed",
    });
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

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { received: true } });
  });
});
