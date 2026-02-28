import Stripe from "stripe";
import { env } from "./env";

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_client) {
    _client = new Stripe(env.stripeSecretKey);
  }
  return _client;
}
