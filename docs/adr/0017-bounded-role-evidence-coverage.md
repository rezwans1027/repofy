# ADR 0017 — Provisional role evidence coverage

For new intake, [ADR 0019](0019-role-observations-and-excluded-scope.md) extends
this decision with role detectors and aggregation v3. The v2 policies below remain
frozen for existing reports and supported queued jobs.

September 26, 2026. Addresses the policy incompatibility in ANA-006/009 and the
September 26 PRD review. Extends ADR 0016 for new analyses; does not qualify a
calibrated readiness score or supersede the release HOLD.

## Decision

Register immutable `evidence_aggregation` versions `2.0.0` and `2.1.0`. The latter
adds the same separately frozen, non-scoring provenance context as `1.1.0`.
New intake selects v2; queued jobs retain their pinned supported version. Existing
reports and v1 calculations retain their original semantics and unavailable status.

Confidence in a supported static observation is distinct from the breadth of a
capability that the analyzer can assess. V2 permits a Moderate label only when:

- the chosen base is mapped implementation evidence, not presence or a mocked test;
- numerical confidence is at least 0.5, still capped by achieved coverage at 0.55;
- every selected snapshot has fully processed eligible scope with no excluded files;
- no invalid observations were excluded;
- recorded coverage reasons contain only the explicitly registered semantic limits:
  runtime not assessed, uncalibrated, unsupported depth/version, native-mobile or AI
  runtime not assessed, or no observation in another fully processed snapshot.

Parser failures, unresolved bindings, quarantine, missing files and exhausted
budgets still prevent Moderate. There is no High label. Strength arithmetic,
deduplication, coverage penalties, test independence, rubric weights, minima and
compound requirements are unchanged. SQL independently validates the label and
checks its scope reasons against immutable snapshot coverage before persistence.

The explicit v2 + detector `1.0.6` + extractor `1.0.1` + coverage `1.2.1` + initial
taxonomy/rubric combination projects `provisional / calibration_pending`. The UI
shows **Provisional role evidence coverage**, unknown requirement weight, evidence,
requirements and limitations. It never labels this combination calibrated or
`available`. Unknown or unsupported analyzer combinations remain unknown/unavailable.

`evidence-diff-1.0.4` exposes provisional values and compares them only when scope,
access and measurement versions are compatible and complete. Incomplete scopes and
cross-version comparisons withhold role deltas. Old comparisons remain readable.

## Acceptance boundary

Tests process invented implemented, weak and unsupported portfolios through real
ingestion, detectors, aggregation and rendering for all five roles. Independent
source tests can meet unchanged required recovery minima for Backend, Full-Stack
and AI Application and produce a rescan gain. Presence, missing corroboration and
unsupported compound capabilities cannot satisfy required criteria.

This is useful partial evidence coverage, not completion of every role rubric.
Frontend handler corroboration is outside the current direct-call test detector.
Mobile core capabilities remain unknown; the narrow button observation plus its
single permitted test bonus remains below the accessibility minimum. These limits
must not be bypassed by raising detector strength or lowering rubric thresholds.
Broader detector coverage and independent engineering calibration remain necessary
for a qualified readiness assessment across all five roles. Synthetic acceptance
tests do not replace representative portfolios or attributable human review.

Rollout flags, independent calibration, current-version claim review and all other
external release gates remain unchanged. Recorded release evidence for the old
implementation does not certify this new version.

## Deployment

Apply both September 26 migrations and build/install the shared contracts before
deploying compatible API, worker and frontend code. The new worker supports v1
and v2 queues. Drain v2 jobs before rolling a worker back to a v1-only build.
No existing snapshot, report, policy definition or rubric release is rewritten.
