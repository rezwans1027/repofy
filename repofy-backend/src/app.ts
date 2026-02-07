import express from "express";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import routes from "./routes";

export function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
