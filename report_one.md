# Repofy Code Quality Review - Unified Report

**3 agents reviewed 94+ source files and 36+ test files across the monorepo.**

## Overall Verdict

The codebase is **well-architected and production-capable**. Auth, payments, data isolation, and error handling are all fundamentally sound. The main gaps are maintainability issues (dead code, DRY violations) and operational concerns (scaling rate limiters) rather than critical security flaws.

---

## CRITICAL (2 findings)

| # | Area | File | Issue |
|---|------|------|-------|
| 1 | Backend | `advice-builder.service.ts:28-42` | Manual field copying instead of spread -- silently drops new fields added to `AdviceV2` |
| 2 | Backend | `auth.service.ts:153` | `email!` non-null assertion -- unsafe if Supabase returns a user without email |

---

## HIGH (9 findings)

| # | Area | File | Issue |
|---|------|------|-------|
| 1 | Backend | `analyze.service.ts:23` | Activity percentages can sum to >100 due to rounding (reviewPct clamped to 0 but total not normalized) |
| 2 | Backend | `crud.controller.ts:33-34` | `parseInt` of non-numeric string returns `NaN`, propagates to Supabase `.range(NaN, NaN)` |
| 3 | Backend | `types/index.ts` + `requestId.ts` | Express namespace augmentation split across 2 files -- easy to miss |
| 4 | Backend | `controller-utils.ts:9` | `as any` type assertion instead of `Record<string, unknown>` |
| 5 | Backend | `mock-ai.service.ts` | 490-line file mixing hardcoded mock data with logic -- should extract fixtures |
| 6 | Frontend | `profile-sections.tsx:306` | Division by zero: `prActivity.merged / prActivity.opened` when opened is 0 |
| 7 | Frontend | 5 dead section components | `analysis-input`, `code-dna`, `profile-summary`, `language-fingerprint`, `commit-signature` -- never imported |
| 8 | Frontend | 8 dead compare components | Entire `compare/` directory is dead code (compare page shows ComingSoonCard) |
| 9 | Security | `requestId.ts:13` | Client-supplied `x-request-id` accepted without length/format validation -- log injection risk |

---

## MEDIUM (15 findings)

| # | Area | Issue |
|---|------|-------|
| 1 | Backend | `advice-persistence.service.ts:42-43` -- Credit deduction and persistence are not atomic (credit lost if persist fails) |
| 2 | Backend | Language color lookup pattern repeated 3 times -- extract `getLanguageColor()` helper |
| 3 | Backend | `RUBRIC_VERSION` hardcoded in controller, must stay in sync with engine |
| 4 | Backend | In-memory `activeAdviceRequests` Map doesn't work across multiple instances |
| 5 | Backend | `cache.service.ts` -- LRU cache has no size-based eviction by data size (64 entries x ~100KB) |
| 6 | Backend | `admin.service.ts:33` -- `data as UsageRow[]` assertion with no runtime validation |
| 7 | Backend | `stripe.controller.ts` webhook errors use different response shape than rest of API |
| 8 | Frontend | `auth-provider.tsx:14` -- Supabase client created at module scope (should use lazy singleton) |
| 9 | Frontend | `signup/page.tsx:221` -- eslint-disable for exhaustive-deps hides stale closure risk |
| 10 | Frontend | `pricing/page.tsx:57-69` -- `balanceAtCheckout` race condition if webhook fires before page load |
| 11 | Frontend | `pricing/page.tsx:392` -- `<Suspense>` with no fallback prop (blank flash) |
| 12 | Frontend | Inconsistent accent colors (emerald vs cyan) with no shared constant |
| 13 | Frontend | `layout.tsx:41` -- Unnecessary `suppressHydrationWarning` on `<body>` could mask real issues |
| 14 | Security | `style-src 'unsafe-inline'` in CSP (required by framer-motion, documented trade-off) |
| 15 | Security | In-memory rate limiting won't work when horizontally scaling -- needs Redis store |

---

## LOW (16 findings)

| # | Area | Issue |
|---|------|-------|
| 1 | Backend | `unhandledRejection` handler exits without graceful shutdown |
| 2 | Backend | Stripe webhook route registered outside the route system in `app.ts` |
| 3 | Backend | Test helper uses `Record<string, any>` instead of `unknown` |
| 4 | Backend | LOC estimation assumes 40 bytes/line (rough heuristic) |
| 5 | Backend | `buildTreeString` truncates at 100 lines with no indicator |
| 6 | Backend | Missing unit tests for 7 services (cache, engine, email, stripe, admin, reports, crud) |
| 7 | Backend | `EMAIL_RE` regex in auth controller should move to shared `validators.ts` |
| 8 | Frontend | Footer links point to `#` (placeholder) |
| 9 | Frontend | `demo-data.ts` (290+ lines) shipped in production bundle as fallback |
| 10 | Frontend | `<img>` used instead of `next/image` for dashboard avatars |
| 11 | Frontend | `SmoothCaretInput` doesn't forward ref (limits reusability) |
| 12 | Frontend | `SignOutButton` has no try/catch around sign-out call |
| 13 | Frontend | Unused type aliases `ReportRow` and `AdviceRow` in hooks |
| 14 | Frontend | Missing `aria-label` on advisor search input and checkbox containers |
| 15 | Security | `.env.example` lists `OPENAI_API_KEY` that backend doesn't use (misleading) |
| 16 | Security | Health endpoint has no rate limiting |

---

## Top Positives

- **Excellent error handling**: `handleControllerError` + typed error hierarchy eliminates duplication
- **Strong security**: Timing-safe comparisons, HMAC-hashed OTPs, account enumeration prevention, nonce-based CSP
- **Clean CRUD generics**: `createCrudController` + `createCrudService` on backend, `createCrudHooks` on frontend
- **Proper abort signal propagation**: Prevents double-response crashes
- **Thorough test infrastructure**: Shared helpers, PGlite-based DB tests, integration setup
- **Good React patterns**: Proper memoization, `useReducedMotion`, lazy-loaded devtools, Zod validation at API boundaries

---

## Recommended Priority Order

1. Fix the 2 **critical** items (spread in advice-builder, email null assertion)
2. Fix **division by zero** in profile-sections and **NaN pagination** in crud controller
3. **Delete dead code** (13 unused components/files) to reduce bundle size
4. Fix **request ID validation** (log injection risk)
5. Address **non-atomic credit deduction** for payment reliability
6. Extract DRY violations and consolidate type augmentations
