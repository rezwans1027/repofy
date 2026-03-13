import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const app = createApp();

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { error: reason });
  process.exit(1);
});

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
});

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info("All in-flight requests completed, exiting");
    process.exit(0);
  });

  // Force exit if in-flight requests don't finish within 30s
  setTimeout(() => {
    logger.error("Graceful shutdown timed out after 30s, forcing exit");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
