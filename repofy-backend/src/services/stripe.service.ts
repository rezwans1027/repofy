import { env } from "../config/env";
import { getStripe } from "../config/stripe";

const FRONTEND_URL = env.frontendUrl;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId,
    customer_email: userEmail,
    metadata: {
      product: "growth_credits_2",
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "2 Growth Credits",
            description: "AI-powered profile improvement advice",
          },
          unit_amount: 500, // $5.00
        },
        quantity: 1,
      },
    ],
    success_url: `${FRONTEND_URL}/pricing?success=true`,
    cancel_url: `${FRONTEND_URL}/pricing?canceled=true`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}
