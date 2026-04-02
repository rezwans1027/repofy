import { RequestHandler } from "express";
import { env } from "../config/env";
import { getStripe } from "../config/stripe";
import { createCheckoutSession, GROWTH_CREDITS_2_AMOUNT } from "../services/stripe.service";
import { grantGrowthCredits } from "../services/credit.service";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";
import { handleControllerError } from "../lib/controller-utils";
import type { AuthenticatedRequest } from "../types";

export const createCheckout: RequestHandler = async (req, res) => {
  try {
    const { userId, userEmail } = req as AuthenticatedRequest;

    const url = await createCheckoutSession(userId, userEmail);
    sendSuccess(res, { url });
  } catch (err) {
    handleControllerError(err, req, res, "Stripe Checkout", "Failed to create checkout session");
  }
};

export const handleWebhook: RequestHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"] as string | undefined;

  if (!sig) {
    sendError(res, 400, "Missing stripe-signature header");
    return;
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.stripeWebhookSecret,
    );
  } catch (err) {
    logger.error("Webhook signature verification failed:", err);
    sendError(res, 400, "Webhook signature verification failed");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        logger.info("Checkout completed", {
          sessionId: session.id,
          userId: session.client_reference_id,
          amountTotal: session.amount_total,
        });

        const userId = session.client_reference_id;
        if (!userId) {
          // Not one of our sessions — safe to ack
          logger.warn("Webhook: missing client_reference_id", { sessionId: session.id });
          break;
        }
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          // Async payment method not yet paid — Stripe will send another event when paid
          logger.warn("Webhook: payment_status not paid", { sessionId: session.id, status: session.payment_status });
          break;
        }

        // From here the event IS ours — invariant violations must fail so Stripe retries
        if (session.mode !== "payment") {
          logger.error("Webhook invariant: unexpected mode", { sessionId: session.id, mode: session.mode });
          sendError(res, 500, "Webhook invariant failure: unexpected mode");
          return;
        }
        if (session.metadata?.product !== "growth_credits_2") {
          logger.error("Webhook invariant: unexpected product metadata", { sessionId: session.id, metadata: session.metadata });
          sendError(res, 500, "Webhook invariant failure: unexpected product");
          return;
        }
        if (session.currency !== "usd") {
          logger.error("Webhook invariant: unexpected currency", { sessionId: session.id, currency: session.currency });
          sendError(res, 500, "Webhook invariant failure: unexpected currency");
          return;
        }
        if (session.amount_total === null || session.amount_total < 0 || session.amount_total > GROWTH_CREDITS_2_AMOUNT) {
          logger.error("Webhook invariant: unexpected amount", { sessionId: session.id, expected: `0–${GROWTH_CREDITS_2_AMOUNT}`, actual: session.amount_total });
          sendError(res, 500, "Webhook invariant failure: unexpected amount");
          return;
        }

        // For $0 checkouts (100% coupon), Stripe doesn't create a payment_intent — use session ID as idempotency key
        const paymentIntentId = typeof session.payment_intent === "string" && session.payment_intent.length > 0
          ? session.payment_intent
          : null;
        if (!paymentIntentId && (session.amount_total ?? 0) > 0) {
          logger.error("Webhook invariant: missing payment_intent for non-zero amount", { sessionId: session.id, paymentIntent: session.payment_intent });
          sendError(res, 500, "Webhook invariant failure: missing payment_intent");
          return;
        }
        const idempotencyKey = paymentIntentId ?? `session_${session.id}`;
        const granted = await grantGrowthCredits(userId, 2, idempotencyKey, {
          stripe_event_id: event.id,
        });

        if (granted) {
          logger.info("Growth credits granted", { userId, paymentIntentId });
        } else {
          logger.info("Growth credits already granted (idempotent)", { userId, paymentIntentId });
        }

        break;
      }
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    sendSuccess(res, { received: true });
  } catch (err) {
    logger.error("Webhook processing error:", err);
    sendError(res, 500, "Webhook processing failed");
  }
};
