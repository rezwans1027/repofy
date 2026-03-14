# Repofy — Consolidated Audit Report

46 unique issues identified across security, code quality, performance, and architecture.
Consolidated from 4 separate reviews with duplicates merged.

---

## CRITICAL (2)

### 1. Missing credit check on /analyze endpoint
- **Category:** Security
- **Location:** `repofy-backend/src/controllers/analyze.controller.ts:27-94`
- **Issue:** AI analysis runs without checking or deducting credits. The `/advice` endpoint properly calls `getCreditBalance()` and `deductAndPersist()`, but `/analyze` has neither — allowing unlimited free usage.

### 2. Shared types have drifted — three disconnected copies
- **Category:** Architecture
- **Files:** `shared/types/report.ts` vs `repofy-frontend/src/shared/types/report.ts` vs `repofy-backend/src/types/shared/report.ts`
- **Issue:** The root `shared/` says `TopRepo.description: string` and `TopRepo.language: string`, but both frontend and backend copies say `string | null`. The root `shared/` directory (with its own `tsconfig.json` and compiled `dist/`) is completely orphaned — neither project imports from it.
- **Fix:** Pick one canonical location (root `shared/`), wire both projects to import from it via path aliases or npm workspaces, and delete the duplicate copies.

---

## HIGH (11)

### 3. Race condition in concurrent advice requests
- **Category:** Security
- **Location:** `repofy-backend/src/controllers/advice.controller.ts:32-42`
- **Issue:** In-flight tracking (`activeAdviceRequests` Map) is per-process only. In horizontally-scaled deployments, each replica tracks state independently, allowing double-spending of credits via concurrent requests to different instances. The Map also has no max size cap — no hard ceiling for traffic spikes.
- **Fix:** Migrate to a shared store (e.g. Redis SETNX with TTL) when scaling beyond a single process.

### 4. SSRF DNS rebinding unprotected in dev
- **Category:** Security
- **Location:** `repofy-backend/src/services/engine.service.ts:24-25`
- **Issue:** `assertHostNotPrivate()` is gated behind `env.isProduction`. In development, DNS rebinding attacks can resolve public hostnames to private IPs (e.g., 127.0.0.1) without detection.

### 5. NaN propagation in admin query params
- **Category:** Security
- **Location:** `repofy-backend/src/controllers/admin.controller.ts:6-7`
- **Issue:** `Math.max(1, parseInt(req.query.page as string))` returns NaN when `page` is non-numeric, since `Math.max(1, NaN)` evaluates to NaN. This propagates into database queries, potentially corrupting pagination.

### 6. Insufficient query parameter type validation in GitHub search
- **Category:** Security
- **Location:** `repofy-backend/src/controllers/github.controller.ts:69`
- **Issue:** The `q` parameter is coerced via `.toString()` without explicit type validation. Relies on downstream services to handle unexpected input rather than validating at the API boundary.

### 7. No CI/CD pipeline
- **Category:** Architecture
- **Issue:** No `.github/workflows/` directory exists. Tests, type checking, and linting don't run on PRs — broken code can be merged undetected.

### 8. Root `shared/` directory is dead code
- **Category:** Architecture
- **Issue:** The composite TypeScript project, compiled `dist/`, and type exports in the root `shared/` are unused by either project. Both frontend and backend maintain their own local copies.

### 9. Module-level Supabase singleton in AuthProvider
- **Category:** Code Quality
- **Location:** `repofy-frontend/src/components/providers/auth-provider.tsx:14`
- **Issue:** `const supabase = createClient()` executes at import time. If ever imported during SSR, it crashes. The `api-client.ts` already uses a lazy singleton pattern — AuthProvider should match.

### 10. `serverFetch` swallows JSON parse errors
- **Category:** Code Quality
- **Location:** `repofy-frontend/src/lib/server-api.ts:62`
- **Issue:** If the backend returns HTML instead of JSON, `res.json()` throws an unhandled rejection. The client-side `api-client.ts` wraps this in try/catch but `serverFetch` does not.

### 11. Global rate limit too restrictive
- **Category:** Security
- **Location:** `repofy-backend/src/middleware/rateLimit.ts:101-105`
- **Issue:** 100 requests/15 min per IP. A normal session makes 3-5 API calls per page load. Behind corporate NAT, multiple users share the budget. Per-route limits already provide granular protection — raise the global to 300-500.

### 12. HeatmapGrid renders ~364 individually animated divs
- **Category:** Performance
- **Location:** `repofy-frontend/src/components/ui/heatmap-grid.tsx:44-57`
- **Issue:** Each cell is a plain `<div>` with a unique CSS `animationDelay`, creating ~364 staggered animations. Can cause jank on slower devices.
- **Fix:** Use CSS Grid animation or reduce to row-level animation.

### 13. PDF layout components imported eagerly
- **Category:** Performance
- **Files:** `repofy-frontend/src/components/report/analysis-report.tsx:10`, `repofy-frontend/src/components/advice/advice-report.tsx:20`
- **Issue:** `AnalysisReportPdfLayout` and `AdviceReportPdfLayout` are statically imported but only rendered when `exporting === true`.
- **Fix:** Use `dynamic(() => import(...), { ssr: false })`.

---

## MEDIUM (24)

### Security

#### 14. Rate limiting is per-process only
- **Location:** `repofy-backend/src/middleware/rateLimit.ts`
- **Issue:** All rate limiters use express-rate-limit's default MemoryStore. In horizontally-scaled deployments, each replica tracks limits independently, effectively multiplying allowed requests by the number of instances. A TODO comment acknowledges the need for Redis.

#### 15. CSP unsafe-inline for styles
- **Location:** `repofy-frontend/src/middleware.ts:105`
- **Issue:** `style-src 'self' 'unsafe-inline'` weakens XSS protection. Required by framer-motion and html2canvas-pro. Documented as an accepted risk with mitigations (nonce-locked script-src, restrictive connect-src).

#### 16. Error messages expose API internals
- **Location:** `repofy-backend/src/middleware/errorHandler.ts:20-21`
- **Issue:** For non-500 errors, raw `err.message` is sent to the client. This can leak implementation details, database error messages, or internal paths. Raw engine response body is also interpolated into thrown Error messages (`engine.service.ts:42-45`).
- **Fix:** Audit all non-500 error paths or sanitize all error messages regardless of status code.

#### 17. No UUID format validation on batch delete IDs
- **Location:** `repofy-backend/src/controllers/crud.controller.ts:66-76`
- **Issue:** Batch delete only validates `typeof "string"`. No UUID format regex or `validate()` check, allowing arbitrary strings to reach the database layer.

#### 18. Session storage used for credit balance
- **Location:** `repofy-frontend/src/app/(app)/pricing/page.tsx:59-65`
- **Issue:** Pre-checkout credit balance is stored in `sessionStorage`, accessible to XSS. Impact is low since value is for UI display comparison only, not authorization.

#### 19. Token cache uses FIFO not LRU, no invalidation on logout
- **Location:** `repofy-backend/src/middleware/auth.ts:25-35, 56-62`
- **Issue:** The 256-entry token cache evicts via `Map.keys().next().value` (first inserted), not least recently used. An attacker can pollute the cache to evict frequently-used tokens. Additionally, the 60-second TTL has no event-based invalidation — between logout and cache expiry, a stolen token remains valid.

#### 20. OTP email sent fire-and-forget
- **Location:** `repofy-backend/src/services/auth.service.ts:92-94`
- **Issue:** `.catch()` logs the error but the user is told "code sent" regardless of delivery status.

#### 21. Resend OTP resets attempt counter — weakens brute-force protection
- **Location:** `repofy-backend/src/services/auth.service.ts:181`
- **Issue:** `attempts: 0` on resend gives 5 fresh attempts each time, creating a rate-limit bypass if resend itself isn't separately limited.

### Code Quality

#### 22. ProfileSections is a 418-line god component
- **Location:** `repofy-frontend/src/components/profile/profile-sections.tsx`
- **Issue:** All 7 sections (stats, languages, repos, activity, PRs, collaborators, heatmap) are inline JSX in a single component. Any prop change re-renders everything.
- **Fix:** Split into separate `React.memo` wrapped sub-components.

#### 23. Signup page: 599 lines, 13 useState calls, 3 phases in one component
- **Location:** `repofy-frontend/src/app/(auth)/signup/page.tsx`

#### 24. useTypewriter creates timeout chains causing multiple re-renders per character
- **Location:** `repofy-frontend/src/hooks/use-typewriter.ts`
- **Issue:** Nested `setTimeout` chains (50ms/120ms per character) trigger multiple state updates per character cycle.

#### 25. Loose `Record<string, string>` types instead of union types in style utils
- **Location:** `repofy-frontend/src/lib/styles.ts`
- **Issue:** 5 instances use `Record<string, string>` instead of typed union keys.

#### 26. handleComplete accepts `unknown` then casts — bypasses type safety
- **Location:** `repofy-frontend/src/app/(app)/generate/[username]/page.tsx:37-47`

#### 27. AdviceRow.advice_data: Zod and TypeScript disagree
- **Location:** `repofy-frontend/src/hooks/use-advice.ts:16-21`
- **Issue:** Schema validates as `Record<string, unknown>` but type is overridden with `AdviceData` intersection, bypassing Zod's guarantee.

#### 28. Duplicated credit confirmation dialog across 2 components
- **Files:** `repofy-frontend/src/components/profile/sticky-cta-bar.tsx`, `repofy-frontend/src/components/advice/sections/advice-export-bar.tsx`

#### 29. `<img>` tags in banners instead of `next/image`
- **Files:** `repofy-frontend/src/components/report/sections/top-banner.tsx:33`, `repofy-frontend/src/components/advice/sections/advice-top-banner.tsx:35`

#### 30. serverFetch has no timeout — SSR hangs if backend is slow
- **Location:** `repofy-frontend/src/lib/server-api.ts`
- **Issue:** No `AbortSignal.timeout()` or timeout mechanism on the fetch call.

#### 31. PDF export errors silently swallowed
- **Location:** `repofy-frontend/src/hooks/use-export-pdf.ts:34-35`
- **Issue:** Catch block only logs to console; no error state or user notification.

#### 32. Middleware disables routes but components still exist
- **Location:** `repofy-frontend/src/middleware.ts:72-77`
- **Issue:** `/report/` and `/generate/` routes blocked at middleware level while fully functional page components remain in the codebase.

#### 33. GitHub data fetched twice — no shared service-level cache
- **Files:** `repofy-backend/src/controllers/analyze.controller.ts:48`, `repofy-backend/src/controllers/advice.controller.ts:86`
- **Issue:** Both controllers independently call `fetchGitHubUserData(username, req.signal)` with no shared cache.

#### 34. AdviceV2 vs AdviceData structural divergence
- **Files:** `repofy-backend/src/types/index.ts` vs `shared/types/advice.ts`
- **Issue:** AdviceData has enriched fields (`repoUrl`, `language`, `languageColor`, `stars`) that AdviceV2 lacks. Type definitions diverge without documentation of the enrichment step.

#### 35. serverFetch has no Zod runtime validation (client-side api does)
- **Location:** `repofy-frontend/src/lib/server-api.ts`
- **Issue:** Client-side `api-client.ts` accepts optional `schema?: z.ZodType` for runtime validation; `serverFetch` does not.

### Performance

#### 36. Missing HTTP Cache-Control headers
- **Location:** `repofy-backend/src/lib/response.ts`
- **Issue:** No `Cache-Control` headers on any response. Browser re-fetches identical data on every load despite 5-min in-memory cache.
- **Fix:** Add `Cache-Control: public, max-age=300` on GET endpoints for GitHub user data.

#### 37. AnalysisLoading has ~13 simultaneous active timers
- **Location:** `repofy-frontend/src/components/report/analysis-loading.tsx:109-147`
- **Issue:** Creates 1 `setInterval(100ms)` + 8 phase `setTimeout`s + 4 log `setTimeout`s per phase simultaneously. The 100ms interval alone is 10 state updates/sec.
- **Fix:** Consolidate into a single timer-based state machine.

---

## LOW (9)

| # | Issue | Location |
|---|-------|----------|
| 38 | `.next/` directory exists in backend project | `repofy-backend/.next/` |
| 39 | `OPENAI_API_KEY` in `.env.example` but unused in codebase | `repofy-backend/.env.example` |
| 40 | `ENGINE_URL` and `ENGINE_INTERNAL_KEY` missing from `.env.example` | `repofy-backend/.env.example` |
| 41 | `@types/node` version mismatch (`^20` frontend vs `^22` backend) | Both `package.json` files |
| 42 | No backend ESLint config | `repofy-backend/` |
| 43 | Frontend test coverage thresholds low (60/55/50/60 vs backend 80/80/75/80) | `vitest.config.ts` |
| 44 | No tests for reports/admin controllers and services | `repofy-backend/tests/` |
| 45 | Weak request ID format validation (accepts any 1-128 char alphanumeric string) | `repofy-backend/src/middleware/requestId.ts` |
| 46 | Health endpoint has no rate limiter | `repofy-backend/src/routes/health.routes.ts` |

---

## NICE-TO-HAVE (10)

| # | Issue | Location |
|---|-------|----------|
| 47 | `react-type-animation` installed but unused (only in test mock) | Frontend `package.json` |
| 48 | 3 separate in-memory cache implementations (identical pattern) | `auth.ts`, `cache.service.ts`, `github.controller.ts` |
| 49 | Missing `loading.tsx` for settings route | `repofy-frontend/src/app/(app)/settings/` |
| 50 | No page-specific metadata / missing SEO (no robots.ts, sitemap.ts, OG tags, JSON-LD) | All sub-pages |
| 51 | `process.uptime()` exposed in unauthenticated health endpoint | `health.controller.ts:16` |
| 52 | Stripe checkout URL validation uses `startsWith` instead of hostname check | `pricing/page.tsx:101` |
| 53 | No root `package.json` — no monorepo orchestration | Project root |
| 54 | No Suspense boundaries on home page (6 dynamic imports) | `repofy-frontend/src/app/page.tsx` |
| 55 | Missing `output: "standalone"` in next.config.ts | `repofy-frontend/next.config.ts` |
| 56 | Missing `optimizePackageImports` for radix-ui and lucide-react | `repofy-frontend/next.config.ts` |
