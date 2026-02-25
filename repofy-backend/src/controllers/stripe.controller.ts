import { RequestHandler } from "express";
import { env } from "../config/env";
import { getStripe } from "../config/stripe";
import { createCheckoutSession } from "../services/stripe.service";
import { grantGrowthCredits } from "../services/credit.service";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const createCheckout: RequestHandler = async (req, res) => {
  try {
    const userId = req.userId;
    const userEmail = req.userEmail;

    if (!userId || !userEmail) {
      sendError(res, 401, "Authentication required");
      return;
    }

    const url = await createCheckoutSession(userId, userEmail);
    sendSuccess(res, { url });
  } catch (err) {
    logger.error("Stripe checkout error:", err);
    sendError(res, 500, "Failed to create checkout session");
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
          email: session.customer_email,
          amountTotal: session.amount_total,
        });

        const userId = session.client_reference_id;
        if (!userId) {
          // Not one of our sessions — safe to ack
          logger.warn("Webhook: missing client_reference_id", { sessionId: session.id });
          break;
        }
        if (session.payment_status !== "paid") {
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
        if (session.amount_total !== 500) {
          logger.error("Webhook invariant: unexpected amount", { sessionId: session.id, amount: session.amount_total });
          sendError(res, 500, "Webhook invariant failure: unexpected amount");
          return;
        }
        if (session.currency !== "usd") {
          logger.error("Webhook invariant: unexpected currency", { sessionId: session.id, currency: session.currency });
          sendError(res, 500, "Webhook invariant failure: unexpected currency");
          return;
        }

        const paymentIntentId = session.payment_intent;
        if (typeof paymentIntentId !== "string" || paymentIntentId.length === 0) {
          logger.error("Webhook invariant: missing or invalid payment_intent", { sessionId: session.id, paymentIntent: paymentIntentId });
          sendError(res, 500, "Webhook invariant failure: missing payment_intent");
          return;
        }
        const granted = await grantGrowthCredits(userId, 2, paymentIntentId, {
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

    res.json({ received: true });
  } catch (err) {
    logger.error("Webhook processing error:", err);
    sendError(res, 500, "Webhook processing failed");
  }
};
