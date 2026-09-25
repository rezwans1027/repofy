# ADR 0016 — Explicit limits on role readiness

September 25, 2026. Implements the safe presentation boundary identified in the
[PRD progress review](../reviews/2026-09-25-prd-progress-review.md). Numerical role
readiness remains a product acceptance gap; this change does not establish calibration.

## Decision

The registered `evidence_aggregation` policies `1.0.0` and `1.1.0` cannot give
behavioral evidence a Moderate confidence label with the current achieved-coverage
policy. Every required requirement in the initial role rubrics needs Moderate
confidence. Consequently, near-zero rubric calculations cannot serve as meaningful
role readiness scores. Increasing confidence or lowering rubric thresholds without
evidence would conceal this limitation.

Add a read-time `roleAvailability` projection to the private report view, separate
from the immutable report and aggregation. The shared contract derives one status
per role from its recorded policy and assessment state:

- `unavailable / required_confidence_unattainable` for computed results under the
  registered limited policies and initial taxonomy/rubrics;
- `unknown / insufficient_coverage` for entirely unassessable roles;
- `unavailable / policy_not_qualified` for other, unqualified policies.

No current policy produces `available`. That contract state is reserved for a
future explicitly qualified policy. Arbitrary new versions do not enable scores.
The view validator checks statuses against the recorded dependencies. Older API
responses may omit the projection; the frontend derives the same status locally.

The headline displays Unavailable or Unknown with an explanation. Original
coverage and confidence remain inspectable under **Recorded rubric calculation**,
clearly identified as limited policy values. Capability evidence, scope, requirement
thresholds, and unknown weight remain inspectable. Saved report JSON, numerical
confidence, aggregation policy versions, and rubric definitions are unchanged.
Clients presenting readiness should consume the report view; the underlying report
and account export retain the original calculation for audit.

`evidence-diff-1.0.3` also withholds role coverage/confidence values and deltas when
either assessment is unavailable or unknown. Evidence matching and capability
comparisons retain their existing semantics. Comparison notes explain the limit
and link users to the recorded reports. No stored comparisons are rewritten.

## Acceptance and future work

The regression uses all 16 positive implementation examples through real ingestion,
extraction, aggregation, synthesis rendering and owner projection. It demonstrates
that positive capability evidence can coexist with unavailable role readiness;
neither empty evidence nor mocked Moderate confidence supplies the expected result.
Contract tests reject fabricated availability. UI tests check hidden-but-inspectable
calculations, and comparison tests ensure a numerical change cannot manufacture a
readiness gain under an unqualified policy.

To enable a readiness score, jointly qualify detector claim reliability, achieved
scope, confidence policy and attainable required rubric requirements against
representative positive/negative repositories. Publish new immutable policy versions
and add a real detector-to-rubric acceptance case that satisfies a required
requirement. Calibrate with attributable independent review before registering the
policy as available. Existing human review, external release gates and rollout HOLD
remain in effect.
