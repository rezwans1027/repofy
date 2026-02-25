import { RequestHandler } from "express";
import { env } from "../config/env";
import { getStripe } from "../config/stripe";
import { createCheckoutSession } from "../services/stripe.service";
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

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.stripeWebhookSecret,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        logger.info("Checkout completed", {
          sessionId: session.id,
          userId: session.client_reference_id,
          email: session.customer_email,
          amountTotal: session.amount_total,
        });
        // Post-payment logic (granting access, credits, etc.) will be added here
        break;
      }
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Webhook signature verification failed:", err);
    sendError(res, 400, "Webhook signature verification failed");
  }
};
