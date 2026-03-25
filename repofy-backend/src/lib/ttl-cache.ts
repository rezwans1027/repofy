/**
 * Generic in-memory TTL cache with LRU eviction.
 *
 * Consolidates the previously duplicated Map + timestamp + sweep pattern
 * used across cache.service, github.controller, github.service, and
 * the auth middleware.
 */
export class TTLCache<T> {
  private map = new Map<string, { data: T; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly sweepTimer: ReturnType<typeof setInterval>;

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.map) {
        if (now >= entry.expiresAt) this.map.delete(key);
      }
    }, ttlMs);
    this.sweepTimer.unref();
  }

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // LRU: move to end of iteration order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T): void {
    this.map.delete(key); // re-sets move to end
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}
