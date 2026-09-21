# ADR 0013 — Private readiness reads and evidence locations

Date: 2026-09-20. Scope: Run 13, ANA-001–014, CORE-003–005, CONS-006.

## Decision

Expose completed, validated reports through a dedicated owner reader and readiness UI. Preserve the existing explorer, advisor, credits and Evals routes. No public report, hiring recommendation, profile publication, professional-claims editor or legacy PDF integration is introduced.

Saved reads do not construct the worker, contact the model, reserve budget or check the intake flag. `readinessAvailability: available` means the saved-report UI is implemented when the parent feature is enabled. Starting analysis still requires both intake flags, complete production handlers and the explicit owner allowlist. Defaults remain disabled. `/readiness` and completed-report URLs remain usable during an intake rollback.

The report payload and Run 11 calculations remain immutable. The read projection removes retained display locations, assigns distinct generic repository labels, and applies the stricter of snapshot and current repository visibility; revoked access is treated privately. Each project retains its own exact commit, capture time, achieved language/source coverage, exclusions and supporting capability mappings. Calculation traces and report metrics must agree at the shared runtime boundary. Unknown scope is never converted to observed weakness or a numeric zero.

The view includes the taxonomy and role labels pinned by its run, rather than the currently active rubric. All five role views expose weighted coverage, independent confidence, unknown weight, supporting capabilities, important gaps, contributing repositories and individual requirements. Improvements retain their server order and show future proof, acceptance criteria, effort and ranking factors. Local filtering does not calculate new claims or reprioritize content.

## Routes and membership

| Interface | Behavior |
| --- | --- |
| `/readiness` | Paginated saved history; links to selection and job history |
| `/readiness/new` | Existing authorized selection and idempotent start |
| `/readiness/jobs`, `/readiness/jobs/:id` | Resumable stage progress, bounded retry/cancel, deletion and completed-report navigation |
| `/readiness/reports/:id` | Completed report; `/readiness/:id` redirects here |
| `GET /api/v1/readiness-reports` | Owner history, `limit` 1–50 and owner-bound `afterReportId` cursor |
| `GET /api/v1/readiness-reports/:id` | Compatible report DTO with current privacy projection |
| `GET /api/v1/readiness-reports/:id/view` | Report, immutable aggregation, pinned definitions and separate current access state |
| `GET /api/v1/readiness-reports/:id/evidence[/:evidenceId]` | Run-bound evidence; limit 1–100; repository/category/capability/role/requirement filters and evidence cursor |
| `POST /api/v1/readiness-reports/:id/evidence/:evidenceId/location` | Fresh permission verification and permitted retained locator, never raw source |
| `GET /api/v1/readiness-reports/:id/improvements/:improvementId` | Only a member improvement from this report |
| `POST /api/v1/readiness-reports/:id/events` | Closed `report_viewed`, `evidence_opened`, `improvement_opened` events |
| `DELETE /api/v1/readiness-reports/:id` | Narrow owner deletion using existing job cancellation/cascade fences |

Every endpoint uses a revalidated account session. The actor never comes from browser JSON. PostgreSQL independently enforces report/run/snapshot/evidence membership, including foreign cursors and IDs. RPCs are service-only; browser roles cannot invoke them with a chosen actor. Authenticated mutations preserve the shared CSRF and token-refresh behavior. Reading an evidence ID does not authorize evidence from another run, even if both belong to the same account.

Explorer membership follows every exact snapshot attached to the owned run. The report's bounded representative citations are intentionally a subset: repeated observations in another repository must remain inspectable even when they do not raise strength. Unmapped observations explicitly show no accepted positive capability mapping. Category, capability and role filters use the immutable aggregation support; no additional observation changes report calculations or validated claims.

## Location disclosure

Ordinary views and evidence pages contain no source paths or repository names. An explicit location action first resolves the encrypted locator through owner/report membership and an active selected grant. It then verifies the current user, installation, repository identity and pull permission through the existing GitHub App service, and repeats the database check to fence deletion or revocation during verification.

Only after both checks does the server decrypt the minimal retained locator. Private locations have no external URL. Public links use a validated `https://github.com/{owner}/{repo}/blob/{exact-40-character-commit}/{encoded-path}` with optional line anchors. The shared contract rejects other hosts, schemes, branch heads, traversal, query strings and mismatched commits. A newly private provider response also suppresses the public link. Provider metadata without a retained file location explicitly remains unavailable.

There is no source refetch endpoint and no branch-head or unauthenticated fallback. Missing keys, provider failures and invalid locator data yield fixed states without logging the exception or contents. Truly revoked grants remain revoked; a newly authorized selection and analysis establish a new access chain. Credential reconnection can restore location checks for an otherwise active grant.

## Caching, telemetry and deletion

Readiness pages and API responses use private/no-store caching; metadata is static and generic with noindex/nofollow/noarchive. Queries include the owner ID, have zero stale/retention time, and are canceled and removed on owner unmount; the shared provider also clears caches on logout/account changes. Failed revalidation hides stale report data. Permitted locations are component-local, cleared on blur/visibility changes, and late responses are discarded. React renders all narrative as text.

Existing telemetry filters exclude readiness requests/screens. Safe events contain only a closed event and membership-checked opaque ID. The audit receipt stores the owner/report/job reference and action, with empty metadata; repeat opens of the same action/job within one minute are coalesced. No observation, name, path, URL, source or full improvement text is an event field. Existing 90-day audit retention and account-deletion cascades apply.

Report deletion resolves the owned job in SQL without requiring the old report to parse. Existing Run 07 deletion removes dependent runs/drafts/citations, fences active workers and prunes unreferenced canonical evidence; shared references belonging to other analyses survive. The separate anonymous model budget reservation retains Run 12's 30-day policy. Account export continues through export v6, including source-free reports, calculations and safe audit receipts; account deletion cascades the graph. Private raw workspace cleanup continues through worker disposal and independent maintenance.

## Accessibility and verification boundary

Native links, buttons, selects, details and the existing Radix dialog supply keyboard behavior. Evidence navigation focuses its heading and returns to the originating control. Progress/loading/results use status announcements, errors use alerts, and strength/privacy/unknown states have text. Every project coverage landmark has a distinct name. Mobile content wraps and tables have textual mobile equivalents.

The local browser harness uses a production Next build, real Express routes, PostgreSQL 17, and the actual ingestion/extraction/aggregation/model-adapter/validation/publication worker. Only identity, GitHub and model transports are synthetic. It does not load application secrets or mock completed report endpoints. It exercises one and several repositories, refresh replay, membership, current privacy, revoked locations, provider-independent reads, account switching, deletion, keyboard focus, axe checks and source sentinels. This is not a live GitHub/OpenAI verification or a complete assistive-technology audit. See the Run 13 handoff for measured results and screenshots.

## Migration and rollback

Apply `20260920000600_readiness_readers.sql` after the Run 12 synthesis migration, then deploy contracts/backend/frontend together. It adds readers and narrow mutations plus safe audit action values; existing owner-created indexes serve history pagination. It does not change evidence math, rewrite reports or add raw source retention. Keep the migration on UI rollback. Hide new intake with existing flags while preserving completed-read/delete APIs and maintenance. Live GitHub setup, pinned-model access, deployment and Run 16 calibration/rollout gates still apply.
