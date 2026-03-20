# Security Audit Report — Verified Issues

17 real issues identified across repofy-frontend and repofy-backend.

---

## CRITICAL

### #2 — Missing credit check on /analyze endpoint
- **Location:** `analyze.controller.ts:27-94`
- **Severity:** Critical
- **Description:** AI analysis runs without checking or deducting credits. The `/advice` endpoint properly calls `getCreditBalance()` and `deductAndPersist()`, but `/analyze` has neither — allowing unlimited free usage.

---

## HIGH

### #4 — Race condition in concurrent advice requests
- **Location:** `advice.controller.ts:32-42`
- **Severity:** High
- **Description:** In-flight tracking uses a per-process `Map<string, number>`. In multi-instance deployments, each replica tracks state independently, allowing double-spending of credits via concurrent requests to different instances.

### #5 — SSRF DNS rebinding unprotected in dev
- **Location:** `engine.service.ts:24-25`
- **Severity:** High
- **Description:** `assertHostNotPrivate()` is gated behind `env.isProduction`. In development, DNS rebinding attacks can resolve public hostnames to private IPs (e.g., 127.0.0.1) without detection.

### #7 — NaN propagation in admin query params
- **Location:** `admin.controller.ts:6-7`
- **Severity:** High
- **Description:** `Math.max(1, parseInt(req.query.page as string))` returns NaN when `page` is non-numeric, since `Math.max(1, NaN)` evaluates to NaN. This NaN propagates into database queries, potentially corrupting pagination.

### #8 — Insufficient query parameter type validation in GitHub search
- **Location:** `github.controller.ts:69`
- **Severity:** High
- **Description:** The `q` parameter is coerced via `.toString()` without explicit type validation. Relies on downstream services to handle unexpected input rather than validating at the API boundary.

---

## MEDIUM

### #10 — Rate limiting is per-process only
- **Location:** `rateLimit.ts`
- **Severity:** Medium
- **Description:** All rate limiters use express-rate-limit's default MemoryStore. In horizontally-scaled deployments, each replica tracks limits independently, effectively multiplying allowed requests by the number of instances. A TODO comment acknowledges the need to switch to Redis.

### #11 — GitHub API budget exhaustion
- **Location:** `rateLimit.ts:90-91`
- **Severity:** Medium
- **Description:** The proxy allows 30 search requests/min per user, but each profile fetch triggers multiple GitHub API calls (user, repos, events, contributions, per-repo data). With concurrency of 3, multiple simultaneous users can exceed GitHub's 60 req/min token limit. Severity is somewhat mitigated by the concurrency cap.

### #12 — CSP unsafe-inline for styles
- **Location:** `middleware.ts:105`
- **Severity:** Medium
- **Description:** `style-src 'self' 'unsafe-inline'` weakens XSS protection. Required by framer-motion and html2canvas-pro which manipulate `element.style` directly. Documented as an accepted risk with mitigations (nonce-locked script-src, restrictive connect-src).

### #13 — Error messages expose API internals
- **Location:** `errorHandler.ts:20-21`
- **Severity:** Medium
- **Description:** For non-500 errors, the raw `err.message` is sent to the client. This can leak implementation details, database error messages, or internal paths to attackers.

### #14 — No UUID format validation on batch delete IDs
- **Location:** `crud.controller.ts:66-76`
- **Severity:** Medium
- **Description:** Batch delete only validates that each ID is a `typeof "string"`. No UUID format regex or `validate()` check is applied, allowing arbitrary strings (including potential injection payloads) to reach the database layer.

### #15 — Session storage used for credit balance
- **Location:** `pricing/page.tsx:59-65`
- **Severity:** Medium
- **Description:** Pre-checkout credit balance is stored in `sessionStorage`, which is accessible to XSS. Impact is low since the value is used for UI display comparison only (detecting when credits arrive), not for authorization decisions.

### #16 — Token cache uses FIFO not LRU
- **Location:** `auth.ts:25-35`
- **Severity:** Medium
- **Description:** The 256-entry token cache evicts via `Map.keys().next().value` (first inserted), not least recently used. An attacker can pollute the cache with valid tokens to evict frequently-used ones, forcing Supabase roundtrips and enabling performance-based DoS.

---

## LOW

### #18 — Weak request ID format validation
- **Location:** `requestId.ts`
- **Severity:** Low
- **Description:** Accepts any 1-128 character alphanumeric/hyphen string as a client-provided request ID. No validation for UUID or other structured format, potentially enabling log injection or correlation issues.

### #19 — Unused OPENAI_API_KEY reference in .env.example
- **Location:** `.env.example:10`
- **Severity:** Low
- **Description:** `OPENAI_API_KEY` is listed in the example env file but appears unused in the codebase. Creates confusion for new developers and suggests a dependency that doesn't exist.

### #20 — Client-side search has no rate cap
- **Location:** `dashboard/page.tsx:22`
- **Severity:** Low
- **Description:** Search input uses a 300ms debounce but has no request rate cap. Rapid input of different queries can generate many API calls per second without throttling beyond the debounce window.

### #21 — Unsanitized engine error text
- **Location:** `engine.service.ts:44`
- **Severity:** Low
- **Description:** Raw response text from the engine service is thrown directly in `new Error()` without sanitization. If the engine returns verbose or malicious content, it propagates into error handlers and logs.

### #22 — Health endpoint has no rate limiter
- **Location:** `health.routes.ts`
- **Severity:** Low
- **Description:** The `/api/health` endpoint has no rate-limiting middleware. Can be hammered without restriction, enabling DoS or log inflation.
