# Code Review Report — Repofy Monorepo

**Date:** 2026-03-08
**Scope:** Full-stack monorepo (`repofy-frontend` + `repofy-backend`)
**Branch:** `code-quality`
**Reviewers:** Architecture, Code Quality, Security, API Patterns (4-agent swarm)

---

## Executive Summary

The Repofy codebase is **well-engineered** with strong security practices, clean layering, and consistent patterns. No critical security vulnerabilities were found. The codebase demonstrates mature patterns including timing-safe comparisons, parameterized queries, prompt injection defenses, nonce-based CSP, and proper Stripe webhook signature verification.

The primary areas for improvement are:
1. **Type duplication across frontend/backend** — the single most impactful structural issue
2. **DRY violations** in UI components and backend utilities
3. **Inconsistent error propagation** in Express controllers
4. **Several code correctness issues** (null assertions, stale closures, input encoding)

**Totals: 1 Critical, 9 High, 18 Medium, 18 Low**

---

## Critical Issues (1)

### C1. Frontend/Backend Type Drift — No Shared Source of Truth
**Category:** Architecture / Code Quality
**Files:**
- `repofy-backend/src/types/index.ts` — canonical types (`CandidateLevel`, `Recommendation`, `RedFlagSeverity`, `AdviceV2`, etc.)
- `repofy-frontend/src/types/report.ts` — re-declares ~15 identical union types
- `repofy-frontend/src/types/advice.ts` — re-declares `GenerationWarning` as string union (backend uses `enum`), `AdviceData` loosens literal types vs backend's `AdviceV2`

**Impact:** A backend schema change (e.g., adding a `Recommendation` value) won't produce a compile error on the frontend. `AdviceData.trajectory.currentEstimate` uses `string` where backend uses `Level = "Junior" | "Mid-Level" | "Senior" | "Staff"`, losing autocomplete and exhaustive checks. `GenerationWarning` enum vs string union is a concrete contract divergence.

**Recommendation:** Extract shared types into a workspace package (`packages/shared`) or codegen TypeScript types from the backend.

---

## High Severity Issues (9)

### H1. Double Supabase API Call for Token Retrieval
**File:** `repofy-frontend/src/lib/api-client.ts:46-53`

Every authenticated API call makes TWO round trips: `getUser()` (server validation) then `getSession()` (get token). `getUser()` is unnecessary for attaching the auth header — the backend already re-validates the JWT via `supabase.auth.getUser(token)`.

**Fix:** Use only `getSession()` for the auth header. Reserve `getUser()` for identity validation at login/auth changes.

---

### H2. OTP Resend Resets Brute-Force Attempt Counter
**File:** `repofy-backend/src/services/auth.service.ts:168`

```typescript
.update({ otp_code: hashOtp(otp), otp_expires_at: expiresAt, attempts: 0 })
```

An attacker can call resend to reset `attempts` to 0 before hitting the max, enabling unlimited OTP guesses (rate-limited to 15/min, but never locked out).

**Fix:** Remove `attempts: 0` from the resend update. The attempt budget should be cumulative.

---

### H3. `data!.id` Non-Null Assertion After Supabase `.single()`
**Files:** `repofy-backend/src/services/advice-persistence.service.ts:40`, `reports.service.ts:28`

If Supabase returns `{ data: null, error: null }` (zero rows match), `data!.id` throws an unhandled `TypeError`.

**Fix:** Add explicit null check: `if (!data) throw new DatabaseError("No data returned", null);`

---

### H4. Unsafe Type Casts in credit.service.ts
**File:** `repofy-backend/src/services/credit.service.ts:38,55`

`return data as boolean;` — Supabase RPC returns `unknown`. A schema change would produce silent incorrect behavior.

**Fix:** Add runtime type validation before casting.

---

### H5. GitHub Repo Names Not URL-Encoded in API Paths
**File:** `repofy-backend/src/services/github.service.ts:168,698+`

Repo names (which can contain `.` and special chars) are interpolated directly into URL paths without `encodeURIComponent()`.

**Fix:** Apply `encodeURIComponent()` to `repo.name` in all URL constructions.

---

### H6. Duplicate OpenAI Client Singleton
**Files:** `repofy-backend/src/services/openai.service.ts:9-13`, `repofy-backend/src/services/advice.service.ts:15-19`

Both files contain identical `getClient()` singleton code. If client config changes (baseURL, timeout, org), it must be updated in two places.

**Fix:** Extract to `repofy-backend/src/lib/openai-client.ts`.

---

### H7. Rubric Version Hardcoded in Two Places
**Files:** `repofy-backend/src/controllers/analyze.controller.ts:19` (`"v1.1"`), `repofy-backend/src/services/scoring.service.ts:214` (`"v1.1"`)

**Fix:** Export `RUBRIC_VERSION` from `scoring.service.ts` and import in the controller.

---

### H8. Strengths/Weaknesses/RedFlags Item Layout Duplicated
**Files:**
- `repofy-frontend/src/components/report/sections/strengths.tsx:15-28`
- `repofy-frontend/src/components/report/sections/weaknesses.tsx:14-28`
- `repofy-frontend/src/components/compare/comparison-side-by-side.tsx:65-94`

Identical HTML structure copied across report and compare views.

**Fix:** Extract a shared `<FindingItem>` primitive or have compare components import the report components.

---

### H9. Empty State Pattern Repeated Across Advice Sections
**Files:** `repofy-frontend/src/components/advice/sections/repo-improvements.tsx:25-34`, `profile-optimizations.tsx:19-28`, `strengths-and-gaps.tsx:20-30`

Identical empty-state wrapper repeated 3+ times.

**Fix:** Create `<EmptySection title="..." message="..." delay={...} />`.

---

## Medium Severity Issues (18)

### Architecture

| # | Issue | File(s) |
|---|-------|---------|
| M1 | `advice.service.ts` is 790+ lines (god module) | `services/advice.service.ts` |
| M2 | `github.service.ts` is 975+ lines | `services/github.service.ts` |
| M3 | `(app)/layout.tsx` is `"use client"` — forces entire app subtree to client | `(app)/layout.tsx:1` |
| M4 | Missing `Suspense` boundary for `useSearchParams()` in detail pages | `report/[id]/page.tsx`, `advisor/[id]/page.tsx` |
| M5 | `AnalysisProvider` has disconnected mock setTimeout, mounted in root layout but unused by actual analysis flow | `analysis-provider.tsx:31-34` |

### Error Handling

| # | Issue | File(s) |
|---|-------|---------|
| M6 | analyze/advice/stripe controllers bypass global `errorHandler` via inline `sendError` — `DatabaseError` special-case is dead code for these paths | `analyze.controller.ts:104`, `advice.controller.ts:89`, `stripe.controller.ts:21` |
| M7 | `github.controller.ts` uses inline error handling instead of shared `handleControllerError` | `github.controller.ts:30-38` |
| M8 | `admin.controller.ts` has no try/catch — inconsistent with other controllers | `admin.controller.ts:5-43` |
| M9 | Stripe webhook returns 500 for invariant failures, causing Stripe retry loops | `stripe.controller.ts:73-99` |

### Security

| # | Issue | File(s) |
|---|-------|---------|
| M10 | `req.userId!` non-null assertions in controllers — crash if auth middleware removed | Multiple controllers |
| M11 | `style-src 'unsafe-inline'` weakens CSP (required by next-themes/framer-motion) | `middleware.ts:84` |
| M12 | In-memory concurrency guard (`activeAdviceRequests`) is process-scoped — fails with horizontal scaling | `advice.controller.ts:22-44` |

### Code Quality

| # | Issue | File(s) |
|---|-------|---------|
| M13 | `handleComplete` in generate pages uses weak `unknown` runtime type check instead of propagating generic | `generate/[username]/page.tsx:37-58` |
| M14 | Inline animation variants duplicated 4+ times (existing `animation-variants.ts` not used) | `advisor/page.tsx`, `dashboard/page.tsx` |
| M15 | Dead code: empty `if` block with comment body, no executable statements | `advice.service.ts:736-739` |
| M16 | GitHub API fetch helpers duplicate timeout/signal/catch boilerplate across 3 functions | `github.service.ts` (`ghFetch`, `ghFetchRaw`, `ghGraphQL`) |
| M17 | `verdictColor` logic duplicated as `verdictBadgeStyle` without importing original | `styles.ts:33`, `top-repos.tsx:137-146` |
| M18 | Missing `balanceAtCheckout` in useEffect dependency array — stale closure risk | `pricing/page.tsx:74-83` |

---

## Low Severity Issues (18)

| # | Issue | File(s) |
|---|-------|---------|
| L1 | `LANGUAGE_COLORS` imported across service layers (presentation data in wrong layer) | `advice-builder.service.ts:2` |
| L2 | Routes mounted without explicit sub-prefixes — must open each file to know paths | `routes/index.ts` |
| L3 | `cleanExpiredCache()` exists but is never called — no scheduled cleanup | `cache.service.ts:63` |
| L4 | Admin controller bypasses service layer (direct Supabase queries) | `admin.controller.ts` |
| L5 | Auth page check uses hardcoded strings instead of `PROTECTED_ROUTES` constant | `middleware.ts:54` |
| L6 | `DISABLED_ROUTES` hardcoded in middleware, not in constants file | `middleware.ts:72-77` |
| L7 | `AnalysisLoading` `fetchStarted` ref doesn't survive React Strict Mode remount | `analysis-loading.tsx:35` |
| L8 | `useAwaitCreditUpdate` polls indefinitely with no timeout/max attempts | `use-credits.ts:24-42` |
| L9 | `useCreditBalance` missing explicit staleTime — inherits global 60s default | `use-credits.ts:10-18` |
| L10 | 401 handling inconsistent across API-calling components | `api-client.ts:45-52` |
| L11 | Raw `err.message` piped to user-facing error display | `analysis-loading.tsx:80` |
| L12 | `any` usage in test files bypasses interface mismatch checks | Test setup + route tests |
| L13 | `relativeDate` / `timeAgo` implement overlapping date formatting logic | `format.ts` |
| L14 | In-memory rate limiting won't scale horizontally (documented with TODO) | `rateLimit.ts:8-11` |
| L15 | `TRUST_PROXY` must be set behind reverse proxy for IP rate limits to work | `app.ts:15`, `env.ts:29` |
| L16 | `auth.getSession()` on frontend instead of `auth.getUser()` (backend re-validates, so not exploitable) | `api-client.ts:48` |
| L17 | `<img>` tags instead of `next/image` for GitHub avatars | `dashboard/page.tsx:208`, `profile/page.tsx:132` |
| L18 | Phantom type fields in `supabase-queries.ts` config interface | `supabase-queries.ts:10-17` |

---

## DRY Violations Summary

| ID | Severity | Duplicated Code | Files | Fix |
|----|----------|----------------|-------|-----|
| D1 | High | Export bar components (~30 lines x 3) | `export-bar.tsx`, `advice-export-bar.tsx`, `comparison-export-bar.tsx` | Extract `<StickyBottomBar>` + `<ExportPdfButton>` |
| D2 | High | PDF layout utilities (~25 lines x 2-3) | `pdf-layout.tsx`, `advice-pdf-layout.tsx` | Extract to `pdf-primitives.tsx` |
| D3 | High | OpenAI client singleton (5 lines x 2) | `openai.service.ts`, `advice.service.ts` | Extract to `lib/openai-client.ts` |
| D4 | High | Strengths/Weaknesses item layout (14 lines x 4) | Report + compare components | Extract `<FindingItem>` |
| D5 | High | Empty state sections (10 lines x 3) | Advice section components | Extract `<EmptySection>` |
| D6 | Medium | GitHub fetch timeout/signal logic (10 lines x 3) | `github.service.ts` | Extract `buildSignals()` + `handleFetchError()` |
| D7 | Medium | Section card wrapper pattern (5 lines x 30+) | All section components | Create `<SectionCard>` |
| D8 | Medium | Controller error handling pattern (20 lines x 2) | `advice.controller.ts`, `analyze.controller.ts` | Extend `handleControllerError` |
| D9 | Medium | Type definitions between packages (~15 types) | `types/report.ts`, `types/index.ts` | Shared types package |

---

## Positive Findings

The codebase demonstrates strong engineering across many areas:

1. **Prompt injection defense** — `sanitizeForPrompt()` strips control chars, prefixes instruction keywords with `[user-data]`, `===BEGIN/END USER-PROVIDED DATA===` delimiters, size budgets
2. **Timing-safe comparisons** everywhere secrets are compared (OTP verification, admin key)
3. **Idempotent payment processing** — `stripePaymentIntentId` as idempotency key in `grant_growth_credits` RPC
4. **Comprehensive rate limiting** — per-user keying for auth routes, separate limits for AI (5/min), auth (10/min), OTP resend (3/min), admin, GitHub, Stripe
5. **Proper Stripe webhook handling** — `express.raw()` registered before `express.json()`, signature verification with raw body
6. **OTP security** — `crypto.randomInt()` generation, HMAC-SHA256 hashed storage, atomic attempt increment via RPC, timing-safe comparison
7. **Anti-enumeration** — consistent generic messages for signup/resend regardless of email existence
8. **CSP with per-request nonces** — `crypto.randomUUID()` nonce for script-src, `frame-ancestors 'none'` prevents clickjacking
9. **Zero XSS vectors** — no `dangerouslySetInnerHTML`, `eval()`, or `new Function()` anywhere in source
10. **Zero SQL injection risk** — all queries via Supabase SDK parameterized query builders
11. **Strict CORS** — exact-match origin allowlist, no wildcards
12. **App factory pattern** (`createApp()`) — easily testable backend
13. **`createSupabaseQueries` factory** — excellent DRY pattern for frontend CRUD hooks with optimistic updates + rollback
14. **`asyncHandler` wrapper** — all async routes catch unhandled rejections
15. **`AbortSignal.timeout()` propagation** — timeouts propagated through GitHub and OpenAI calls with 504 response
16. **Consistent response envelope** — `sendSuccess`/`sendError` enforce `{success, data}`/`{success, error}` shape
17. **Input validation at all boundaries** — username regex, email format, OTP format, body size limit (100kb), search query sanitization
18. **Error class hierarchy** — `GitHubError`, `DatabaseError`, `InsufficientCreditsError`, `AuthError` with meaningful status codes

---

## Architecture Assessment

**Rating: Strong**

- Clean monorepo with clear frontend/backend separation
- Backend: app factory → routes → middleware → controllers → services (proper layering)
- Frontend: Next.js App Router with `(app)` and `(auth)` route groups
- Provider hierarchy: Theme → Auth → Analysis → Query
- State management via React Query with proper cache configuration

**Key improvements:** Share types between packages; consider splitting god modules (`advice.service.ts`, `github.service.ts`).

---

## Security Posture

**Rating: Strong — No Critical Vulnerabilities**

- JWT validation server-side via `supabase.auth.getUser(token)` (not client decode)
- OTPs: crypto-secure generation, HMAC-hashed, timing-safe verification, atomic attempt limits
- Admin: timing-safe SHA-256 key comparison
- All DB access parameterized, zero raw SQL
- Zero XSS vectors, zero eval usage
- Stripe webhooks: raw body signature verification, idempotent processing
- CSP with nonces, clickjacking protection, strict CORS

**Key improvements:** Fix OTP attempt counter reset on resend; migrate CSP style-src from `unsafe-inline` when possible; plan Redis-backed rate limiting for horizontal scaling.

---

## API Patterns Assessment

**Rating: Good**

- Consistent `sendSuccess`/`sendError` envelope
- Typed API client with optional Zod validation
- `asyncHandler` covers unhandled rejections
- `AbortSignal.timeout()` propagation with 504
- Optimistic updates with rollback in `supabase-queries.ts`
- Comprehensive, granular rate limiting

**Key improvements:** Unify error propagation through Express error pipeline; fix webhook 500→200 for invariant failures; add poll timeout to `useAwaitCreditUpdate`.

---

## Prioritized Recommendations

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Fix OTP attempt counter reset on resend | 5 min | High — auth bypass fix |
| 2 | Use only `getSession()` for auth header (drop redundant `getUser()`) | 10 min | High — 2x fewer API calls |
| 3 | Add null checks after `.single()` calls | 10 min | High — prevents runtime crashes |
| 4 | Share types between frontend/backend | 1-2 hours | High — eliminates type drift |
| 5 | Extract shared OpenAI client singleton | 15 min | Medium — single config point |
| 6 | Unify controller error handling pattern | 30 min | Medium — consistent pipeline |
| 7 | Extract shared UI components (FindingItem, EmptySection, StickyBottomBar) | 30 min | Medium — reduces duplication |
| 8 | URL-encode repo names in GitHub API paths | 15 min | Medium — defense-in-depth |
| 9 | Export `RUBRIC_VERSION` from single location | 5 min | Low — prevents mismatch |
| 10 | Move animation variants to `animation-variants.ts` | 5 min | Low — cleaner code |
| 11 | Remove dead code (empty if block, vestigial AnalysisProvider) | 5 min | Low — reduces confusion |
| 12 | Add cache cleanup job (pg_cron or startup task) | 30 min | Low — prevents stale accumulation |
| 13 | Add poll timeout to `useAwaitCreditUpdate` | 5 min | Low — prevents infinite polling |
| 14 | Return 200 for Stripe webhook invariant failures | 5 min | Low — prevents retry storms |
| 15 | Plan Redis-backed rate limiting for horizontal scaling | 2-4 hours | Low (only if scaling) |
