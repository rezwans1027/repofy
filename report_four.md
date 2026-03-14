# Verified Performance & Quality Issues

## Critical / High Priority

### 1. HeatmapGrid renders ~364 individually animated divs
**File:** `repofy-frontend/src/components/ui/heatmap-grid.tsx:44-57`
Each cell is a plain `<div>` with a unique CSS `animationDelay`, creating ~364 staggered animations. Can cause jank on slower devices.
**Fix:** Use CSS Grid animation or reduce to row-level animation.

### 2. ProfileSections is 418 lines with 7 unmemoized sections
**File:** `repofy-frontend/src/components/profile/profile-sections.tsx`
All 7 sections (stats, languages, repos, activity, PRs, collaborators, heatmap) are inline JSX in a single component. Any prop change re-renders everything.
**Fix:** Split into separate `React.memo` wrapped sub-components.

### 3. PDF layout components imported eagerly
**Files:**
- `repofy-frontend/src/components/report/analysis-report.tsx:10`
- `repofy-frontend/src/components/advice/advice-report.tsx:20`
`AnalysisReportPdfLayout` and `AdviceReportPdfLayout` are statically imported but only rendered when `exporting === true`.
**Fix:** Use `dynamic(() => import(...), { ssr: false })`.

### 4. Missing HTTP Cache-Control headers
**File:** `repofy-backend/src/lib/response.ts`
No `Cache-Control` headers on any response. Browser re-fetches identical data on every load despite 5-min in-memory cache.
**Fix:** Add `Cache-Control: public, max-age=300` on GET endpoints for GitHub user data.

### 5. AnalysisLoading has ~13 simultaneous active timers
**File:** `repofy-frontend/src/components/report/analysis-loading.tsx:109-147`
Creates 1 `setInterval(100ms)` + 8 phase `setTimeout`s + 4 log `setTimeout`s per phase simultaneously.
**Fix:** Consolidate into a single timer-based state machine.

## Medium Priority

### 6. Missing React.memo on TopRepos list items
**File:** `repofy-frontend/src/components/report/sections/top-repos.tsx:28-130`
Repo cards in `.map()` loops re-render when parent state changes (e.g. expanding one card re-renders all).

### 7. Radix-UI barrel imports
**Files:** 13 files in `repofy-frontend/src/components/ui/` import from `"radix-ui"` (barrel). Tree-shaking effectiveness depends on bundler config. ~10-15 KB savings possible with individual imports or `optimizePackageImports`.

### 8. Missing SEO metadata
- No `robots.ts` or `sitemap.ts` in app directory
- No Open Graph / Twitter Card metadata in root layout
- No `generateMetadata` on dynamic pages like `/profile/[username]`
- No JSON-LD structured data

### 9. No Suspense boundaries on home page
**File:** `repofy-frontend/src/app/page.tsx`
6 dynamically imported sections (`AnalysisPreview`, `AdvisorPreview`, `ComparePreview`, `HowItWorks`, `Pricing`, `FinalCta`) have no `<Suspense>` wrappers for streaming SSR.

### 10. Unused dependency react-type-animation
**File:** `repofy-frontend/package.json`
Listed as a dependency but not imported in any production code. Only referenced in test setup as a mock. ~20 KB removable.

### 11. Per-process rate limiter won't scale
**File:** `repofy-backend/src/middleware/rateLimit.ts`
Uses in-memory `MemoryStore`. Multiple replicas would allow N x limit bypass. Already documented in code with a TODO for Redis migration.

### 12. Unbounded activeAdviceRequests Map
**File:** `repofy-backend/src/controllers/advice.controller.ts:32`
No max size cap on the Map. Per-user design and 60s sweep mitigate risk, but no hard ceiling exists for traffic spikes.

### 13. Missing output: "standalone" in next.config.ts
**File:** `repofy-frontend/next.config.ts`
Recommended for production/container deployments. 5-10% bundle reduction.

## Low Priority

### 14. SmoothCaretInput double requestAnimationFrame
**File:** `repofy-frontend/src/components/ui/smooth-caret-input.tsx:60,64`
Both `onChange` and `onKeyDown` schedule separate `requestAnimationFrame` calls per keystroke. Minimal real impact since rAF deduplicates within a frame.

### 15. Navbar re-renders on every pathname change
**File:** `repofy-frontend/src/components/layout/navbar.tsx:17`
`usePathname()` triggers re-renders. Derived values like `isLandingPage` aren't memoized. Impact is negligible for a lightweight component.

### 16. StickyCTABar makes 3 separate queries
**File:** `repofy-frontend/src/components/profile/sticky-cta-bar.tsx:41-45`
`useExistingReport`, `useExistingAdvice`, `useCreditBalance` are 3 separate API calls that could potentially be batched.

### 17. Missing optimizePackageImports in next.config.ts
**File:** `repofy-frontend/next.config.ts`
Adding `experimental: { optimizePackageImports: ["radix-ui", "lucide-react"] }` would improve barrel import tree-shaking.
