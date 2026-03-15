# Repofy — Consolidated Audit Report

24 open issues remaining (32 resolved) across security, code quality, performance, and architecture.
Consolidated from 4 separate reviews with duplicates merged.

---

## CRITICAL (1)

### 1. Shared types have drifted — two disconnected copies
- **Category:** Architecture
- **Files:** `repofy-frontend/src/shared/types/report.ts` vs `repofy-backend/src/types/shared/report.ts`
- **Issue:** Both frontend and backend maintain their own local copies of shared types with manual "SYNC" comments. No build-time enforcement ensures they stay aligned — relies entirely on developer discipline.
- **Fix:** Pick one canonical location (root `shared/`), wire both projects to import from it via path aliases or npm workspaces, and delete the duplicate copies.

---

## HIGH (1)

### 2. No CI/CD pipeline
- **Category:** Architecture
- **Issue:** No `.github/workflows/` directory exists. Tests, type checking, and linting don't run on PRs — broken code can be merged undetected.

---

## MEDIUM (4)

### Code Quality

#### 3. Duplicated credit confirmation dialog across 2 components
- **Files:** `repofy-frontend/src/components/profile/sticky-cta-bar.tsx`, `repofy-frontend/src/components/advice/sections/advice-export-bar.tsx`

#### 4. `<img>` tags in banners instead of `next/image`
- **Files:** `repofy-frontend/src/components/report/sections/top-banner.tsx:33`, `repofy-frontend/src/components/advice/sections/advice-top-banner.tsx:35`
- **Issue:** At least one banner still uses raw `<img>` tags instead of `next/image` for GitHub avatar images.

#### 5. GitHub data fetched twice — no shared service-level cache
- **Files:** `repofy-backend/src/controllers/analyze.controller.ts:48`, `repofy-backend/src/controllers/advice.controller.ts:72`
- **Issue:** Both controllers independently call `fetchGitHubUserData(username, req.signal)` with no shared cache.

### Performance

#### 6. Missing HTTP Cache-Control headers
- **Location:** `repofy-backend/src/lib/response.ts`
- **Issue:** No `Cache-Control` headers on any response. Browser re-fetches identical data on every load despite 5-min in-memory cache.
- **Fix:** Add `Cache-Control: public, max-age=300` on GET endpoints for GitHub user data.

---

## LOW (9)

| # | Issue | Location |
|---|-------|----------|
| 7 | `.next/` directory exists in backend project | `repofy-backend/.next/` |
| 8 | `OPENAI_API_KEY` in `.env.example` but unused in codebase | `repofy-backend/.env.example` |
| 9 | `ENGINE_URL` and `ENGINE_INTERNAL_KEY` missing from `.env.example` | `repofy-backend/.env.example` |
| 10 | `@types/node` version mismatch (`^20` frontend vs `^22` backend) | Both `package.json` files |
| 11 | No backend ESLint config | `repofy-backend/` |
| 12 | Frontend test coverage thresholds low (60/55/50/60 vs backend 80/80/75/80) | `vitest.config.ts` |
| 13 | No tests for reports/admin controllers and services | `repofy-backend/tests/` |
| 14 | Weak request ID format validation (accepts any 1-128 char alphanumeric string) | `repofy-backend/src/middleware/requestId.ts` |
| 15 | Health endpoint has no rate limiter | `repofy-backend/src/routes/health.routes.ts` |

---

## NICE-TO-HAVE (9)

| # | Issue | Location |
|---|-------|----------|
| 16 | `react-type-animation` installed but unused (only in test mock) | Frontend `package.json` |
| 17 | 3 separate in-memory cache implementations (identical pattern) | `auth.ts`, `cache.service.ts`, `github.controller.ts` |
| 18 | Missing `loading.tsx` for settings route | `repofy-frontend/src/app/(app)/settings/` |
| 19 | No page-specific metadata / missing SEO (no robots.ts, sitemap.ts, OG tags, JSON-LD) | All sub-pages |
| 20 | `process.uptime()` exposed in unauthenticated health endpoint | `health.controller.ts:16` |
| 21 | Stripe checkout URL validation uses `startsWith` instead of hostname check | `pricing/page.tsx:101` |
| 22 | No root `package.json` — no monorepo orchestration | Project root |
| 23 | Missing `output: "standalone"` in next.config.ts | `repofy-frontend/next.config.ts` |
| 24 | Missing `optimizePackageImports` for radix-ui and lucide-react | `repofy-frontend/next.config.ts` |
