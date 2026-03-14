import { getRedis } from "./redis";
import { logger } from "./logger";

/**
 * Distributed advisory lock backed by Redis SETNX + TTL.
 *
 * Falls back to an in-memory Map when Redis is unavailable so the app
 * continues to work in single-process mode (with the same per-process
 * limitation the codebase had before this change).
 *
 * Usage:
 *   const acquired = await advisoryLock.acquire("advice:user123", 600);
 *   // ... do work ...
 *   await advisoryLock.release("advice:user123");
 */

const LOCK_PREFIX = "repofy:lock:";

// In-memory fallback (per-process only — same as original Map behaviour).
const localLocks = new Map<string, number>();

// Safety sweep for the in-memory fallback, matching the original controller
// pattern. Unref'd so it doesn't prevent graceful shutdown.
const LOCAL_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, startedAt] of localLocks) {
    if (now - startedAt > LOCAL_LOCK_TTL_MS) localLocks.delete(key);
  }
}, 60_000);
sweepInterval.unref();

/**
 * Try to acquire a lock.
 *
 * @param key   Unique lock identifier (e.g. `"advice:<userId>"`).
 * @param ttlSeconds  Auto-expiry in seconds (safety net if release is missed).
 * @returns `true` if the lock was acquired, `false` if already held.
 */
async function acquire(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();

  if (redis) {
    try {
      // SET key value NX EX ttl — atomic set-if-not-exists with expiry
      const result = await redis.set(
        `${LOCK_PREFIX}${key}`,
        Date.now().toString(),
        "EX",
        ttlSeconds,
        "NX",
      );
      return result === "OK";
    } catch (err) {
      logger.warn(`Redis lock acquire failed for "${key}" — falling back to in-memory`, err);
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  if (localLocks.has(key)) return false;
  localLocks.set(key, Date.now());
  return true;
}

/**
 * Release a previously acquired lock.
 *
 * @param key  The same key that was passed to `acquire`.
 */
async function release(key: string): Promise<void> {
  // Always clean up local map (may have been used as fallback)
  localLocks.delete(key);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`${LOCK_PREFIX}${key}`);
    } catch (err) {
      logger.warn(`Redis lock release failed for "${key}"`, err);
      // Non-fatal: TTL will expire the key automatically
    }
  }
}

/**
 * Check whether a lock is currently held (without acquiring it).
 *
 * @param key  The lock key.
 * @returns `true` if the lock exists.
 */
async function isHeld(key: string): Promise<boolean> {
  const redis = getRedis();

  if (redis) {
    try {
      const exists = await redis.exists(`${LOCK_PREFIX}${key}`);
      return exists === 1;
    } catch (err) {
      logger.warn(`Redis lock check failed for "${key}" — falling back to in-memory`, err);
    }
  }

  return localLocks.has(key);
}

export const advisoryLock = { acquire, release, isHeld } as const;
