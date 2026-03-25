import { env } from "../config/env";
import { getStripe } from "../config/stripe";

const FRONTEND_URL = env.frontendUrl;

/** Canonical price in cents for the 2-credit growth pack. */
export const GROWTH_CREDITS_2_AMOUNT = 1000;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: userId,
    customer_email: userEmail,
    metadata: {
      product: "growth_credits_2",
    },
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "2 Growth Credits",
            description: "AI-powered profile improvement advice",
          },
          unit_amount: GROWTH_CREDITS_2_AMOUNT,
        },
        quantity: 1,
      },
    ],
    success_url: `${FRONTEND_URL}/checkout-complete`,
    cancel_url: `${FRONTEND_URL}/checkout-complete?canceled=true`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}
