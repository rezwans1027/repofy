# ADR 0014 — Separate role preferences, immutable rescans and evidence comparisons

Accepted for the internal Feature 1 implementation, September 20, 2026. [Run 14 scope](../../feature%20one%20implementation/14-role-focus-and-rescan-comparisons.md). Defaults remain disabled; this decision does not approve external rollout.

## Role focus

`recorded-role-order-1.0.0` orders existing validated data. Capabilities are ordered by the sum of their weights in the selected recorded rubric; ties preserve report order. Relevant improvements come first while retaining their existing relative priority. The selected role appears first; its gaps use recorded impact, required status and requirement ID. All five roles remain available. No metrics, wording, evidence, rubric versions, proposal priorities or original JSON are rewritten.

The owner preference is a separate `feature_one_private.report_preferences` row, keyed to the report and cascading on report/account deletion. `null` means all roles. SQL checks that a selected role/version belongs to the report's recorded run. Loading or saving focus makes no provider/model call and has no charge. A future view that generates new content must be an explicit versioned operation.

## Admission, immutable inputs and billing

A rescan has an owner, baseline report, explicit repository set, metadata options and idempotency key. Both preflight and the admission transaction check ownership, saved active selections, grants/revisions, attestation and repository limits. The server supplies the pinned execution policy. Live resolution checks provider repository identity and current visibility; each call has a 15-second deadline and the set is bounded at ten repositories (deployment default: five). Branch names remain encrypted.

The admission transaction serializes on the existing owner lock and pins the entire verified SHA set with the new Run 07 job. Later branch movement cannot change those accepted inputs. A changed selection, new commit or changed relevant policy creates a new analysis/report. The baseline's payload stays immutable. A baseline must belong to the requester; another owner's ID is indistinguishable from a missing report.

The canonical request hash includes baseline, sorted repository IDs and metadata options. Policy is server-owned and is deliberately absent from this replay hash: a retry returns the original receipt/job even if a deployment changes while the response is in flight. A reused key with changed inputs fails with `IDEMPOTENCY_CONFLICT`. Deleted baselines/jobs return unavailable; their receipts never reconstruct deleted results. The client retains a pending key across uncertain network errors/remounts/refresh replay and scopes it to owner, baseline, saved-selection revision and selected IDs. Rapid duplicate clicks share the pending request.

Only `internal_free_v1` is accepted. A queued rescan uses Run 07's zero-unit reservation/settlement; existing advice and customer wallets are unchanged. An unchanged request saves a lineage receipt and safe events but creates no job, reservation, archive download, extraction or model invocation. It requires identical execution policy, selected repository/grant/SHA/visibility set, metadata disabled, and no old job-level target-role input. Optional metadata can change independently of a commit, so metadata-enabled requests are never declared unchanged.

## Authorized source reuse

For an admitted job, the worker may reuse a sealed snapshot from its baseline only when repository, grant, commit, visibility, security hash, identity version, extractor, detector and coverage versions match, with metadata disabled on both sides. It repeats live provider authorization before attachment. The database repeats the normal job/lease/access-revision fence when attaching the snapshot; a grant revoked during this interval blocks the hit. Canonical outputs remain attached to permitted job/run membership.

A role rubric, aggregation or narrative change may reuse compatible source observations and run the new assessment/synthesis stages. Security/extractor/detector/coverage changes invalidate source-stage reuse. Existing stage outputs on retries retain Run 07 semantics. No cache hit fetches an unauthorized baseline or revives deleted reports. Baseline deletion while a new job is queued removes its reuse candidate; the independently authorized new job may continue from its already-pinned inputs.

## Comparison algorithm

`evidence-diff-1.0.0` is a deterministic read of two saved reports owned by the same requester. It performs no source download, locator decryption, model call or old-version execution. It uses every observation in each run's snapshot membership, not only the smaller narrative citation set. It rejects foreign or duplicate fact membership and caps each side at 20,000 observations. Each result page has at most 100 rows; filters affect the list, while counts describe both complete reports.

Matching proceeds within repository and normalized concept (detector family, source type, observation kind and claim/test boundary):

1. An identical persisted evidence ID is a match.
2. A unique keyed content fingerprint plus concept matches across paths, preserving renames/moves.
3. A unique keyed path fingerprint plus concept can match a changed file at the same permitted locator.
4. Remaining concepts present on both sides are uncertain, including many-to-many/ambiguous patterns. They are not counted as gained or lost. A concept present only on one side is lost/gained.

Opaque IDs for snapshot symbols, source offsets, provider retrieval time and narrative prose do not define meaning. Meaning includes detector versions, capability mappings, strength/confidence, structural counts/technology/provider facts and implementation relationship boundaries. A matched observation is changed if content/meaning changes; unchanged content at a different known path is relocated. Pure line/wording shifts do not automatically become evidence improvement. Key-version rotation or missing relationships can reduce matching to uncertainty; no fallback decrypts or guesses source names. Content/path HMACs never leave the backend. Path matching is withheld when current access is revoked.

Capability strength, confidence and assessability changes are separate. Unknown measurements yield null numeric deltas, never zero. The capability assessed fraction uses the minimum recorded snapshot fraction, consistent with the existing capability confidence policy; role coverage and unknown weight are taken from each frozen role calculation. All five roles retain their own recorded denominators. No candidate ranking or personal skill score is introduced.

Causes distinguish commit changes, repository addition/removal, security/scope/extractor/detector/coverage/rubric/aggregation changes, narrative policy and permission availability. Exclusions, parser limits, truncation and metadata availability qualify interpretation. A changed metadata signal is a scope change; `metadata_permission_changed` additionally requires a changed permission-denied state. Any access/scope/measurement change conservatively qualifies all rows and numeric deltas. Narrative policy alone does not imply evidence gained. Saved report and snapshot capture times are displayed with exact SHAs; historical commit authored/committed timestamps were not retained and are not fabricated.

## API, privacy and lifecycle

All paths below are relative to `/api/v1/readiness-reports/:reportId` and require a verified connection session. Mutations use the existing CSRF boundary. Responses use private/no-store and fixed errors; operation tracing is suppressed. Closed audit actions are `rescan_started`, `rescan_completed` and `comparison_viewed`, with no repository names, paths, source, prose or fingerprints. Comparison views coalesce within one minute per target job.

| Method/path | Contract and behavior |
| --- | --- |
| `GET /focus`, `PUT /focus` | Recorded role/version preference and deterministic ordering |
| `GET /rescans/availability` | Actor-specific admission availability, no report data |
| `POST /rescans` | Explicit selected IDs/options/key; unchanged 200 or normal queued job 202 |
| `GET /rescans` | Parent available/none/unavailable plus keyset history; default 20, maximum 50 |
| `GET /comparisons?targetReportId=…` | Both endpoints owner checked; optional repository/change/capability filters, offset/limit |

Frontend comparison route: `/readiness/reports/:baselineId/compare/:targetId`. Both sides link to their immutable report; `?evidence=:id` opens report-member evidence through the existing private explorer. A location still requires Run 13's separate current provider/DB permission checks. Role/history/comparison queries include the owner in their cache keys. Session changes cancel/remove private queries, and late mutations do not restore old account data or navigate from an unmounted report. Generic metadata and noindex policy apply to the comparison route.

`report_rescans` records only relationships created by explicit rescans; legacy relationships are not backfilled. Deleting a baseline sets its child's parent reference to null and comparison returns generic 404. A saved target survives. Deleting a target job leaves a deleted history receipt without its report/job reference. Deleting an account cascades preferences and lineage. Export v7 includes both resources without replay keys/hashes. These are private RLS tables with no direct browser/service-role grants; only service RPCs can access them.

## Migration and rollback

Apply `20260920000700_rescans_and_comparisons.sql` after Run 13 before deploying export v7 or the new worker/API. Build contracts before installing both applications. `RESCANS_ENABLED` and the parent feature flag control new rescans/comparisons; admission also requires the existing repository/analysis configuration, synthesis policy and owner allowlist. Keep focus/history/saved reads/deletion, pending-job settlement and maintenance available during rollback. Keep the additive migration and never rewrite old reports to match new policies. Default flags and existing live-provider, pinned-model and calibration gates remain unchanged.

See [Run 14 verification and handoff](../../feature%20one%20implementation/14-handoff.md) for measured local results and remaining release gates.
