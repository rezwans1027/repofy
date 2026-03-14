# Repofy Performance & Optimization Review

## CRITICAL (1 issue)

| # | Issue | Location |
|---|-------|----------|
| 1 | **Single GitHub token caps throughput at ~166 analyses/hour** — no token pool/rotation | `repofy-backend/src/services/github.service.ts:59-65` |

---

## HIGH (10 issues)

### Frontend

| # | Issue | Location |
|---|-------|----------|
| 2 | **AuthContext value object recreated every render** — cascades re-renders to every `useAuth()` consumer. Fix: `useMemo` | `repofy-frontend/src/components/providers/auth-provider.tsx:40` |
| 3 | **OverlayScrollbar triggers 3 state updates per scroll frame** (~60/sec) — should use refs for DOM updates | `repofy-frontend/src/components/ui/overlay-scrollbar.tsx:18-34` |
| 4 | **`serverFetch` uses `cache: "no-store"` for ALL requests** — immutable report/advice data never cached | `repofy-frontend/src/lib/server-api.ts:29` |
| 5 | **`serverFetch` makes 2 sequential Supabase auth calls** — `getUser()` + `getSession()` should be parallelized or reduced to 1 | `repofy-frontend/src/lib/server-api.ts:22-25` |
| 6 | **Dashboard uses raw `<img>` + manual preloading anti-pattern** — blocks rendering; `next/image` already configured for GitHub avatars | `repofy-frontend/src/app/(app)/dashboard/page.tsx:26-52, 166-173` |
| 7 | **AnalysisLoading: 48 infinite JS animations + 100ms timer re-renders** — should be CSS keyframes + reduce timer frequency | `repofy-frontend/src/components/report/analysis-loading.tsx:103-107, 252-280` |
| 8 | **HeatmapGrid renders 364 individually animated cells** — consider canvas or single fade-in | `repofy-frontend/src/components/ui/heatmap-grid.tsx:44-57` |

### Backend

| # | Issue | Location |
|---|-------|----------|
| 9 | **No caching for `/github/:username` endpoint** — 30+ GitHub API calls repeated on every visit | `repofy-backend/src/controllers/github.controller.ts:34-54` |
| 10 | **`cleanExpiredCache` is never called** — DB cache rows accumulate forever | `repofy-backend/src/services/cache.service.ts:139-152` |
| 11 | **Every auth check makes an HTTP round-trip to Supabase** — no token verification cache; 3-5 redundant calls per page load | `repofy-backend/src/middleware/auth.ts:18` |

---

## MEDIUM (20 issues)

### Frontend — Rendering & Bundle

| # | Issue | Location |
|---|-------|----------|
| 12 | Zero `React.memo` usage across 91 client components | All components |
| 13 | `demo-data.ts` (16KB) always bundled even when real data is passed | `analysis-report.tsx:4` |
| 14 | `react-type-animation` is eliminable — custom `useTypewriter` hook already exists | `dashboard/page.tsx:6` |
| 15 | `AnalysisReport` statically imports all 11 section components | `analysis-report.tsx:7-18` |
| 16 | `framer-motion` (~40KB) forced into root bundle via `MotionProvider` — use `LazyMotion` | `layout.tsx:43` |
| 17 | Profile page fetches entirely client-side (loading waterfall) | `profile/[username]/page.tsx` |
| 18 | `OverlayScrollbar` mounted globally on every page including login/signup | `layout.tsx:45` |
| 19 | WeeklyRoadmap: ~60+ motion nodes with layout-triggering `whileHover` | `weekly-roadmap.tsx:162-287` |
| 20 | Dashboard & Advisor use `layout` prop on list items — FLIP measurement on every change | `dashboard/page.tsx:162`, `advisor/page.tsx:289` |
| 21 | `RadarChart` / `ComparisonRadarChart` — `pathData` not memoized | `radar-chart.tsx:28-30`, `comparison-radar-chart.tsx:75-79` |
| 22 | `CountUp` — no `cancelAnimationFrame` cleanup on unmount | `count-up.tsx:42-58` |
| 23 | Landing page loads `QueryProvider` (~12KB) unnecessarily — no queries on that page | `page.tsx:31` |

### Backend — Reliability & Efficiency

| # | Issue | Location |
|---|-------|----------|
| 24 | Reports, credits, advice read routes have **no timeout middleware** | `reports.routes.ts:9-13`, `credit.routes.ts:9` |
| 25 | Sequential paginated repo fetching (up to 10 pages) | `github.service.ts:140-156` |
| 26 | No concurrency limit on 6 parallel repo snapshot fetches (~30 simultaneous GitHub calls) | `github.service.ts:933-937` |
| 27 | GraphQL `errors` field not checked in response body | `github.service.ts:117-134` |
| 28 | Retry on 429 ignores `Retry-After` header | `retry.ts:36-42` |
| 29 | Auth verification runs before rate limiting on all routes | `github.routes.ts:10`, `analyze.routes.ts:10` |
| 30 | No global IP-based rate limiter for unauthenticated abuse | `app.ts:13-48` |
| 31 | `resendOtp` does not reset OTP attempts counter | `auth.service.ts:179-183` |

### Build & Config

| # | Issue | Location |
|---|-------|----------|
| 32 | Missing `experimental.optimizePackageImports` for `lucide-react` (41 import sites), `framer-motion`, `radix-ui` | `next.config.ts` |
| 33 | Frontend `target: "ES2017"` is unnecessarily conservative | `tsconfig.json:3` |

---

## LOW (15 issues)

### Frontend

| # | Issue | Location |
|---|-------|----------|
| 34 | `sortOptions` constant declared inside component body — recreated every render | `advisor/page.tsx:85-88` |
| 35 | Report top-banner uses raw `<img>` for avatars | `top-banner.tsx:33-36` |
| 36 | `ComparisonRadarChart` uses `animate` instead of `whileInView` for path drawing | `comparison-radar-chart.tsx:148-149` |
| 37 | `CountUp` IntersectionObserver recreated when `hasStarted` changes | `count-up.tsx:40` |
| 38 | `useActiveSection` creates N IntersectionObservers instead of 1 | `use-active-section.ts:12-27` |
| 39 | `useTypewriter` uses 4 separate state values — could consolidate into `useReducer` | `use-typewriter.ts:6-9` |
| 40 | `StatsOverview` imports `useMemo` without `"use client"` directive | `stats-overview.tsx:1` |
| 41 | `AuthProvider` creates Supabase client at module scope (not lazy) | `auth-provider.tsx:14` |

### Backend

| # | Issue | Location |
|---|-------|----------|
| 42 | `headers()` allocates a new object per GitHub API call | `github.service.ts:59-65` |
| 43 | `resendOtp` uses `select("*")` instead of specific columns | `auth.service.ts:162` |
| 44 | Health check does not verify Supabase connectivity | `health.controller.ts:1-22` |
| 45 | `declaration: true` generates unnecessary `.d.ts` files for private app | `tsconfig.json:14` |
| 46 | `sourceMap: false` — no source maps for production debugging | `tsconfig.json:16` |
| 47 | Helmet applies unnecessary browser-security headers to a JSON API | `app.ts:25` |
| 48 | `cleanupExpiredSignups` runs on every signup — better on an interval | `auth.service.ts:55-57` |

---

## Top 5 Quick Wins (Highest Impact, Lowest Effort)

1. **Add `useMemo` to AuthContext value** — 1 line change, eliminates cascade re-renders across the entire app
2. **Switch `serverFetch` to `next: { revalidate: 3600 }` for report/advice endpoints** — 1 line, enables server-side caching
3. **Replace raw `<img>` with `next/image` on dashboard** and delete the avatar preloading `useEffect` — removes ~30 lines of code
4. **Cache auth token verification** in backend with 30s TTL `Map` — eliminates 60-80% of Supabase Auth HTTP calls
5. **Call `cleanExpiredCache` on an interval** — add 1 line: `setInterval(() => cleanExpiredCache(), 3_600_000)` to prevent unbounded DB cache growth

---

## Positive Patterns Found

The codebase already follows many best practices:

- `viewport={{ once: true }}` on animations — prevents re-triggering on scroll back
- `useReducedMotion` support in `AnimateOnView` — respects user preferences
- Dynamic imports for landing page sections via `next/dynamic`
- Lazy PDF library loading via dynamic `import()` in `export-pdf.ts`
- Lazy React Query devtools with `lazy()` + `Suspense`
- Optimistic updates with rollback in delete mutations
- `display: "swap"` on local fonts — no external font requests
- `passive: true` on scroll/resize event listeners
- `useDebouncedValue` for search input — prevents excessive API calls
- No barrel file re-exports — all imports use direct paths (excellent tree-shaking)
- Named lucide-react imports across 30+ files (proper tree-shaking)
- Proper Server Component data fetching for report/advisor detail pages
- Well-differentiated TanStack Query stale times (30s search, 2m profiles, 5m saved)
