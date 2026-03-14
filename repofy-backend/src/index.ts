import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { cleanExpiredCache } from "./services/cache.service";

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

// Purge expired DB cache rows every hour
const cacheCleanupInterval = setInterval(() => {
  cleanExpiredCache().catch((err) =>
    logger.warn("Scheduled cache cleanup failed", { error: err }),
  );
}, 60 * 60 * 1000);
cacheCleanupInterval.unref();

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  clearInterval(cacheCleanupInterval);
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
