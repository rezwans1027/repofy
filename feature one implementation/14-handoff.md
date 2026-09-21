# Run 14 handoff — Role focus and immutable rescan comparisons

**Status: implemented and locally verified.** September 20, 2026. ANA-015–016 now have owner UI/API, immutable storage behavior and regression coverage. External rollout remains gated; no remote migration, production flag activation, deployment or customer billing change was performed.

## Delivered

The report's target-role selector uses its five recorded rubrics to order capabilities, roles, gaps and improvements. The preference is stored separately and survives reload. Scores, wording, priorities and original report payload remain unchanged, with no provider/model call or charge.

An owner can rescan an explicit authorized repository set from a saved baseline. Admission rechecks grants/attestation/limits and resolves the latest commits. Those SHAs are pinned atomically with a normal Run 07 job, so branch movement while queued cannot alter the accepted inputs. Stable request keys handle double clicks, uncertain responses and token-refresh replay. A fully unchanged request returns the existing report without another job/download/extraction/model call/reservation. Compatible unchanged snapshots are reused only after fresh permission checks; changed source policies invalidate reuse. Rescans currently use the zero-unit `internal_free_v1` policy.

The before/after page shows snapshot capture times, exact SHAs, analysis versions, current access and separate strength/confidence/assessability and five-role coverage deltas. It explains code, scope, repository, permission and analyzer/rubric differences. Evidence lists support repository/change/capability filters and bounded pages, with each observation linked to its immutable report. File renames/moves preserve unique content/concept matches; ambiguous matches stay uncertain. Narrative wording contributes no evidence improvement. Historical commit authored/committed timestamps are unavailable in the saved schema; capture dates are labeled explicitly.

Rescan history records available, pending, unchanged, failed and deleted outcomes with bounded keyset pages. Deleting a baseline leaves the target readable and its parent unavailable; comparisons never reconstruct deleted reports. Both endpoints must belong to the requester. Revocation retains permitted saved observations, suppresses locator matching/access and qualifies the interpretation. Preferences and lineage participate in account export/deletion.

The [architecture decision](../docs/adr/0014-role-focus-and-rescans.md) specifies all matching stages, limits, authorization, cache/billing rules, replay identity, deletion and rollback behavior.

## Interfaces and migration

| Area | Location |
| --- | --- |
| Shared contracts | `packages/contracts/src/rescans.ts` |
| Owner service / deterministic comparison / focus | `repofy-backend/src/domain/rescans/` |
| API | `repofy-backend/src/routes/rescans.routes.ts`: focus, availability, rescan history/start and owner-pair comparisons |
| Worker reuse | `domain/jobs/{repository,worker}.ts`, `domain/ingestion/service.ts` |
| UI | `role-focus.tsx`, `rescan-panel.tsx`, `report-comparison.tsx`; report evidence query links |
| Comparison page | `/readiness/reports/:baselineId/compare/:targetId` |
| Database | `20260920000700_rescans_and_comparisons.sql`: private preferences/lineage, service-only RPCs, fenced snapshot attachment, safe events and export v7 |

Build contracts before installing both applications. Apply the additive migration before the new API/worker/export consumer. No fabricated legacy lineage is inserted. Keep the schema, owner reads/deletion and maintenance on rollback; turn off new rescans/comparisons with the existing parent/rescan flags. Pending work retains Run 07 fencing and settlement.

## Verification

Node 22, PostgreSQL 17, production Next.js build and Chromium. Existing test coverage thresholds remain unchanged.

| Check | Result |
| --- | --- |
| Backend full suite | 1,161 passed / 95 files; 88.15% statements, 85.30% branches, 89.75% functions, 90.47% lines |
| Frontend full suite | 574 passed / 86 files; 82.78% statements, 74.90% branches, 78.29% functions, 83.58% lines |
| Shared contracts | 78 passed; build passed |
| Real PostgreSQL | 100 passed, including concurrent admission, one reservation, service-only privileges, revocation during reuse and deletion while queued |
| Real report browser workflow | 3 passed, including Run 13 single/multiple repositories and the new Run 14 rescan/comparison flow |
| Existing selection / route boundary regressions | 2 selection browser tests and 8 production-page HTTP checks passed |
| Builds / typecheck / lint | Backend and frontend builds passed; frontend typecheck passed; zero lint errors, one existing unused `vi` warning |

Two-commit histories exercise a meaningful test addition, deleted implementation, file rename, moved module, dependency-only addition, excluded path and no content change. Additional cases cover removed repositories, newly supported detectors, changed rubric/security policy, truncated scope, metadata permission/signal changes, ambiguous duplicate patterns and foreign report/selection IDs. Tests verify old report JSON remains stable, reuse avoids downloads/extraction, deltas separate strength from confidence, and source/fingerprint fields cannot leak into comparison responses. HTTP tests cover sessions, CSRF, admission allowlisting, disabled flags, closed errors and query bounds.

The browser test expires the access token immediately before a rapid double rescan. It moves the synthetic provider branch after admission while the worker is paused, then proves the resulting report retains the accepted SHA. It verifies unchanged behavior, baseline immutability, evidence drill-down, flags-off saved reads, foreign-owner comparisons, baseline deletion and workspace cleanup. Real GitHub/model transports are replaced only by explicit synthetic test adapters; report endpoints and ingestion/extraction/aggregation/validation/persistence are real. This does not establish live-provider behavior.

During regression verification the new export resources were added to the existing account-export test fixture. An existing cancellation fixture now checks an already-aborted signal after its asynchronous disk write, preventing a missed abort under coverage load. Assertions and timeouts were not weakened.

## Accessibility and visual verification

Native role/repository/change/capability controls have accessible labels. Results have textual summaries, including uncertainty, coverage and permissions. Evidence links open the proper immutable report and move focus to its explorer. Role preference and rescan failures retain the baseline; history has a reload action. Account changes clear private caches and ignore late mutation responses.

Chromium axe checks found zero violations in the comparison at 1280×1000 and 390×844, and mobile has no horizontal document overflow. Component axe checks cover separate deltas, unknown values and filtering. Existing report keyboard/contrast checks remain passing. This is automated accessibility and visual review, not a full assistive-technology certification.

Reviewed synthetic captures: role focus [desktop](../docs/benchmarks/run14-role-focus-desktop.png) / [mobile](../docs/benchmarks/run14-role-focus-mobile.png), comparison [desktop](../docs/benchmarks/run14-comparison-desktop.png) / [mobile](../docs/benchmarks/run14-comparison-mobile.png). Layout, labels, wrapping and navigation are readable. CI retains synthetic artifacts for seven days.

## Limits and next run

Comparison v1 is conservative. Repeated same-concept patterns or key rotation may remain uncertain; paths and line offsets alone are insufficient to claim a rename. Scope/version/access changes qualify the entire comparison. Unknown arithmetic remains null. Old analyzers are never rerun, and malformed/unavailable old versions fail closed while owner deletion remains available. Dates represent report/snapshot capture; no historical commit timestamp is invented. The UI leaves optional history/CI metadata off and explains that scope; the API accepts the existing bounded metadata options.

Live GitHub installation/archive checks, pinned-model access and success smoke, deployment supervision, detector/rubric calibration and Run 16 rollout review remain outstanding. Flags remain off by default. Runs 15–16 are not implemented by this run.

Run 15 can use report-member evidence IDs and lineage to display revised provenance on new analyses, while storing feedback separately from immutable observations. Preserve owner-pair checks, explicit unknowns, current permission fences, source-free comparison output and the independently versioned focus/comparison policies.
