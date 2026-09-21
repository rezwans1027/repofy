# Run 13 — Private readiness report and evidence drill-down

**Status:** Implemented and locally verified; see the [Run 13 handoff](13-handoff.md). Live-provider/deployment/calibration gates remain. **Depends on:** Runs 05, 07, and 11–12. **Requirements:** ANA-001–014, CORE-003–005, CONS-006; PRD sections 9.3, 9.8, 23.4, and 29.

## Outcome and scope

Deliver the complete private developer journey: select authorized repositories, run analysis, recover from failures, read a saved report, understand role coverage, inspect evidence, and act on improvements.

The existing GitHub explorer and advisor remain separate. Do not relabel the existing GitHub profile as a Verified Profile, or expose employer/public sharing controls that have no implemented consent model.

## Read first

- [App layout](<../repofy-frontend/src/app/(app)/layout.tsx>), [sidebar](../repofy-frontend/src/components/layout/app-sidebar.tsx), [route middleware](../repofy-frontend/src/middleware.ts), and [route constants](../repofy-frontend/src/lib/constants.ts).
- [API client](../repofy-frontend/src/lib/api-client.ts), [server fetching](../repofy-frontend/src/lib/server-api.ts), and [auth provider](../repofy-frontend/src/components/providers/auth-provider.tsx).
- [Legacy report UI](../repofy-frontend/src/components/report/analysis-report.tsx), [Evals placeholder](<../repofy-frontend/src/app/(app)/reports/page.tsx>), and Run 12's readiness DTO.

## Implementation sequence

1. Add authenticated readiness routes and navigation using the naming chosen in Run 01. A proposed set is /readiness for history, /readiness/new for selection, /readiness/jobs/[jobId] for progress, and /readiness/[reportId] for a completed result. Route guards and backend policies must both apply.
2. Implement owner-scoped API reads for report history, report detail, analysis-run metadata, evidence pages, and improvement details. Use bounded pagination/filter parameters. A proposed report resource is /api/v1/readiness-reports/:reportId; nested evidence queries must validate membership in that report.
3. Complete Run 05/07 integration for selection, real progress, retries, resumed sessions, missing permissions, and navigation to a completed report. Show stage-based progress honestly and stop polling at terminal states. Avoid exposing partial unvalidated narrative while a job is still running.
4. Build the analysis summary: repositories, exact commits, analyzed date, version metadata, supported language depth, excluded scope, and confidence/limitations. Multiple selected repositories must be represented individually rather than flattened into one generic score.
5. Build project evidence cards and a capability map grouped by the PRD categories. Display strength and confidence separately, with textual labels and drill-down actions. Empty/not-observed/not-assessable states must explain their different meanings.
6. Build all five role views showing weighted coverage, confidence, supporting capabilities, important gaps, contributing repositories, and the repository-evidence limitation statement. Do not display hire recommendations, candidate rankings, or uncalibrated seniority estimates.
7. Build prioritized improvement cards with rationale, expected evidence gained, acceptance criteria, effort, and permitted relevant locations. Expansion and filtering should not synthesize new claims in the browser. Emit safe improvement_opened events without including source or full text.
8. Implement evidence drill-down by repository, capability category, and role requirement. Show evidence source type, observation, why it supports the claim, detector/version, snapshot identity, confidence, and permitted locator metadata. Public links must target the exact commit and a validated GitHub location, not the current branch.
9. For private source, show the appropriate verified-private label and only owner-permitted details. Raw source is not retained by default; if locator resolution requires provider refetch, reauthorize and filter again. An access-revoked state must not trigger an unrestricted fallback. Current stricter privacy rules dominate an old snapshot's public label.
10. Clearly separate candidate-reported/unverified content if present in contracts, but do not invent a professional-claims input feature. Do not let a user edit a verified claim directly; finding feedback arrives in Run 15.
11. Add owner analysis deletion, account export/delete integration checks, and no-store/private caching. Deletion must cancel dependent active work and prevent a stale worker from republishing. Clear query caches on logout/user changes, and keep private names/details out of static metadata, Open Graph images, analytics, and error pages.
12. Complete keyboard navigation, focus management, screen-reader status announcements, contrast, mobile layout, and textual equivalents for charts. Add empty/error/loading boundaries and safe rendered narrative content without arbitrary HTML or unsafe external URLs.

## API and file boundaries

Use new readiness components/hooks and domain-specific backend readers rather than forcing new fields through the old report renderer or generic CRUD contract. Reuse visual primitives and request helpers. Extend API error-code handling compatibly and preserve auth-refresh/CSRF behavior.

Owner deletion is a narrow authenticated mutation; list/read requests should not trigger model calls or charges. The private report is immutable content plus separate access/deletion state. No public route, shared cache, profile-publish control, or employer-facing artifact is introduced.

## Acceptance criteria

The user can finish the full workflow with one and several authorized repositories. Every verified positive claim opens supporting evidence from its own report. All role and improvement fields specified by ANA-001–014 are accessible and understandable. Failure states offer the appropriate retry, reconnect, reduced-scan, or support action. Private results remain owner-only and readable when the model provider is unavailable.

## Verification

Write meaningful component tests for evidence navigation, separate confidence/strength, unknown coverage, long labels, malformed API responses, and errors. Run keyboard and accessibility checks. Add a real local API/worker/DB E2E using a synthetic GitHub/model adapter rather than mocking the entire report endpoint.

Exercise cross-user URL guessing, evidence IDs outside the report, account switching, private metadata leaks, source sentinels in rendered markup/logs, revoked refetch, double-start after token refresh, and deletion during an active job. Confirm existing explorer/advisor/credit flows still function after shared-client/layout changes.

## Migration, rollout, and handoff

Any read indexes or deletion fields require additive migrations. Roll out to an internal allowlist with all workflow handlers enabled and tested. A UI rollback hides intake but preserves access to already completed reports according to policy. Do not route readiness data through legacy score-based PDF output.

Hand off the route/API map, accessibility evidence, E2E fixtures, error-state matrix, deletion/export behavior, and screenshots/manual review notes captured with synthetic data. Runs 14–15 extend this completed private flow.
