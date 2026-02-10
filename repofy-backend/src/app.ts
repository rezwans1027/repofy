import express from "express";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import routes from "./routes";

export function createApp() {
  const app = express();

  // Only trust reverse proxy when explicitly configured (production behind LB/Nginx)
  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(corsMiddleware);
  app.use(express.json());

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
