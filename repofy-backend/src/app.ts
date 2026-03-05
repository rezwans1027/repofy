import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { handleWebhook } from "./controllers/stripe.controller";
import { webhookRateLimit } from "./middleware/rateLimit";
import routes from "./routes";

export function createApp() {
  const app = express();

  // Only trust reverse proxy when explicitly configured (production behind LB/Nginx)
  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }

  // Stripe webhook needs raw body for signature verification — must be registered
  // before express.json() so the body is not parsed as JSON.
  app.post(
    "/api/stripe/webhook",
    webhookRateLimit,
    express.raw({ type: "application/json" }),
    handleWebhook,
  );

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json());

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
