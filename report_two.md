# Repofy Security Audit — Consolidated Report

4 agents reviewed the entire monorepo across backend API, frontend, infrastructure/dependencies, and data flow/business logic. Here are the consolidated findings, deduplicated and prioritized.

---

## Overall Assessment

**The codebase has a strong security posture.** No critical code-level vulnerabilities were found. Auth is consistently enforced, IDOR is prevented everywhere, no eval/innerHTML/dangerouslySetInnerHTML usage, CSP with nonces, Helmet, CORS allowlisting, atomic credit deduction, and OTP is well-designed with HMAC + timing-safe comparison. The main risks are operational (secret management, scaling gaps) rather than exploitable code flaws.

---

## CRITICAL — 1 Finding (Operational)

| # | Issue | Location |
|---|-------|----------|
| C1 | **Secrets on disk need rotation verification** | `repofy-backend/.env`, `repofy-frontend/.env.local` |

The `.env` files contain live production secrets (Supabase service role key, GitHub PAT, OpenAI key, Stripe secret key, Resend key, admin secret, OTP HMAC secret). They are correctly gitignored but the root `.gitignore` doesn't have a catch-all `**/.env` entry. If this repo is or ever becomes public, all keys should be rotated. Git history was checked and appears clean.

**Action:** Add `**/.env` and `**/.env.local` to root `.gitignore`. Verify no secrets exist in any branch history. Remove unused `OPENAI_API_KEY` from backend `.env`/`.env.example` (it's consumed by the engine service, not this backend).

---

## HIGH — 4 Findings

| # | Issue | Location | Details |
|---|-------|----------|---------|
| H1 | **Unvalidated Stripe redirect URL** | `pricing/page.tsx:104` | `window.location.href = url` from API response without checking it starts with `https://checkout.stripe.com/` |
| H2 | **`javascript:` XSS vector in repo links** | `profile-sections.tsx:160` | `<a href={repo.url}>` — React doesn't sanitize `javascript:` protocol in href |
| H3 | **In-process-only concurrency lock** | `advice.controller.ts:27` | `activeAdviceRequests` Map is per-process; breaks under horizontal scaling, allowing potential double-charge |
| H4 | **`select("*")` over-fetches OTP hash** | `auth.service.ts:161` | `resendOtp` fetches all columns including hashed OTP; violates least-privilege |

**Also noted:** `flatted` dependency has a HIGH CVE (DoS via unbounded recursion) — run `npm audit fix` in frontend.

---

## MEDIUM — 10 Findings

| # | Issue | Location |
|---|-------|----------|
| M1 | Log injection via trusted `x-request-id` header | `requestId.ts:13` |
| M2 | `ENGINE_URL` not validated at startup (SSRF if misconfigured) | `engine.service.ts:9` |
| M3 | `NaN` not guarded in `limit`/`offset` query params | `crud.controller.ts:33-34` |
| M4 | `getSession()` used separately from `getUser()` for token | `server-api.ts:22-25` |
| M5 | `style-src 'unsafe-inline'` required by framer-motion | `middleware.ts:89` |
| M6 | Raw Supabase error messages shown to users | `login/page.tsx:51` |
| M7 | Email addresses logged at INFO level (PII in logs) | `auth.service.ts` (multiple lines) |
| M8 | Credit pre-check is TOCTOU (optimization, not security boundary) | `advice.controller.ts:64-68` |
| M9 | `filePath` not URI-encoded in GitHub content fetch | `github.service.ts:838` |
| M10 | `allowTaint: true` in PDF html2canvas | `export-pdf.ts:146` |

---

## LOW — 7 Findings

| # | Issue | Location |
|---|-------|----------|
| L1 | Health endpoint exposes `process.uptime()` | `health.controller.ts:14` |
| L2 | In-memory rate limit not globally enforced (documented) | `rateLimit.ts` |
| L3 | Stack traces exposed in non-production envs | `errorHandler.ts:22` |
| L4 | `suppressHydrationWarning` on `<body>` masks issues | `layout.tsx:36` |
| L5 | No `noUncheckedIndexedAccess` in backend tsconfig | `tsconfig.json` |
| L6 | No RLS as defense-in-depth (service role key used) | `supabase.ts:9` |
| L7 | No CI/CD pipeline for automated security checks | No `.github/` directory |

---

## Top 5 Recommended Actions (Priority Order)

1. **Fix H1 + H2** — Validate Stripe redirect URL and sanitize repo `href` against `javascript:` protocol. Both are quick, high-impact fixes.

2. **Fix H4** — Replace `select("*")` with `select("email, display_name, attempts")` in `resendOtp`.

3. **Fix M3** — Add `isNaN` guard on `limit`/`offset` parsing in `crud.controller.ts`.

4. **Run `npm audit fix`** in `repofy-frontend/` to patch the `flatted` vulnerability.

5. **Add `**/.env*` to root `.gitignore`** and verify git history is clean across all branches.

---

## What's Done Well

- Supabase JWT verification on all protected routes
- Timing-safe comparison for admin key and OTP
- Atomic credit deduction via DB RPC with idempotency key
- CSP with per-request nonces + comprehensive security headers
- CORS exact-match allowlist, Helmet, HSTS with preload
- No `dangerouslySetInnerHTML`, `eval`, or `innerHTML` anywhere
- Open redirect protection in auth callback
- Stripe webhook signature verification
- Username validated against strict regex before GitHub API use
- No SSRF — GitHub API base URL is hardcoded
- No IDOR — all DB queries filter by `user_id`
- No mass assignment — all fields explicitly mapped
- 100KB JSON body limit
- OTP: HMAC-SHA256, 5-attempt lockout, 10-min expiry

---

## Detailed Findings by Domain

### Backend API Security

#### MEDIUM-1 — requestId Header Trust
- **File:** `src/middleware/requestId.ts:13`
- **Severity:** Medium
- **Description:** The server blindly trusts the client-supplied `x-request-id` header and echoes it back into logs without sanitization. A malicious actor can inject arbitrary strings into log lines (log injection), potentially poisoning structured log parsers or log monitoring alerts.
- **Fix:** Sanitize/validate the incoming header (e.g. accept only UUID-shaped values, strip non-printable characters), or generate the ID server-side always and ignore the client header.

#### MEDIUM-2 — SSRF via Engine URL from Environment
- **File:** `src/services/engine.service.ts:9`
- **Severity:** Medium
- **Description:** `ENGINE_URL` is read from environment and used directly as an HTTP fetch target with no validation. If the env var is misconfigured or tampered in a compromised deployment pipeline, an attacker could cause the backend to make internal network requests to arbitrary hosts. The `path` is always hardcoded (`/analyze`, `/advice`), limiting exploitability, but the base URL has no allowlist validation at startup.
- **Fix:** At startup, validate `ENGINE_URL` against an allowlist of known internal hosts/patterns. Fail fast if it doesn't match.

#### MEDIUM-3 — In-Memory Idempotency for Concurrent Advice Requests
- **File:** `src/controllers/advice.controller.ts:27-45`
- **Severity:** Medium
- **Description:** The `activeAdviceRequests` Map prevents concurrent expensive calls but is per-process only. In a horizontally-scaled deployment, two simultaneous requests from the same user on different instances would both pass the check, potentially double-charging credits.
- **Fix:** Replace with a distributed lock (e.g., Redis SETNX with TTL, or a DB advisory lock) before incurring AI costs.

#### MEDIUM-4 — GitHub File Content Fetched Without Path Validation
- **File:** `src/services/github.service.ts:837-839`
- **Severity:** Medium
- **Description:** `filePath` from the GitHub tree API is directly interpolated into the URL path without `encodeURIComponent` or `..` traversal check.
- **Fix:** Add a check: `if (filePath.includes("..") || filePath.startsWith("/")) skip`. Apply `encodeURIComponent` to path segments.

#### MEDIUM-5 — No Input Validation on Search Query Forwarded to GitHub API
- **File:** `src/controllers/github.controller.ts:13`
- **Severity:** Medium (Low practical risk)
- **Description:** The GitHub search query is truncated to 256 chars but otherwise forwarded verbatim. `encodeURIComponent` is applied so the API itself is protected, but users can craft expensive queries that burn through GitHub API rate limits.
- **Fix:** Current mitigations (rate limiting at 30 req/min per user) are likely sufficient. Consider basic content validation for additional protection.

#### LOW — Stack Trace in Non-Production Error Response
- **File:** `src/middleware/errorHandler.ts:22-26`
- **Severity:** Low
- **Description:** Stack traces are exposed in non-production environments. If staging/preview environments are publicly accessible, internal implementation details could leak.
- **Fix:** Ensure staging/preview deployments set `NODE_ENV=production`. Consider a separate `EXPOSE_STACK_TRACES` env var.

#### LOW — Health Endpoint Exposes Uptime
- **File:** `src/controllers/health.controller.ts:14`
- **Severity:** Low
- **Description:** The health endpoint returns `process.uptime()` to unauthenticated callers, revealing deployment timing.
- **Fix:** Remove `uptime` from the public health response; `status` + `timestamp` are sufficient.

#### LOW — Rate Limit Store is Per-Process
- **File:** `src/middleware/rateLimit.ts:1-11`
- **Severity:** Low (documented)
- **Description:** All rate limiters use in-memory `MemoryStore`. In multi-instance deployments, limits are not enforced globally.
- **Fix:** Use a shared store (e.g. `rate-limit-redis`) for production horizontal scaling.

---

### Frontend Security

#### HIGH — Unvalidated External URL in Stripe Redirect
- **File:** `repofy-frontend/src/app/(app)/pricing/page.tsx:104`
- **Severity:** High
- **Description:** `window.location.href = url` — the URL comes directly from the backend API response with no client-side validation that it's a legitimate Stripe checkout URL.
- **Fix:** Validate that `url` starts with `https://checkout.stripe.com/` before assigning to `window.location.href`.

#### HIGH — Unvalidated Repo URL as `<a href>`
- **File:** `repofy-frontend/src/components/profile/profile-sections.tsx:160`
- **Severity:** High
- **Description:** `<a href={repo.url}>` — React does not sanitize `href` values against `javascript:` protocol. If the backend passes through a malicious URL, clicking the link executes arbitrary JavaScript.
- **Fix:** Validate `repo.url` before rendering: `const safeUrl = repo.url?.startsWith('http') ? repo.url : undefined;`

#### MEDIUM — `getSession()` Used After `getUser()` — Token Not Re-verified
- **File:** `repofy-frontend/src/lib/server-api.ts:22-25`
- **Severity:** Medium
- **Description:** The code calls `getUser()` (JWT validation) then `getSession()` separately for the access token. In edge cases during token rotation, the validated user and the token sent to the backend may differ.
- **Fix:** Derive the access token from the same verified session after `getUser()` succeeds.

#### MEDIUM — `style-src 'unsafe-inline'` in CSP
- **File:** `repofy-frontend/src/middleware.ts:89`
- **Severity:** Medium
- **Description:** Required by framer-motion inline styles. Weakens protection against CSS injection.
- **Fix:** Known trade-off. Evaluate framer-motion v12+ for improved CSP support. Document as accepted risk.

#### MEDIUM — Raw Supabase Error Messages Shown to User
- **File:** `repofy-frontend/src/app/(auth)/login/page.tsx:51`
- **Severity:** Medium
- **Description:** `setErrors({ form: error.message })` — verbose Supabase messages could aid user enumeration.
- **Fix:** Map Supabase error codes to generic user-facing messages.

#### LOW — `suppressHydrationWarning` on `<body>`
- **File:** `repofy-frontend/src/app/layout.tsx:36-40`
- **Severity:** Low
- **Description:** Suppresses React hydration mismatch warnings for the entire body. Used legitimately for next-themes but could mask real issues.
- **Fix:** Limit `suppressHydrationWarning` to only elements that need it.

---

### Infrastructure & Dependencies

#### HIGH — `flatted` Vulnerability (DoS)
- **Package:** `flatted <3.4.0` (GHSA-25h7-pfq9-p65f, CVSS 7.5)
- **Description:** Unbounded recursion DoS in `parse()` revive phase. Transitive dependency.
- **Fix:** Run `npm audit fix` in `repofy-frontend/`.

#### HIGH — No CI/CD Pipeline
- **Description:** No `.github/` directory exists. No automated `npm audit`, secret scanning, tests, or Dependabot.
- **Fix:** Add `.github/workflows/ci.yml` with `npm audit`, `npm test`, `npm run typecheck`. Enable GitHub secret scanning and Dependabot.

#### MEDIUM — Email Addresses Logged at INFO Level (PII)
- **Files:** `src/services/auth.service.ts:62,88,93,115,141,151,187,192` and `src/services/email.service.ts:28,32`
- **Severity:** Medium
- **Description:** User email addresses are logged as structured fields. May violate GDPR/CCPA depending on jurisdiction.
- **Fix:** Hash or truncate emails in logs.

#### MEDIUM — No HTTPS Enforcement in Backend
- **Description:** No HTTPS redirect or HSTS configured beyond Helmet defaults. Depends on reverse proxy setup.
- **Fix:** Document required reverse proxy configuration. Add deployment checklist.

#### LOW — TypeScript: No `noUncheckedIndexedAccess`
- **File:** `repofy-backend/tsconfig.json`
- **Severity:** Low
- **Description:** Array/object index access returns `T` not `T | undefined`, masking potential runtime errors.
- **Fix:** Add `"noUncheckedIndexedAccess": true`.

---

### Data Flow & Business Logic

#### HIGH — Race Condition in Credit Deduction (In-Process Lock Only)
- **File:** `repofy-backend/src/controllers/advice.controller.ts:27`
- **Severity:** High
- **Description:** The in-flight request deduplication guard is per-process only. Multiple replicas would allow concurrent charges.
- **Fix:** Migrate to a distributed lock when deploying behind multiple replicas. The DB RPC is atomic so financial damage is bounded, but extra AI calls consume compute budget.

#### HIGH — `select("*")` Over-fetches in `resendOtp`
- **File:** `repofy-backend/src/services/auth.service.ts:161`
- **Severity:** High
- **Description:** Fetches all columns including hashed OTP when only `email`, `display_name`, and `attempts` are needed.
- **Fix:** Replace `select("*")` with `select("email, display_name, attempts")`.

#### MEDIUM — `NaN` Not Guarded in `limit`/`offset` Query Parameters
- **File:** `repofy-backend/src/controllers/crud.controller.ts:33-34`
- **Severity:** Medium
- **Description:** `parseInt` returns `NaN` for non-numeric input. `Math.max(1, NaN)` is `NaN`, causing unexpected database behavior.
- **Fix:** Add `isNaN` guards: `const limit = isNaN(parsed) ? DEFAULT_PAGE_LIMIT : parsed`.

#### MEDIUM — Credit Balance Pre-check is TOCTOU
- **File:** `repofy-backend/src/controllers/advice.controller.ts:64-68`
- **Severity:** Medium
- **Description:** Balance check is separate from deduction. The DB RPC is the true enforcement point.
- **Fix:** Add a comment clarifying this is a performance optimization only.

#### MEDIUM — `allowTaint: true` in PDF html2canvas
- **File:** `repofy-frontend/src/lib/export-pdf.ts:146`
- **Severity:** Medium
- **Description:** Allows cross-origin images to taint the canvas. Risk is low (only GitHub avatars) but broader than necessary.
- **Fix:** Set `allowTaint: false` and rely on `useCORS: true`, or proxy avatars through Next.js image optimization.

#### LOW — Admin Endpoint Uses Static API Key Only
- **File:** `repofy-backend/src/routes/admin.routes.ts:9`
- **Severity:** Low
- **Description:** Protected by timing-safe `X-Admin-Key` comparison without requiring a Supabase session. Acceptable for server-to-server access.
- **Recommendation:** Ensure `ADMIN_SECRET` is at minimum 32 bytes of random entropy and is rotated periodically.

#### LOW — Supabase Service Role Key Bypasses RLS
- **File:** `repofy-backend/src/config/supabase.ts:9`
- **Severity:** Low
- **Description:** Access control is enforced at the application layer. All current queries correctly filter by `user_id`.
- **Recommendation:** Consider adding RLS as defense-in-depth to catch future bugs.

---

## Positive Security Findings

1. **No IDOR vulnerabilities** — all DB queries filter by `user_id` from JWT
2. **No SSRF** — GitHub API base URL is hardcoded to `https://api.github.com`
3. **No prompt injection surface** — AI engine receives structured data, not user free-text
4. **Stripe payment flow is robust** — signature verification, amount/currency/product validation, idempotency key
5. **Auth callback prevents open redirect** — `next` param validated against `//` prefix
6. **OTP well-designed** — HMAC-SHA256, timing-safe comparison, `crypto.randomInt`, 5-attempt lockout, 10-min expiry
7. **No mass assignment** — all fields explicitly mapped
8. **CSP with per-request nonces** — strong script injection protection
9. **Comprehensive security headers** — HSTS, X-Frame-Options DENY, nosniff, strict referrer, permissions policy
10. **Zod schema validation** on API responses prevents prototype pollution
11. **Token refresh logic** proactively refreshes tokens expiring within 60 seconds
12. **No localStorage for auth tokens** — Supabase uses httpOnly cookies via `@supabase/ssr`
13. **Password strength enforcement** — min 8 chars, lowercase + uppercase + digit required
14. **100KB JSON body limit** — protects against large payload attacks
15. **Source maps disabled in production** — prevents source code leakage
