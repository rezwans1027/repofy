# Frontend Testing Infrastructure Audit Report

**Date**: February 25, 2026  
**Application Type**: SaaS engineering-candidate analysis dashboard  
**Framework**: Next.js (App Router) + React  
**Testing Framework**: Vitest + Testing Library + Playwright

---

## 1. Executive Summary

**Overall Health Score: 74/100**

Your frontend testing setup is solid and already ahead of many early-stage products:
- Clear test layers (unit/component/page + E2E)
- Reusable test utilities and fixtures
- Deterministic E2E strategy (`MOCK_AI=true`, auth setup project, seeded test data)

The biggest risk is uneven coverage on newly added Advice features. Some high-impact routes and sections are untested, and current page tests rely heavily on mocks in places where integration behavior matters most.

**Confidence Level in Test Suite**: Medium  
Confidence is medium because core report/compare/search flows are covered, but Advice generation/view and several production pages still lack direct protection.

**Top 3 Critical Findings**
1. Core Advice routes are missing direct tests (`/advisor/generate/[username]`, `/advisor/[id]`).
2. Coverage artifacts are stale and include deleted files, so saved coverage reports are not reliable.
3. No in-repo CI workflow was found to enforce test/coverage gates on every PR.

---

## 2. Application Context

### What This Application Does
Repofy appears to be an authenticated platform where users:
- Search GitHub profiles
- Generate analysis reports
- Compare candidates side-by-side
- Generate and review career advice

### Key User Journeys

| Journey | Relative Importance | Test Coverage |
|---------|---------------------|---------------|
| Auth guard + login | Critical | Adequate |
| Search -> profile -> generate report -> view report | Critical | Adequate |
| Reports CRUD/filter/sort/delete | High | Adequate |
| Compare candidates | High | Adequate |
| Advice list -> generate advice -> view advice | Critical | Partial |

### Technology Stack

| Layer | Technology | Testing Approach |
|-------|------------|------------------|
| UI/App | Next.js + React | Vitest page/component tests |
| Async data | TanStack Query + Supabase | Hook tests with chain mocks |
| End-to-end | Playwright | Auth project + seeded data helpers |

---

## 3. Test Validity Assessment

**Verdict**: Mixed (good foundation, some false-confidence pockets)  
**Estimated tests providing strong real protection**: ~70%

### Well-written test examples

1. `src/hooks/use-reports.test.ts`  
   Strong because it verifies success + failure behavior and mutation arguments.

2. `e2e/reports-crud.spec.ts`  
   Strong because it validates user-visible workflow outcomes (filtering, sorting, deletion, navigation).

### Problematic/weak patterns

1. `src/app/(app)/report/[id]/page.test.tsx`  
   `AnalysisReport` is fully mocked, so key rendering/contract behavior for the detailed report page is not exercised.

2. `src/app/(app)/compare/page.test.tsx`  
   Heavy child mocks (`comparison-radar-chart`, `comparison-export-bar`) reduce confidence in integration behavior on a complex page.

3. Multiple page tests rely on text-presence checks only (`toBeInTheDocument`) without validating richer outcomes (state transitions, route behavior, contract payload shape).

---

## 4. False Confidence Risks

### Tests With Reduced Protection

| Test File | Issue | Risk |
|-----------|-------|------|
| `src/app/(app)/report/[id]/page.test.tsx` | Child-report renderer mocked | High |
| `src/app/(app)/compare/page.test.tsx` | Complex children mocked | Medium |
| Several page tests | Text-only assertions dominate | Medium |

### Over-mocked areas
- Report detail page (`AnalysisReport` mocked)
- Compare page heavy visualization/export children mocked

### Implementation-coupled areas
- Some tests tied to current text strings and specific DOM presence rather than behavior contracts

---

## 5. Critical Gaps

### High Priority (core functionality at risk)

| Missing Test | Location | Impact | Effort |
|--------------|----------|--------|--------|
| Advice generation page behavior | `src/app/(app)/advisor/generate/[username]/page.tsx` | Regression risk in API/save/upsert fallback flow | 4-6h |
| Advice detail page behavior | `src/app/(app)/advisor/[id]/page.tsx` | Regression risk in load/error/back-link/authorization UX | 3-5h |
| Advice E2E journey | `e2e/` (no advisor flow spec) | Critical user flow can break without CI signal | 5-8h |

### Medium Priority (important user flows)

| Missing Test | Location | Impact | Effort |
|--------------|----------|--------|--------|
| Settings page | `src/app/(app)/settings/page.tsx` | Sign-out and account display can regress silently | 2-3h |
| New advice sections direct tests | `src/components/advice/sections/{build-roadmap,career-positioning,contribution-strategy,skill-roadmap,strengths-and-gaps,success-metrics,trajectory,weekly-roadmap}.tsx` | Data-shape/UI regressions not isolated | 6-10h |

### Low Priority (nice-to-have coverage)

| Missing Test | Location | Impact | Effort |
|--------------|----------|--------|--------|
| Landing page assembly | `src/app/page.tsx` | Marketing composition regressions | 1-2h |
| Signup static page | `src/app/(auth)/signup/page.tsx` | Low behavior complexity | 1h |
| Active-section hook | `src/hooks/use-active-section.ts` | Scroll/highlight behavior can drift | 2-3h |

---

## 6. Infrastructure Findings

### Configuration strengths
- Good Vitest setup with shared setup file and cleanup
- Useful E2E project split (`setup`, `unauthenticated`, `authenticated`)
- Deterministic backend mode in E2E via `MOCK_AI=true`
- Backend test thresholds are significantly stricter than frontend

### Infrastructure issues

1. **Frontend coverage thresholds are modest**  
   In `repofy-frontend/vitest.config.ts`, thresholds are:
   - lines: 60
   - functions: 55
   - branches: 50
   - statements: 60  
   These are permissive for core app surfaces.

2. **Coverage artifact appears stale**  
   `repofy-frontend/coverage/clover.xml` references removed files:
   - `action-plan.tsx`
   - `contribution-advice.tsx`
   - `project-ideas.tsx`
   - `skills-to-learn.tsx`  
   This means committed/generated coverage output is not trustworthy unless regenerated.

3. **No repo-local GitHub workflow found**  
   No `.github/workflows/*` in repository root (excluding `node_modules`), so PR enforcement appears external/manual.

---

## 7. Coverage by Area

### Snapshot counts (frontend)
- Total test files found (`src` + `e2e`): **58**
- App routes with `page.tsx`: **13**
- App routes with `page.test.tsx`: **8**
- Hooks (`use*.ts`) found: **6**
- Hooks with direct tests: **5**

### Pages

| Page | Tests? | Coverage Quality | Notes |
|------|--------|------------------|-------|
| `/dashboard` | Yes | Good | Includes loading/empty/search-related behavior |
| `/reports` | Yes | Good | Strong page + E2E CRUD/filter/sort coverage |
| `/compare` | Yes | Partial | Good E2E, but page unit tests mock heavy children |
| `/profile/[username]` | Yes | Partial | Covered, but mostly mocked dependencies |
| `/report/[id]` | Yes | Partial | Core child renderer mocked |
| `/generate/[username]` | Yes | Partial | Unit tests exist; relies on mocked `AnalysisLoading` |
| `/advisor` | Yes | Partial | List interactions covered |
| `/advisor/[id]` | No | Missing | Core detail route untested |
| `/advisor/generate/[username]` | No | Missing | Core generation route untested |
| `/settings` | No | Missing | Sign-out path untested |
| `/signup` | No | Missing | Low risk static page |
| `/` | No | Missing | Low-medium marketing composition risk |

### Hooks

| Hook | Tests? | Coverage Quality | Notes |
|------|--------|------------------|-------|
| `use-advice` | Yes | Good | Success + failure + mutation paths |
| `use-reports` | Yes | Good | Success + error + mutation paths |
| `use-github` | Yes | Good | API query behavior covered |
| `use-selectable-list` | Yes | Good | Interaction semantics covered |
| `use-mobile` | Yes | Partial | Basic behavior coverage |
| `use-active-section` | No | Missing | Observer-driven behavior untested |

### E2E user flows

| Flow | Tested? | Type | Notes |
|------|---------|------|-------|
| Unauth route redirects | Yes | E2E | `auth-guard.spec.ts` |
| Login validation | Yes | E2E | Empty-submit errors covered |
| Search -> profile -> report | Yes | E2E | Covered in `search-to-report.spec.ts` |
| Reports table operations | Yes | E2E | Covered in `reports-crud.spec.ts` |
| Compare flow | Yes | E2E | Covered in `compare-flow.spec.ts` |
| Advice generate/view flow | No | E2E | Missing |

---

## 8. Recommendations

### Quick wins (high impact, low effort)

1. Add `advisor/[id]/page.test.tsx` for loading/error/back-link branches.
2. Add `advisor/generate/[username]/page.test.tsx` for success, fallback (`42P10`), and save-failure branches.
3. Add one Playwright spec for Advice flow end-to-end (profile -> get advice -> advisor detail render).
4. Remove committed/stale coverage artifacts or regenerate them in CI to avoid misleading signals.

### Structural improvements

1. Raise frontend coverage thresholds incrementally:
   - Target 1: lines/statements 70, functions 65, branches 60
   - Target 2: lines/statements 75+, branches 65+
2. Add in-repo CI workflow (`test`, `test:coverage`, `test:e2e` for gated branches).
3. Reduce mock depth in selected page tests by rendering real key children where practical.

### Testing strategy changes

1. For complex pages (report/compare/advisor), keep one lightweight integration-style page test with minimal mocks.
2. Keep unit tests focused, but enforce at least one route-level contract test per critical user journey.

---

## 9. Implementation Roadmap

### Phase 1: Critical fixes (1-3 days)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add tests for `advisor/[id]` + `advisor/generate/[username]` | P0 | 1 day | Existing fixtures/mocks |
| Add Advice E2E happy path | P0 | 0.5-1 day | Existing auth setup and seed helpers |
| Regenerate or remove stale coverage artifacts | P0 | 1-2h | CI decision |

### Phase 2: Coverage hardening (1 week)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add tests for 8 new advice sections | P1 | 1-2 days | Advice fixtures |
| Add settings + landing page tests | P1 | 0.5-1 day | Existing test providers |
| Add test for `use-active-section` | P1 | 0.5 day | IntersectionObserver mock |

### Phase 3: Infrastructure hardening (ongoing)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add CI workflow with required checks | P1 | 0.5-1 day | Repo policy |
| Incrementally raise coverage thresholds | P2 | Ongoing | Stabilized suite |

---

## 10. Key Evidence (File References)

- Frontend thresholds: `repofy-frontend/vitest.config.ts`
- Playwright project setup: `repofy-frontend/playwright.config.ts`
- Missing core Advice pages:
  - `repofy-frontend/src/app/(app)/advisor/generate/[username]/page.tsx`
  - `repofy-frontend/src/app/(app)/advisor/[id]/page.tsx`
- Page test inventory source:
  - `repofy-frontend/src/app/**/*page.tsx`
  - `repofy-frontend/src/app/**/*page.test.tsx`
- Over-mocking examples:
  - `repofy-frontend/src/app/(app)/compare/page.test.tsx`
  - `repofy-frontend/src/app/(app)/report/[id]/page.test.tsx`
- Stale coverage artifact:
  - `repofy-frontend/coverage/clover.xml`
