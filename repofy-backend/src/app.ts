import compression from "compression";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { handleWebhook } from "./controllers/stripe.controller";
import { webhookRateLimit, globalRateLimit } from "./middleware/rateLimit";
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

  // Global IP-based rate limit — applies to ALL routes as a safety net
  app.use(globalRateLimit);

  // Redirect HTTP → HTTPS in production when behind a reverse proxy.
  // Reverse proxies (Railway, Vercel, Nginx) set X-Forwarded-Proto to indicate
  // the original protocol. We redirect if it's not HTTPS.
  if (env.isProduction) {
    app.use((req, res, next) => {
      if (req.headers["x-forwarded-proto"] === "http") {
        const httpsUrl = `https://${req.headers.host}${req.originalUrl}`;
        return res.redirect(301, httpsUrl);
      }
      next();
    });
  }

  // Helmet sets security headers on all responses.
  // This is an API-only server (no HTML/JS served), so CSP is maximally restrictive.
  // HSTS tells browsers to only use HTTPS for the next 1 year, including subdomains.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],     // API serves JSON only — block everything
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: {
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false, // would break CORS-based API consumers
    }),
  );

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
