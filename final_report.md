# Repofy — Consolidated Review Report

**Sources:** Code Quality Review (R1), Security Audit (R2), Performance & Optimization Review (R3)
**Scope:** 94+ source files, 36+ test files across the monorepo
**Duplicates removed:** 23 findings consolidated across reports

---

## Overall Assessment

The codebase is **well-architected and production-capable**. Auth, payments, data isolation, and error handling are fundamentally sound. Security posture is strong — no critical code-level exploits, consistent auth enforcement, no eval/innerHTML/dangerouslySetInnerHTML, CSP with nonces, Helmet, CORS allowlisting. The main gaps are operational/scaling concerns, performance inefficiencies, and maintainability issues.

---

## HIGH (2 findings)

### Security — Non-Blockers

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| H7 | **In-process-only concurrency lock** — `activeAdviceRequests` Map breaks under horizontal scaling, allowing double-charge | `advice.controller.ts:27` | R1, R2 |

### Performance

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| H18 | **`cleanExpiredCache` never called** — DB cache rows accumulate forever | `cache.service.ts:139-152` | R3 |

---

## MEDIUM (36 findings)

### Security & Reliability

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| M1 | Credit deduction and persistence not atomic — credit lost if persist fails. Pre-check is TOCTOU (DB RPC is true enforcement). | `advice-persistence.service.ts:42-43`, `advice.controller.ts:64-68` | R1, R2 |
| M2 | `ENGINE_URL` from env used as fetch target with no validation — SSRF if misconfigured | `engine.service.ts:9` | R2 |
| M3 | `getSession()` used after `getUser()` — token may differ during rotation | `server-api.ts:22-25` | R2, R3 |
| M4 | `style-src 'unsafe-inline'` in CSP required by framer-motion (documented trade-off) | `middleware.ts:89` | R1, R2 |
| M6 | Email addresses logged at INFO level (PII) — may violate GDPR/CCPA | `auth.service.ts`, `email.service.ts` | R2 |
| M7 | `filePath` not URI-encoded in GitHub content fetch — no `..` traversal check | `github.service.ts:838` | R2 |
| M8 | `allowTaint: true` in PDF html2canvas — broader than necessary (only GitHub avatars) | `export-pdf.ts:146` | R2 |
| M9 | In-memory rate limiting won't work when horizontally scaling — needs Redis store | `rateLimit.ts` | R1, R2 |
| M10 | No HTTPS enforcement in backend beyond Helmet defaults — depends on reverse proxy | Backend infra | R2 |
| M11 | `resendOtp` does not reset OTP attempts counter | `auth.service.ts:179-183` | R3 |
| M12 | Auth verification runs before rate limiting on all routes | `github.routes.ts:10`, `analyze.routes.ts:10` | R3 |
| M13 | No global IP-based rate limiter for unauthenticated abuse | `app.ts:13-48` | R3 |

### Code Quality

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| M14 | `as any` type assertion instead of `Record<string, unknown>` | `controller-utils.ts:9` | R1 |
| M15 | `admin.service.ts:33` — `data as UsageRow[]` assertion with no runtime validation | `admin.service.ts:33` | R1 |
| M16 | Stripe webhook errors use different response shape than rest of API | `stripe.controller.ts` | R1 |
| M18 | `RUBRIC_VERSION` hardcoded in controller, must stay in sync with engine | Controller | R1 |
| M19 | LRU cache has no size-based eviction by data size (64 entries x ~100KB) | `cache.service.ts` | R1 |
| M20 | `mock-ai.service.ts` — 490-line file mixing hardcoded mock data with logic | `mock-ai.service.ts` | R1 |
| M21 | `suppressHydrationWarning` on `<body>` could mask real issues | `layout.tsx:41` | R1, R2 |
| M22 | `signup/page.tsx:221` — eslint-disable for exhaustive-deps hides stale closure risk | `signup/page.tsx:221` | R1 |
| M23 | `pricing/page.tsx` — `balanceAtCheckout` race condition if webhook fires before page load | `pricing/page.tsx:57-69` | R1 |
| M24 | `<Suspense>` with no fallback prop (blank flash) | `pricing/page.tsx:392` | R1 |
| M25 | Inconsistent accent colors (emerald vs cyan) with no shared constant | Multiple components | R1 |

### Performance

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| M26 | `serverFetch` makes 2 sequential Supabase auth calls — parallelize or reduce to 1 | `server-api.ts:22-25` | R3 |
| M27 | Dashboard raw `<img>` + manual preloading anti-pattern — use `next/image` | `dashboard/page.tsx:26-52, 166-173` | R1, R3 |
| M28 | AnalysisLoading: 48 infinite JS animations + 100ms timer re-renders — use CSS keyframes | `analysis-loading.tsx:103-107, 252-280` | R3 |
| M29 | HeatmapGrid renders 364 individually animated cells — consider canvas or single fade | `heatmap-grid.tsx:44-57` | R3 |
| M30 | Zero `React.memo` usage across 91 client components | All components | R3 |
| M31 | `demo-data.ts` (16KB) always bundled even when real data is passed | `analysis-report.tsx:4` | R1, R3 |
| M32 | `react-type-animation` eliminable — custom `useTypewriter` hook already exists | `dashboard/page.tsx:6` | R3 |
| M33 | `AnalysisReport` statically imports all 11 section components — use lazy loading | `analysis-report.tsx:7-18` | R3 |
| M34 | `framer-motion` (~40KB) forced into root bundle — use `LazyMotion` | `layout.tsx:43` | R3 |
| M35 | WeeklyRoadmap: ~60+ motion nodes with layout-triggering `whileHover` | `weekly-roadmap.tsx:162-287` | R3 |
| M36 | No timeout middleware on reports, credits, advice read routes | `reports.routes.ts`, `credit.routes.ts` | R3 |
| M37 | Sequential paginated repo fetching (up to 10 pages); no concurrency limit on 6 parallel snapshot fetches (~30 simultaneous GitHub calls) | `github.service.ts:140-156, 933-937` | R3 |
| M38 | GraphQL `errors` field not checked in response body; retry on 429 ignores `Retry-After` header | `github.service.ts:117-134`, `retry.ts:36-42` | R3 |

### Build & Config

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| M39 | Missing `experimental.optimizePackageImports` for `lucide-react`, `framer-motion`, `radix-ui` | `next.config.ts` | R3 |
| M40 | Frontend `target: "ES2017"` is unnecessarily conservative | `tsconfig.json:3` | R3 |

---

## LOW (28 findings)

### Code Quality

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| L1 | `unhandledRejection` handler exits without graceful shutdown | Backend process handler | R1 |
| L2 | Stripe webhook route registered outside the route system | `app.ts` | R1 |
| L3 | Test helper uses `Record<string, any>` instead of `unknown` | Test helpers | R1 |
| L4 | LOC estimation assumes 40 bytes/line (rough heuristic) | Backend service | R1 |
| L5 | `buildTreeString` truncates at 100 lines with no indicator | Backend service | R1 |
| L6 | Missing unit tests for 7 services (cache, engine, email, stripe, admin, reports, crud) | Test directory | R1 |
| L7 | `EMAIL_RE` regex in auth controller should move to shared `validators.ts` | Auth controller | R1 |
| L8 | `SmoothCaretInput` doesn't forward ref (limits reusability) | `smooth-caret-input.tsx` | R1 |
| L9 | `SignOutButton` has no try/catch around sign-out call | Sign-out button | R1 |
| L10 | Unused type aliases `ReportRow` and `AdviceRow` in hooks | Frontend hooks | R1 |
| L11 | Stack traces exposed in non-production envs | `errorHandler.ts:22-26` | R2 |
| L12 | No `noUncheckedIndexedAccess` in backend tsconfig | `tsconfig.json` | R2 |
| L13 | No RLS as defense-in-depth (service role key used; all queries filter by `user_id`) | `supabase.ts:9` | R2 |
| L14 | `sortOptions` constant declared inside component body — recreated every render | `advisor/page.tsx:85-88` | R3 |
| L16 | `CountUp` — no `cancelAnimationFrame` cleanup; IntersectionObserver recreated on state change | `count-up.tsx:42-58` | R3 |
| L17 | `useActiveSection` creates N IntersectionObservers instead of 1 | `use-active-section.ts:12-27` | R3 |
| L18 | `useTypewriter` uses 4 separate state values — could consolidate into `useReducer` | `use-typewriter.ts:6-9` | R3 |
| L19 | `headers()` allocates a new object per GitHub API call | `github.service.ts:59-65` | R3 |
| L20 | Health check doesn't verify Supabase connectivity | `health.controller.ts` | R3 |
| L21 | `declaration: true` generates unnecessary `.d.ts` files for private app | `tsconfig.json:14` | R3 |
| L22 | Helmet applies unnecessary browser-security headers to a JSON API | `app.ts:25` | R3 |
| L23 | `cleanupExpiredSignups` runs on every signup — better on an interval | `auth.service.ts:55-57` | R3 |
| L24 | Supabase client created at module scope in auth-provider — should use lazy singleton | `auth-provider.tsx:14` | R1, R3 |
| L25 | `RadarChart` / `ComparisonRadarChart` `pathData` not memoized | `radar-chart.tsx:28-30` | R3 |

### Accessibility

| # | Issue | Location | Sources |
|---|-------|----------|---------|
| L26 | Missing `aria-label` on advisor search input and checkbox containers | Advisor page | R1 |
| L27 | Footer links point to `#` (placeholder) | Frontend footer | R1 |
| L28 | `.env.example` lists `OPENAI_API_KEY` that backend doesn't use (misleading) | `.env.example` | R1 |
| L29 | Health endpoint exposes `process.uptime()` and has no rate limiting | `health.controller.ts:14` | R1, R2 |

---

## Blocker Summary

This **1 item** must be fixed before scaling or going live:

| # | Severity | Issue | Quick Fix? |
|---|----------|-------|------------|
| H7 | High | In-process concurrency lock — double-charge risk at scale | No — needs distributed lock |

---

## Recommended Priority Order

1. **Call `cleanExpiredCache` on an interval** — prevent unbounded DB growth (H18)
2. **Plan for distributed lock** before horizontal scaling (H7)
3. Address remaining MEDIUM performance items (M27, M28, M29)

---

## What's Done Well

| Area | Highlights |
|------|-----------|
| **Auth** | Supabase JWT on all routes, timing-safe comparisons, HMAC OTPs, 5-attempt lockout, 10-min expiry |
| **Payments** | Stripe signature verification, amount/currency/product validation, idempotent credit grants |
| **Security Headers** | HSTS, X-Frame-Options DENY, nonce-based CSP, nosniff, strict referrer, permissions policy |
| **Data Safety** | No IDOR (all queries filter by `user_id`), no SSRF, no prompt injection surface, no mass assignment |
| **Architecture** | CRUD factories, app factory pattern, AbortSignal propagation, typed error hierarchy |
| **Testing** | PGlite against real migrations, financial transaction coverage, shared test helpers |
| **Frontend** | `viewport={{ once: true }}`, `useReducedMotion`, lazy devtools, Zod API validation, no barrel files |
| **Build** | Self-hosted WOFF2 fonts, source maps disabled in prod, lazy PDF loading, proper tree-shaking |
| **Auth Tokens** | httpOnly cookies via `@supabase/ssr`, proactive refresh 60s before expiry, no localStorage |

---

## Summary by the Numbers

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 36 |
| Low | 28 |
| **Total (deduplicated)** | **66** |
| **Blockers** | **1** |
