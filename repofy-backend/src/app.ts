import compression from "compression";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { handleWebhook } from "./controllers/stripe.controller";
import { webhookRateLimit } from "./middleware/rateLimit";
import { requestId } from "./middleware/requestId";
import routes from "./routes";

export function createApp() {
  const app = express();

  // Trust reverse proxy in production (behind LB/Nginx) unless explicitly disabled
  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }

  // Request ID for log correlation — must be first
  app.use(requestId);

  // Helmet sets security headers on all responses — safe before raw body parsing
  app.use(helmet());

  // gzip/brotli compression — ~60-70% payload savings on JSON responses
  app.use(compression());

  // Stripe webhook needs raw body for signature verification — must be registered
  // before express.json() so the body is not parsed as JSON.
  // CORS is not needed: Stripe sends server-to-server, not browser requests.
  app.post(
    "/api/stripe/webhook",
    webhookRateLimit,
    express.raw({ type: "application/json" }),
    handleWebhook,
  );

  app.use(corsMiddleware);
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
