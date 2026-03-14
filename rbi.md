# Real But Intentional / Documented Issues

## #5 — SSRF DNS rebinding unprotected in dev

- **Severity:** High (mitigated)
- **Location:** `repofy-backend/src/services/engine.service.ts:24-25`
- **Issue:** `assertHostNotPrivate()` only runs in production, skipping DNS rebinding protection in development.
- **Why intentional:** Localhost is needed for local dev. The URL is still validated by `validateSafeUrl()` which checks schemes and IP literals. The `engineUrl` comes from env config, not user input.

## #10 — Rate limiting is per-process only

- **Severity:** Medium
- **Location:** `repofy-backend/src/middleware/rateLimit.ts`
- **Issue:** All rate limiters use in-memory `MemoryStore`, which is per-process. Horizontal scaling allows `N × max` requests across replicas.
- **Why intentional:** Extensively documented in the file header with a migration path to `rate-limit-redis`. Acceptable for single-instance Railway deployment.

## #12 — CSP unsafe-inline for styles

- **Severity:** Medium
- **Location:** `repofy-frontend/src/middleware.ts:105`
- **Issue:** `style-src 'unsafe-inline'` weakens XSS protection.
- **Why intentional:** Required by framer-motion (inline `element.style` manipulation) and html2canvas-pro. Documented with a detailed risk analysis in the source. Mitigated by nonce-locked `script-src` and restrictive `connect-src`.

## #16 — Token cache uses FIFO not LRU

- **Severity:** Low
- **Location:** `repofy-backend/src/middleware/auth.ts:25-35`
- **Issue:** Cache eviction deletes the oldest inserted entry (FIFO) rather than least-recently-used, allowing theoretical cache poisoning.
- **Why intentional:** Exploiting this requires valid Supabase tokens in the first place. The 60s TTL and 256 entry cap make the attack impractical. Acceptable tradeoff for implementation simplicity.
