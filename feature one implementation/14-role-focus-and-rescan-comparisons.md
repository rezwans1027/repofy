# Run 14 — Target-role focus and immutable rescan comparisons

**Status:** Implemented and locally verified; see [Run 14 handoff](14-handoff.md). **Depends on:** Runs 07 and 11–13. **Requirements:** ANA-015–016; PRD sections 9.6–9.8, 15.5, and 23.6.

## Outcome and scope

An engineer can focus a report on a chosen role, rescan changed repositories, and inspect evidence gained, lost, or changed while older reports remain intact. The comparison explains when differences result from analyzer/rubric changes rather than code changes.

This is a longitudinal comparison of one user's project evidence. It is not the legacy side-by-side candidate comparison or a ranking feature.

## Read first

Read Run 07 idempotency/cache identities, Run 11 deterministic assessments, Run 13 report readers/UI, and [the old Compare placeholder](<../repofy-frontend/src/app/(app)/compare/page.tsx>) to avoid unintentionally reviving the excluded candidate-comparison direction.

## Implementation sequence

1. Implement an authenticated target-role selector using the five recorded rubric versions. Reorder capabilities, gaps, and improvements using existing validated data and deterministic ranking. Persist a user preference separately from immutable report content.
2. If changing role requires new content rather than reordering, create a separately versioned derived view or new report through an explicit operation. Never silently mutate the original report or charge for an ordinary role-tab change.
3. Add a rescan action with a clear baseline report and selected repository set. Revalidate active repository grants, limits, feature flags, and entitlement policy. Resolve the new SHA set and return a normal Run 07 job; preserve the baseline reference and idempotency behavior.
4. Reuse unchanged authorized snapshot evidence when extractor/security/coverage versions match. If nothing relevant changed, return an understandable unchanged result or the existing analysis under the documented cache/billing policy. A changed rubric may recompute assessments without source re-extraction; a changed security policy may invalidate source-stage reuse.
5. Define report lineage and comparison compatibility. Distinguish changed code, repository added/removed, changed analysis scope/limits, detector version, rubric version, model phrasing, and permission availability. These causes affect what improvement can be claimed.
6. Implement stable evidence matching using repository identity, detector family, normalized concept, source fingerprints, and safe locator relationships. Renaming a file should not automatically report every capability lost and regained. Ambiguous matches remain explicitly uncertain; line offsets alone are not sufficient identity.
7. Compute gained/lost/changed evidence and capability/role deltas. Separate increased strength, changed confidence, and changed assessability. A source finding removed because it was newly excluded is not necessarily a developer regression.
8. Keep pure narrative wording differences out of evidence-improvement metrics. Show an interpretation note when analyzer/rubric changes prevent an apples-to-apples comparison. Do not invent prior source access to recompute a baseline the user no longer authorizes.
9. Build rescan history and before/after views with commit dates/SHAs, analysis versions, filters, and accessible text summaries. Link each side to its immutable report and evidence. Restrict every baseline/target pair to authorized owner access.
10. Document how baseline deletion, grant revocation, or unavailable old versions affect comparison. Report deleted/unavailable state without revealing private data. Do not reconstruct deleted reports from caches for convenience.

## Data and API impact

Add analysis lineage and optionally versioned comparison records or deterministic comparison caches. Example endpoints are POST /api/v1/readiness-reports/:reportId/rescans and GET /api/v1/readiness-reports/:reportId/comparisons with an authorized target report reference. A role-focus preference is a separate owner-scoped resource if it needs persistence.

Keep cache keys user/permission scoped where responses contain private data. For content-addressed canonical observations, require a current permitted run membership before any cache hit is exposed. Track safe rescan_started, rescan_completed, and comparison_viewed events.

## Acceptance criteria

- Role selection changes relevance/order without rewriting the original analysis or creating an unexpected charge.
- A new commit yields a new immutable analysis/report; the baseline content remains byte-for-byte stable apart from permitted separate access state.
- Unchanged snapshots are not needlessly re-fetched/reanalyzed under compatible policies.
- Comparisons identify evidence changes and distinguish analyzer/scope changes from code changes.
- Another user's report cannot be supplied as either comparison endpoint.
- Revocation/deletion behavior is explicit and does not revive inaccessible source/results.

## Verification

Use two-commit fixture histories: meaningful test addition, deleted implementation, file rename, moved module, dependency-only addition, and no content change. Add scenarios for changed role rubric, newly supported detector, excluded path, removed repository, truncated scan, lost metadata permission, and baseline deletion.

Check old report immutability after rescan and preference changes. Test repeated rescan requests, billing/caching outcomes, auth-refresh replay, and evidence matching ambiguity. Include E2E from report to rescan to comparison with a synthetic provider whose branch moves between calls.

## Migration, rollout, and handoff

Add lineage/preferences without backfilling fabricated relationships for legacy reports. Version the comparison algorithm and preserve recorded limitations. Disable new rescans/comparisons with flags if necessary; existing reports remain readable and pending jobs continue to settle/clean up safely.

Hand off lineage contracts, matching rules, comparison limitations, immutable-history tests, and the effective charge/cache policy. Run 15 can display changed provenance on new analyses without modifying prior results.
