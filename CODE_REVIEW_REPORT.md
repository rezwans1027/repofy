# Code Review Report — Repofy Monorepo

**Date:** 2026-03-11
**Reviewed by:** 4-agent swarm (architecture, quality, security, API patterns)
**Scope:** Full codebase — `repofy-frontend/`, `repofy-backend/`, `shared/`

---

## Executive Summary

The Repofy codebase demonstrates **strong engineering fundamentals** with clean architecture, proper security implementation, and consistent patterns. The monorepo is well-organized with clear separation of concerns in both frontend (Next.js 16) and backend (Express 4).

**0 critical issues** were found. The main areas for improvement are: eliminating structural duplication between the reports and advice CRUD layers (~300 lines), consolidating type definitions between `shared/` and backend, and adding pagination to list endpoints. Security posture is strong with proper auth, input validation, CSP, and prompt injection defenses.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 5 |
| Medium | 11 |
| Low | 15 |

---

## Critical Issues

None found.

---

## High Priority Issues

### H1. Reports/Advice CRUD Triplication (DRY)
**Category:** Code Quality
**Files:**
- `repofy-backend/src/controllers/reports.controller.ts` vs `advice-read.controller.ts`
- `repofy-backend/src/services/reports.service.ts` vs `advice-persistence.service.ts`
- `repofy-frontend/src/hooks/use-reports.ts` vs `use-advice.ts`

The reports and advice entities share nearly identical CRUD code across 3 layers (controller, service, hook). Each pair has the same auth checks, validation, error handling, query patterns, and optimistic delete logic. Only entity names, table names, and query keys differ. This represents ~300 lines of duplication.

**Recommendation:** Create generic factories:
- Backend: `createCrudController(service, entityName)` and `createEntityService(tableName)`
- Frontend: `useEntityCrud(entityKey, apiPath, listSchema, detailSchema)`

### H2. No Pagination on List Endpoints
**Category:** Performance
**Files:**
- `repofy-backend/src/services/reports.service.ts:32-41`
- `repofy-backend/src/services/advice-persistence.service.ts` (equivalent)

List endpoints return ALL reports/advice for a user with no pagination. Frontend hooks fetch the full list on every load. This will degrade as users accumulate data.

**Recommendation:** Add cursor-based or offset pagination with a default page size (e.g., 20). Update frontend hooks to support pagination.

### H3. Type Definitions in 3 Places (Single Source of Truth)
**Category:** Code Quality
**Files:**
- `shared/types/advice.ts` — `AdviceData` interface
- `repofy-backend/src/types/index.ts` — `AdviceV2` interface (near-identical)
- `repofy-backend/src/services/advice.service.ts` — JSON schemas mirroring the same structure

The same types are maintained in 3 places with subtle drift (e.g., `AdviceData.repoImprovements` has optional fields the backend lacks; `GenerationWarning` is a union type in shared but an enum in backend). Changes require updates in multiple files.

**Recommendation:** Backend should import from `shared/types/` via path alias. Consider generating JSON schemas from Zod schemas defined alongside the shared types.

### H4. Redundant Auth/Error Guards in CRUD Controllers
**Category:** API Patterns
**Files:**
- `repofy-backend/src/controllers/reports.controller.ts`
- `repofy-backend/src/controllers/advice-read.controller.ts`

Every handler duplicates `if (!req.userId)` checks and manual try/catch blocks, even though `requireAuth` middleware already validates auth and `asyncHandler` + `errorHandler` handle errors. The controllers don't trust the middleware chain.

**Recommendation:** Remove redundant `userId` checks (middleware guarantees it). Let `asyncHandler`/`errorHandler` catch errors instead of per-handler try/catch.

### H5. Dependency Vulnerabilities
**Category:** Security
**Files:** `package-lock.json` in both packages

- `rollup` 4.0.0-4.58.0 — arbitrary file write via path traversal (dev-only)
- `@hono/node-server` — authorization bypass for static paths (transitive)
- `dompurify` — XSS vulnerability (used by `html2canvas-pro` for PDF export)

**Recommendation:** Run `npm audit fix` in both packages. Evaluate `html2canvas-pro` dependency for `dompurify` update.

---

## Medium Priority Issues

### M1. Duplicate Supabase Migration Directories
**Category:** Architecture
**Files:** `supabase/migrations/` (root, 15 files) vs `repofy-backend/supabase/migrations/` (2 files)

Two migration directories with different file counts. Unclear which is the source of truth.

**Recommendation:** Consolidate to a single migration directory and document the convention.

### M2. Duplicated Enum/Union Types Between Shared and Backend
**Category:** Code Quality
**Files:** `shared/types/report.ts` vs `repofy-backend/src/types/index.ts`

`CandidateLevel`, `Recommendation`, `RedFlagSeverity`, `CodeQuality`, `TestingLevel`, `CiCdStatus`, `RepoVerdict` are defined identically in both locations.

**Recommendation:** Backend should import these from `@shared/types`.

### M3. Email Validation Repeated 3x in Auth Controller
**Category:** Code Quality
**File:** `repofy-backend/src/controllers/auth.controller.ts` (lines 13, 37, 69)

The email validation pattern and `AuthError` handling block are copy-pasted across `handleInitiateSignup`, `handleVerifySignup`, and `handleResendOtp`.

**Recommendation:** Extract `validateEmail(email)` and `handleAuthError(err, res)` helpers.

### M4. Duplicated BASE_URL Logic
**Category:** Code Quality
**Files:** `repofy-frontend/src/lib/api-client.ts:4-11` vs `server-api.ts:3-10`

Identical `BASE_URL` IIFE with env var resolution copy-pasted between client and server API modules.

**Recommendation:** Extract to a shared `getApiBaseUrl()` utility.

### M5. Server-Side Fetch Cache Disabled
**Category:** Performance
**File:** `repofy-frontend/src/lib/server-api.ts:18-19`

`cache: "no-store"` on every server fetch disables Next.js's server-side cache entirely. Every page navigation re-fetches from the backend.

**Recommendation:** Use `next: { revalidate: 60 }` for stable data like report/advice details.

### M6. Session Overhead on Every API Call
**Category:** Performance
**File:** `repofy-frontend/src/lib/api-client.ts:47-53`

Every authenticated request calls `supabase.auth.getSession()` and potentially `refreshSession()`, adding latency.

**Recommendation:** Cache the session token client-side with a short TTL (e.g., 30s).

### M7. OTP Attempts Not Reset on Resend
**Category:** Security (UX)
**File:** `repofy-backend/src/services/auth.service.ts:168-170`

When a new OTP is generated via resend, the attempt counter isn't reset. Users can be locked out of a fresh code due to prior attempts.

**Recommendation:** Reset attempts to 0 when generating a new OTP.

### M8. Delete Endpoint IDs Not Validated as UUIDs
**Category:** Security
**Files:** `repofy-backend/src/controllers/reports.controller.ts:44`, `advice-read.controller.ts:44`

IDs are validated as strings but not checked for UUID format. Non-UUID values reach the DB and return 500 instead of 400.

**Recommendation:** Add UUID regex validation to return a proper 400 response.

### M9. CSP style-src Uses 'unsafe-inline'
**Category:** Security
**File:** `repofy-frontend/src/middleware.ts:89`

Required by framer-motion's inline styles. Documented in comments. Lower risk than inline scripts (which are nonce-based).

### M10. Rate Limiter Uses In-Memory Store
**Category:** Architecture
**File:** `repofy-backend/src/middleware/rateLimit.ts:1-11`

Per-process MemoryStore won't work across multiple instances. TODO comment already present.

**Recommendation:** Switch to `rate-limit-redis` before horizontal scaling.

### M11. Large Service Files
**Category:** Code Quality
**Files:**
- `repofy-backend/src/services/github.service.ts` — 987 lines
- `repofy-backend/src/services/advice.service.ts` — 803 lines

Both files have self-documenting comments identifying natural split points, which mitigates the concern. `normalizeAdvice` is ~210 lines.

**Recommendation:** Follow the commented split plans when next modifying these files.

---

## Low Priority Issues

| # | Category | Finding | File |
|---|----------|---------|------|
| L1 | Quality | Inconsistent error handling patterns (handleControllerError vs manual sendError) | Various controllers |
| L2 | Quality | `any` usage in test files (~30 instances) | Frontend test files |
| L3 | Quality | Type assertions in advice.service.ts merge logic (9 `as` casts) | advice.service.ts |
| L4 | Quality | Deprecated `AIAnalysisResponse` type still present | backend/src/types/index.ts:239 |
| L5 | Quality | Deprecated test fixture | backend/tests/fixtures/ai.ts:79 |
| L6 | Quality | Empty conditional block with only comments | advice.service.ts:744-747 |
| L7 | Architecture | No ESLint config in backend (frontend has one) | repofy-backend/ |
| L8 | Architecture | `reactStrictMode: false` undocumented | next.config.ts |
| L9 | Architecture | `components/sections/` naming ambiguous (landing vs report sections) | repofy-frontend/src/components/ |
| L10 | API | Missing `signal` in `useReport`/`useAdvice` query functions | use-reports.ts, use-advice.ts |
| L11 | API | Missing explicit `staleTime` on detail queries | use-reports.ts, use-advice.ts |
| L12 | API | No response compression middleware | repofy-backend |
| L13 | API | No HTTP caching headers (Cache-Control, ETag) | repofy-backend |
| L14 | API | No API versioning or OpenAPI documentation | repofy-backend |
| L15 | API | Misleading `recentCost`/`recentTokens` in admin endpoint (page-scoped) | admin.controller.ts:28-36 |

---

## Architecture Assessment

**Rating: STRONG**

- Clean hybrid organization: type-based at top level, feature-based nesting in components
- Proper layering: routes -> controllers -> services -> lib (backend), pages -> components -> hooks -> lib (frontend)
- No circular dependencies detected
- Good use of Next.js App Router patterns (route groups, server components, loading.tsx, middleware CSP)
- Excellent Express patterns (factory pattern, proper middleware ordering, asyncHandler, timeout with AbortSignal)
- `shared/` directory provides cross-package types via path aliases

**Key improvement:** Consolidate types so backend imports from `shared/` instead of maintaining parallel definitions.

---

## Security Posture

**Rating: GOOD**

Strong security engineering throughout:
- JWT auth validated server-side via `supabase.auth.getUser()` (not just decoded)
- Timing-safe comparison for admin secret
- Anti-enumeration patterns in auth flows
- HMAC-SHA256 hashed OTPs with attempt limits and expiry
- All data queries user-scoped via `user_id`
- Prompt injection defenses (sanitization + data boundary markers)
- CSP with nonce-based script-src and frame-ancestors 'none'
- Comprehensive input validation (regex, length limits, body size limits)
- No raw SQL, no innerHTML, no command execution
- Stripe webhook signature verification with idempotency
- Open redirect properly mitigated in auth callback

**Key improvements:** Run `npm audit fix`, add UUID validation on deletes, plan Redis-backed rate limiting.

---

## API Patterns Assessment

**Rating: GOOD**

- Consistent envelope response format (`{ success, data/error }`)
- Well-designed React Query setup with hierarchical keys and tiered stale times
- Proper optimistic updates with rollback
- AbortSignal propagation for request cancellation
- Comprehensive rate limiting per route type
- Good timeout middleware with AbortController

**Key improvements:** Add pagination to list endpoints, enable Next.js server fetch caching, reduce per-request session overhead.

---

## Prioritized Recommendations

### Quick Wins (< 1 hour each)
1. Run `npm audit fix` in both packages
2. Extract `validateEmail()` helper in auth controller
3. Extract shared `getApiBaseUrl()` in frontend
4. Add UUID validation on delete endpoints
5. Remove deprecated `AIAnalysisResponse` type and test fixture
6. Add `signal` and `staleTime` to detail query hooks
7. Reset OTP attempts on resend

### Medium Effort (1-4 hours each)
8. Create generic CRUD controller/service factories for reports/advice
9. Create `useEntityCrud` hook factory for reports/advice
10. Backend imports types from `shared/` (add path alias to backend tsconfig)
11. Add pagination to list endpoints + update frontend hooks
12. Consolidate duplicate migration directories

### Larger Effort (4+ hours)
13. Enable selective server-side fetch caching in `server-api.ts`
14. Split `github.service.ts` and `advice.service.ts` along documented boundaries
15. Add ESLint to backend
16. Add response compression + HTTP cache headers
17. Add OpenAPI documentation

---

## Positive Highlights

- Zero `any` in production backend code
- Self-documenting comments in large files about future refactoring paths
- Clean utility abstractions (`sendError/sendSuccess`, `handleControllerError`, `throwIfDbError`, `asyncHandler`)
- Thoughtful React Query configuration with tiered stale times
- Excellent timeout middleware with AbortController signal propagation
- Proper Stripe webhook handling (raw body, signature verification, idempotency, invariant checks)
- Well-implemented prompt injection defenses for LLM interactions
- Consistent naming conventions throughout (kebab-case files, PascalCase components, camelCase functions)
