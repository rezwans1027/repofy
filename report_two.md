# Repofy Code Review — Verified Issues

## CRITICAL (1)

### 1. Shared types have drifted — three disconnected copies

**Files:** `shared/types/report.ts` vs `repofy-frontend/src/shared/types/report.ts` vs `repofy-backend/src/types/shared/report.ts`

The root `shared/` says `TopRepo.description: string` and `TopRepo.language: string`, but both frontend and backend copies say `string | null`. The root `shared/` directory (with its own `tsconfig.json` and compiled `dist/`) is completely orphaned — neither project imports from it.

**Fix:** Pick one canonical location (root `shared/`), wire both projects to import from it via path aliases or npm workspaces, and delete the duplicate copies.

---

## HIGH (5)

### 2. No CI/CD pipeline

No `.github/workflows/` directory exists. Tests, type checking, and linting don't run on PRs — broken code can be merged undetected.

### 3. Root `shared/` directory is dead code

The composite TypeScript project, compiled `dist/`, and type exports in the root `shared/` are unused by either project. Both frontend and backend maintain their own local copies.

### 5. Module-level Supabase singleton in AuthProvider (Frontend)

**File:** `repofy-frontend/src/components/providers/auth-provider.tsx:14`

`const supabase = createClient()` executes at import time. If ever imported during SSR, it crashes. The `api-client.ts` already uses a lazy singleton pattern — AuthProvider should match.

### 6. `serverFetch` swallows JSON parse errors (Frontend)

**File:** `repofy-frontend/src/lib/server-api.ts:62`

If the backend returns HTML instead of JSON, `res.json()` throws an unhandled rejection. The client-side `api-client.ts` wraps this in try/catch but `serverFetch` does not.

### 7. Global rate limit too restrictive

**File:** `repofy-backend/src/middleware/rateLimit.ts:101-105`

100 requests/15 min per IP. A normal session can make 3-5 API calls per page load. Behind corporate NAT, multiple users share the budget. Per-route limits already provide granular protection — raise the global to 300-500.

---

## MEDIUM (21)

### Frontend

#### 8. ProfileSections is a 418-line god component (8 sections inline)

**File:** `repofy-frontend/src/components/profile/profile-sections.tsx`

#### 9. Signup page: 599 lines, 13 useState calls, 3 phases in one component

**File:** `repofy-frontend/src/app/(auth)/signup/page.tsx`

#### 10. useTypewriter creates timeout chains causing multiple re-renders per character

**File:** `repofy-frontend/src/hooks/use-typewriter.ts`

Nested `setTimeout` chains (50ms/120ms per character) trigger multiple state updates per character cycle.

#### 11. Loose `Record<string, string>` types instead of union types in style utils

**File:** `repofy-frontend/src/lib/styles.ts`

5 instances (`RECOMMENDATION_STYLES`, `SEVERITY_STYLES`, `DIFFICULTY_STYLES`, `PRIORITY_STYLES`, `DEMAND_STYLES`) use `Record<string, string>` instead of typed union keys.

#### 12. handleComplete accepts `unknown` then casts — bypasses type safety

**File:** `repofy-frontend/src/app/(app)/generate/[username]/page.tsx:37-47`

Accepts `unknown`, then uses `data as { reportId: string }` without full validation.

#### 13. AdviceRow.advice_data validated as `z.record(z.unknown())` but typed as `AdviceData` — Zod and TS disagree

**File:** `repofy-frontend/src/hooks/use-advice.ts:16-21`

Schema validates as `Record<string, unknown>` but type is overridden with `AdviceData` intersection, bypassing Zod's guarantee.

#### 14. Duplicated credit confirmation dialog markup across 2 components

**Files:** `repofy-frontend/src/components/profile/sticky-cta-bar.tsx` + `repofy-frontend/src/components/advice/sections/advice-export-bar.tsx`

Nearly identical AlertDialog structure, labels, buttons, and logic duplicated.

#### 15. `<img>` tags in banners instead of `next/image` — no optimization

**Files:** `repofy-frontend/src/components/report/sections/top-banner.tsx:33` + `repofy-frontend/src/components/advice/sections/advice-top-banner.tsx:35`

#### 16. serverFetch has no timeout — SSR hangs if backend is slow

**File:** `repofy-frontend/src/lib/server-api.ts`

No `AbortSignal.timeout()` or timeout mechanism on the fetch call.

#### 17. PDF export errors silently swallowed — user gets no feedback

**File:** `repofy-frontend/src/hooks/use-export-pdf.ts:34-35`

Catch block only logs to console; no error state or user notification.

#### 18. Middleware disables `/report/` and `/generate/` routes but components still exist — intent unclear

**File:** `repofy-frontend/src/middleware.ts:72-77`

Routes are blocked at middleware level while fully functional page components remain in the codebase.

### Backend

#### 19. OTP email sent fire-and-forget — user told "code sent" even if email fails

**File:** `repofy-backend/src/services/auth.service.ts:92-94`

`.catch()` logs the error but the user is told the code was sent regardless of delivery status.

#### 20. Resend OTP resets attempt counter to 0 — weakens brute-force protection

**File:** `repofy-backend/src/services/auth.service.ts:181`

`attempts: 0` on resend gives 5 fresh attempts each time, creating a rate-limit bypass if resend itself isn't separately limited.

#### 21. Engine error response text leaks to client via hasStatus path

**File:** `repofy-backend/src/services/engine.service.ts:42-45`

Raw engine response body is interpolated into the thrown Error message. If this bubbles to the client, internal details leak.

#### 22. GitHub data fetched twice (analyze + advice) — service-level cache not shared

**Files:** `repofy-backend/src/controllers/analyze.controller.ts:48` + `repofy-backend/src/controllers/advice.controller.ts:86`

Both controllers independently call `fetchGitHubUserData(username, req.signal)` with no shared cache.

### Architecture

#### 23. No root `package.json` — no monorepo orchestration, no single `npm install`

No workspace configuration, no shared dependency management, no root-level scripts.

#### 24. `ENGINE_URL` and `ENGINE_INTERNAL_KEY` missing from `.env.example`

**File:** `repofy-backend/.env.example`

Both are required by `engine.service.ts` but not documented in the example.

#### 25. Frontend test coverage thresholds are low (60/55/50/60 vs backend's 80/80/75/80)

**File:** `repofy-frontend/vitest.config.ts` vs `repofy-backend/vitest.config.ts`

#### 26. No tests for reports/admin controllers and services

**File:** `repofy-backend/tests/`

No test files exist for `reports.controller.ts`, `admin.controller.ts`, `reports.service.ts`, or `admin.service.ts`.

#### 27. AdviceV2 vs AdviceData structural divergence — pre/post enrichment types

**Files:** `repofy-backend/src/types/index.ts` vs `shared/types/advice.ts`

AdviceData has enriched fields (`repoUrl`, `language`, `languageColor`, `stars`) that AdviceV2 lacks. The type definitions diverge without clear documentation of the enrichment step.

#### 28. serverFetch has no Zod runtime validation (client-side api does)

**File:** `repofy-frontend/src/lib/server-api.ts`

Client-side `api-client.ts` accepts an optional `schema?: z.ZodType` parameter for runtime validation; `serverFetch` does not.

---

## Security (1)

### 29. Token cache doesn't invalidate on logout/password change — 60s window

**File:** `repofy-backend/src/middleware/auth.ts:56-62`

The token cache uses a fixed 60-second TTL with no event-based invalidation. Between logout and cache expiry, a stolen token remains valid.

---

## LOW (15)

| # | Issue | File |
|---|-------|------|
| 1 | `.next/` directory exists in backend project | `repofy-backend/.next/` |
| 2 | `OPENAI_API_KEY` in `.env.example` but zero references in src/ | `repofy-backend/.env.example` |
| 3 | `react-type-animation` installed but only referenced in test setup mock | Frontend `package.json` |
| 4 | 3 separate in-memory cache implementations (identical pattern) | `auth.ts`, `cache.service.ts`, `github.controller.ts` |
| 5 | `@types/node` version mismatch (`^20` frontend vs `^22` backend) | Both `package.json` files |
| 6 | No backend ESLint config | `repofy-backend/` |
| 7 | Missing `loading.tsx` for settings route | `repofy-frontend/src/app/(app)/settings/` |
| 8 | No page-specific metadata exports — every tab says "Repofy" | All sub-pages |
| 9 | `process.uptime()` exposed in unauthenticated health endpoint | `health.controller.ts:16` |
| 10 | Stripe checkout URL validation uses `startsWith` instead of hostname check (vulnerable to `checkout.stripe.com.attacker.com`) | `pricing/page.tsx:101` |
| 11 | DELETE endpoints use request body (non-standard REST) | `crud.controller.ts:66-83` |
| 12 | Negative offset not clamped in CRUD pagination | `crud.service.ts` |
| 13 | QueryProvider loaded on landing page but unused | `page.tsx` |
| 14 | No `aria-label` on SectionNav `<nav>` elements | `section-nav.tsx` |
| 15 | AnalysisLoading runs 100ms interval (10 state updates/sec) for elapsed timer | `analysis-loading.tsx:109-113` |
