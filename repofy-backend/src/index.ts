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

app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
});
