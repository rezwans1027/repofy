import { logger } from "./logger";

/**
 * In-memory advisory lock.
 *
 * Prevents concurrent advice generation for the same user within a single
 * process. If we ever scale to multiple backend instances, swap this for
 * a Redis-backed lock.
 *
 * Usage:
 *   const acquired = advisoryLock.acquire("advice:user123", 600);
 *   // ... do work ...
 *   advisoryLock.release("advice:user123");
 */

const locks = new Map<string, number>();

// Safety sweep: expire stale locks that were never released.
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, startedAt] of locks) {
    if (now - startedAt > LOCK_TTL_MS) {
      logger.warn(`Lock "${key}" expired after ${LOCK_TTL_MS / 1000}s — releasing`);
      locks.delete(key);
    }
  }
}, 60_000);
sweepInterval.unref();

function acquire(key: string): boolean {
  if (locks.has(key)) return false;
  locks.set(key, Date.now());
  return true;
}

function release(key: string): void {
  locks.delete(key);
}

function isHeld(key: string): boolean {
  return locks.has(key);
}

export const advisoryLock = { acquire, release, isHeld } as const;
