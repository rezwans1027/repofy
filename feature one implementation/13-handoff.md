# Run 13 handoff — Private readiness reports and evidence

**Status: implemented and locally verified.** September 20, 2026. The private workflow now works with one and several authorized repositories against the real local API, worker and PostgreSQL. Deployment flags remain disabled by default. Live GitHub installation/archive checks, Run 12's pinned-model access/success check and Run 16 release calibration remain separate gates.

## Delivered

Owners can revisit saved reports, recover job progress, inspect every selected project's exact commit and achieved coverage, read capability assessments and all five role views, follow verified citations, filter evidence and review prioritized improvements. Strength, confidence, unknown weight and authorship uncertainty remain separate. Expandable calculation traces display the persisted Run 11 arithmetic; filtering never invents claims or recomputes scores. Improvements retain their rationale, future-proof labels, acceptance criteria, effort and ranking factors.

The evidence explorer includes all observations belonging to the run's exact snapshots. The report itself deliberately contains a smaller representative citation set. A multi-repository browser regression caught the distinction: duplicate support from the second repository must remain inspectable without raising its score. The reader now uses snapshot membership for evidence pages, locator requests and events, while category/capability/role filters use the frozen aggregation support. Unmapped observations state that no positive capability mapping was accepted.

Ordinary reads expose generic project labels and source-free observations, work without model/provider access, and do not generate or charge. Location inspection separately verifies current GitHub permission and repeats database membership/access checks before decrypting a retained locator. Public links target a validated exact commit; private locations have no external URL. Revocation and stricter current visibility dominate historical public labels. There is no raw-source refetch or unrestricted fallback.

Owner deletion uses the existing job fences/cascades and works even if an old report cannot parse. The UI confirms deletion, clears relevant queries and returns to history. Account export includes the source-free report, aggregation and safe audit receipts; account deletion removes owned data without deleting another owner's reports. Session changes cancel/remove cached private queries, and late location responses are ignored. Pages/API responses use private/no-store caching and generic noindex metadata.

## Routes and interfaces

The complete [route/API map and privacy decision](../docs/adr/0013-private-readiness-ui.md) records request bounds, access checks, telemetry, deletion and rollback.

| Area | Interface |
| --- | --- |
| Saved history / selection | `/readiness`, `/readiness/new` |
| Progress / history | `/readiness/jobs/:id`, `/readiness/jobs` |
| Completed report | `/readiness/reports/:id`; `/readiness/:id` redirects to it |
| Owner reads | `GET /api/v1/readiness-reports`, `/:id`, `/:id/view`, `/:id/evidence[/:evidenceId]`, `/:id/improvements/:improvementId` |
| Location / events / deletion | `POST /api/v1/readiness-reports/:id/evidence/:evidenceId/location`, `POST /:id/events`, `DELETE /:id` |
| Shared contracts | `packages/contracts/src/report-view.ts`: view/membership/math checks, bounded queries/pages, closed events/location states and exact-commit URL validation |
| Backend | `src/domain/readiness/{reader,runtime}.ts`, `src/routes/readiness.routes.ts` |
| Frontend | New readiness history/report/assessment/evidence/shared components; existing picker/progress integration |
| Migration | `20260920000600_readiness_readers.sql`; service-only readers, snapshot membership, narrow deletion and safe audit actions |
| Real browser harness | `repofy-backend/tests/e2e/readiness-server.ts`, `repofy-frontend/playwright.report.config.ts`, `e2e/readiness/private-report.spec.ts` |

## Verification

Node 22, PostgreSQL 17, production Next build and Chromium. Existing coverage thresholds remain unchanged.

| Check | Result |
| --- | --- |
| Backend full suite | 1,135 tests / 93 files; 87.72% statements, 85.08% branches, 89.40% functions, 90.24% lines |
| Frontend full suite | 567 tests / 85 files; 82.57% statements, 75.61% branches, 78.36% functions, 83.28% lines |
| Final focused readiness components | 32 passed, including report navigation, malformed payloads, unknown states, long labels, deletion and location races |
| Shared contracts | 76 passed; build passed |
| Real PostgreSQL | 97 passed, including service-only privileges, foreign-run evidence, uncited snapshot observations and deletion against an active validator on another connection |
| Real report browser workflow | 2 passed; one and several repositories through actual ingestion/extraction/aggregation/model adapter/validation/publication |
| Existing selection browser regression | 2 passed; selection/revocation and interrupted start/progress/reload/cancel/history |
| Route boundary HTTP regression | 8 passed; signed-out redirects, unavailable intake, invalid-ID not-found UI and private caching |
| Builds / typecheck / lint | Backend and frontend builds passed; frontend typecheck passed; zero lint errors and one pre-existing unused `vi` warning |
| Diff / artifacts | Whitespace clean; new source, migration and synthetic screenshots are not ignored |

The report browser tests exercise real session validation, expired-token refresh with a rapid double start, resumed progress, every selected repository's evidence, exact-commit links, public-to-private changes, revoked locations, cross-owner URL guesses, account switching, model-independent reads with intake disabled, active-job deletion and a stale worker heartbeat. They assert workspace cleanup and unchanged model-call counts on reads. A raw-source sentinel stays absent from rendered HTML and captured browser/server logs. Backend regression coverage retains explorer/advisor/auth/credit behavior; hosted-account E2E was not run.

## Accessibility and visual review

Keyboard evidence activation moves focus to the explorer heading and closing returns to the originating citation. The deletion dialog supports Escape and returns focus. Native filters/details have accessible names; each project's coverage landmark is distinct. Loading/results use status announcements, errors use alerts, and coverage/confidence/privacy states have text equivalents. Arbitrary narrative HTML is escaped. Axe reports zero violations within the rendered report (including evidence and contrast) at 1280×1000 and 390×844; mobile has no horizontal document overflow. This is automated coverage and visual review, not a complete assistive-technology certification.

Synthetic screenshots from the passing browser run were visually inspected for wrapping, navigation spacing and readable summary/card layout: [desktop](../docs/benchmarks/run13-summary-desktop.png), [mobile](../docs/benchmarks/run13-summary-mobile.png). The harness also generates full-page report/evidence captures in `test-results`; CI keeps synthetic artifacts for seven days. No real account or repository data is captured. With intake disabled, the screenshot's navigation hides its readiness entry while the already-open owner report remains readable.

## Error and recovery states

| Condition | User behavior |
| --- | --- |
| No saved reports / no matching observations | Explicit empty state; selection or filter reset; no missing-skill inference |
| Loading / temporarily unavailable / malformed response | Status or fixed error; retry; invalid/stale report data is hidden |
| Expired session / another owner's URL / deleted report | Shared session refresh or sign-in; generic unavailable result; no owner details disclosed |
| Invalid page UUID | Not-found UI; a streamed loading response can have HTTP 200, while owner API misses return 404 |
| Provider/model unavailable or intake disabled | Saved report/history/evidence remain readable; no generation on reads |
| Location permission revoked / provider unavailable / no retained file locator | Explicit closed state; reconnect/review selection or retry as appropriate; no source fallback |
| Interrupted active job | Saved stage/attempt, bounded server retry, reload recovery and cancellation; terminal jobs stop polling |
| Oversized or unsupported scope | Smaller repository or `.repofyignore` with recorded exclusions, supported scope, or support; no silently successful partial scan |
| Validation failure / uncertain paid model outcome | No unvalidated report; selection/support guidance; uncertain outcomes never automatically regenerate |
| Deletion failure | Confirmation stays recoverable, fixed error and retry; no false success |

## Migration, rollback and next run

Apply the new migration after Run 12, build contracts before installing the apps, and deploy backend/frontend together. No remote migration, deployment, customer billing change or flag activation was performed here. Existing indexes support bounded history/evidence queries; no new raw-source retention or math version is introduced. Keep the migration, owner reads/deletion and maintenance available on rollback; disable new intake through the existing flags and allowlist.

`readinessAvailability: available` now means the report UI exists when the parent flag is on. Admission still requires the actual workflow handlers, synthesis configuration and explicit owner allowlist. A live GitHub check, deployment-provider approval/configuration, pinned-model success smoke and Run 16 calibration/rollout review are still needed before external release. Defaults remain off.

Run 14 can extend the immutable report/run/snapshot/version chain for role focus and rescan comparisons. Preserve the full denominator, claim limitations, current access checks and report-specific evidence navigation. Runs 14–16 have not been implemented by this run. See [local verification setup](../repofy-frontend/e2e/README.md) and [operations](../docs/analysis-worker-operations.md).
