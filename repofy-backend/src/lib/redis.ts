import Redis from "ioredis";
import { logger } from "./logger";

/**
 * Lazily-initialised, shared Redis client.
 *
 * Connects to the URL in `REDIS_URL` (defaults to `redis://localhost:6379`).
 * If Redis is unavailable the client emits errors via the logger but never
 * throws — callers should treat `getRedis()` returning `null` as "Redis
 * unavailable, fall back to in-memory."
 */

let client: Redis | null = null;
let connectionFailed = false;

export function getRedis(): Redis | null {
  if (connectionFailed) return null;

  if (!client) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";

    try {
      client = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          // After 3 reconnect attempts, stop retrying and mark as unavailable.
          if (times > 3) {
            logger.warn("Redis: giving up reconnection after 3 attempts — falling back to in-memory locks");
            connectionFailed = true;
            return null; // stop retrying
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true, // don't connect until first command
        enableReadyCheck: true,
        connectTimeout: 5000,
      });

      client.on("error", (err) => {
        logger.warn("Redis connection error", err);
      });

      client.on("ready", () => {
        logger.info("Redis connected");
        connectionFailed = false;
      });

      client.on("close", () => {
        logger.info("Redis connection closed");
      });
    } catch (err) {
      logger.warn("Redis: failed to create client — falling back to in-memory locks", err);
      connectionFailed = true;
      client = null;
      return null;
    }
  }

  return client;
}

/**
 * Gracefully shut down the Redis connection (call during app shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore — may already be disconnected
    }
    client = null;
  }
}
