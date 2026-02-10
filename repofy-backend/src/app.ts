import express from "express";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import routes from "./routes";

export function createApp() {
  const app = express();

  // Trust first reverse proxy (load balancer / Nginx) so req.ip is the real client IP
  app.set("trust proxy", 1);

  app.use(corsMiddleware);
  app.use(express.json());

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
