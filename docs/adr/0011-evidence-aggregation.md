# ADR 0011 — Deterministic evidence aggregation and role coverage

Accepted 2026-09-20 for Run 11. The required four-example human review is recorded
in [the benchmark review](../benchmarks/run11-human-review.md). It is not precision
or rubric calibration. Production analysis still awaits Run 12 synthesis and
validation and the later rollout gates.

## Immutable dependencies and input

`evidence_aggregation@1.0.0` consumes the initial `readiness_1_0_0` catalog, all
selected sealed snapshots, their Run 10 achieved coverage, and source-free evidence.
It accepts only the registered initial taxonomy/rubric definitions. A new catalog
or formula needs a new aggregation policy and new run; the active discovery
release never rewrites frozen calculations. The policy definition is seeded in a
private immutable database registry and checked for exact parity in integration tests.

Each input is tied to run, job, owner, repository, SHA, visibility, extractor,
detector, coverage and taxonomy versions. Detector scores cannot exceed their
registered ceilings. Quarantined, malformed, foreign, conflicting-ID or unmapped
observations are excluded with counted closed validation codes. No rejected IDs,
paths, prose or exception messages appear in the result. Identical duplicate IDs
are collapsed. A rejected observation makes unsupported absence conclusions
unknown; it does not erase other valid positive evidence.

The worker reads canonical facts using a live lease/access fence, recomputes the
result, checkpoints, and writes using the same fence. The backend never accepts
caller-supplied scores. SQL independently checks run/version/evidence membership,
coverage counters/fractions, base scores, test relationships, strength/confidence
arithmetic, and the ALL/minimum role requirements. Composite foreign keys bind
support rows to the run, snapshot, repository and taxonomy. Owner reads take the
authenticated actor supplied by the backend; browser roles have no table/RPC access.

## Clusters, source boundaries and strength

Within a repository, related implementation observations are unioned by concept,
AST-shape key, exact normalized span, and keyed content. Detector family is TS/JS
implementation or the structural kind, with presence and implementation separated.
These keys are conservative grouping aids, not authorship or semantic equivalence
proof. Related summaries and multiple passes cannot add numeric credit: every
cluster uses one strongest base and the final capability uses the maximum cluster.
Ties use frozen opaque keys for deterministic selection. No source is reloaded or
executed during aggregation.

Structural mappings are explicit: language/source structure, recognized framework
declarations, schema structure, workflow/container declarations, documentation
structure, and bounded history. Their original evidence `capabilityIds` remain
unchanged. Aggregation support records store the derived mappings and actual
source boundary. Documentation headings alone have no verified behavioral claim
scope. Dependency presence never satisfies implementation requirements. Mocked
assertions are presence evidence, capped below implementation thresholds.

For each cluster:

```
strength = round6(min(ceiling, strongest_base + independent_family_bonuses))
ceiling = .39 for presence; otherwise 1
family bonuses = .10, .05, .025, .0125 in descending rank
```

Presence receives no bonus. **Only the test family is enabled in this version**, so
the maximum applied bonus is .10. The other diminishing slots are reserved by the
policy; enabling new relations/families requires another policy version. The test
must be non-mocked, in another file in the same snapshot, and explicitly assert a
call to the cited implementation's file, concept and symbol. Only one test-family
bonus is counted regardless of test count. Linked test source does not prove the
test ran, passed, or covered every branch. Config/docs/provider records currently
lack comparable behavior-specific links and add no corroboration credit. Conflicting
exact-commit provider results are disclosed without selecting a favorable result.

Across repositories, **maximum cluster strength, no additional bonus or pooled
implementation independence**. Repository-scoped HMACs cannot prove independence
of copies across repositories; even distinct repositories do not increase strength
by count. Additional references remain inspectable. This sacrifices cross-project
breadth credit until a richer independently validated policy exists.

The fixed PRD bands are [0,.2) Not observed, [.2,.4) Limited, [.4,.65) Moderate,
[.65,.85) Strong, [.85,1] Very strong. Current detectors reach at most .65 after the
linked-test bonus. Very strong is represented and boundary-tested, but is not
manufactured from the current detectors. Unknown has no numeric strength or band.

## Confidence and provenance

Confidence is a conservative index, **not a calibrated probability**:

```
snapshot_fraction = analyzed_relevant_files / (eligible_relevant_files + excluded_files)
                    or 1 for assessed metadata-only scope, otherwise 0
coverage_fraction = min(snapshot_fraction over every selected snapshot)
coverage_factor = round6(.5 + .5 * coverage_fraction)
confidence = round6(min(winning_snapshot_coverage_ceiling,
                       minimum_used_detector_confidence * coverage_factor + support_bonus))
support_bonus = .05 for a linked independent test; otherwise 0
```

Detector reliability is the minimum across the selected base and its accepted test, so a low-reliability test cannot manufacture confidence. A corroborating test must link to the chosen base itself; another same-shape cluster member is insufficient. Among equal strongest bases, linked support wins the tie.

The minimum over snapshots prevents adding a copied, well-covered repository from
raising confidence. This is deliberately conservative for heterogeneous selections.
All excluded files remain in each relevant denominator because their languages and
capabilities were not inspected. Exact ratios are rounded to six decimal places
before the next displayed calculation so the trace reconstructs the result.
For scoped absence, the maximum available coverage ceiling replaces base reliability;
the same minimum coverage factor applies. This is confidence in bounded observation,
not confidence in a candidate's lack of skill.

A result is Moderate only if every selected capability scope is fully assessable,
every fraction is 1, and confidence is at least .5; otherwise it is Low. Current
behavioral scopes are partial, so their confidence label stays Low even at .55.
High is reserved for future benchmarked policies. The immutable Run 03 catalog's
`numericCalibration: deferred_to_run_11` remains historical; this policy supplies
the numerical index without claiming calibration.

Contribution input is already typed on each evidence item. Output explicitly says
`{state: unknown, value: null, policy: not_inferred_v1}` and records
`provenanceMultiplier: null`. Unknown contribution is neither a zero nor a fabricated
one. V1 applies no numeric authorship adjustment; supplied assessed contribution
is marked `provenance_not_applied`. Run 15 must provide validated observations and a
new policy before contribution can affect these results.

## Role calculations and gaps

Every role uses the complete detailed Run 03 manifest, including every compound
component, confidence minimum and independent-cluster minimum:

1. Any unknown component makes a requirement unknown.
2. Otherwise take the minimum component strength and confidence; presence is capped
   at .39. Check minimum strength, confidence, implementation and corroboration.
3. Satisfaction is the minimum strength **only when all minima pass**; otherwise 0.
4. Contribution is `round6(weight × satisfaction)`. Coverage is the sum of those
   contributions divided by **all requirement weights**, rounded to six decimals.

This is a threshold-gated continuous index. A satisfied .55-strength requirement
contributes 55% of its weight, not 100%. Required/preferred status is retained,
required failures remain explicit, and no employment pass/fail rule is invented.
Confidence is separately weighted over the full denominator, with unknown scope
contributing no known confidence; an entirely unknown role has null coverage and
null confidence instead of numeric zero.

`unknownWeight` is the weight of unknown compound requirements divided by the full
weight. `assessableFraction` uses each component's mean snapshot processing fraction,
takes the minimum across the requirement's components, then weights over the full
rubric. It measures processing completeness; it is not a claim of semantic depth.
Actual partial states, unsupported depths, parser failures, budgets and exclusions
remain in the coverage trace. Removing a processed file into excluded/unparsed
scope cannot improve that processing fraction or reduce the rubric denominator.

All roles include strongest supporting capabilities, ranked gaps and leading
repositories. Gap impact is `weight × (1 - satisfaction) / denominator`. Unknown
scope, assessed-but-not-observed scope and insufficient evidence are distinct;
none asserts that the person lacks a technology or skill. There are no invented
negative evidence IDs. Qualified requirement credit is split equally among its
component winners for repository attribution; rounding can differ by a few millionths.
Supporting repositories with zero qualified credit remain visible as context.

## Persistence, queries, limits and rollback

The additive root migration `20260920000400_evidence_aggregation.sql` adds policy,
result and relational support tables. Results are immutable, canonically idempotent,
owner-only and cascaded on analysis/account deletion. Export v6 includes source-free
aggregation records. Read/query services support UUID-keyset pagination (1–100),
repository, category and role/requirement filters. They return actual evidence with
separate derived capability memberships, never private locator ciphertext, content
fingerprints, source excerpts or guessed paths.

Input/output JSON is limited to 32 MiB, ten snapshots and 20,000 evidence items.
Overflow fails the stage instead of silently dropping a repository. Verification
runs maximum-cardinality duplicate evidence in a 384 MiB heap under a 30-second
watchdog, and replays the frozen benchmark input/result. This is a synthetic load
check, not a production throughput or database-latency guarantee.

Rollback means keep the production handler registry gated and select a previous
supported policy for **future jobs**; retain all versions and existing outputs.
The first policy has no older production aggregation to roll back to. Do not edit
completed runs or downgrade their pinned dependencies. `productionAggregation()`
is ready for Run 12 composition; `productionHandlers` remains null.

Run 12 must consume these values/scopes, never ask a model to calculate them. The
legacy report finalizer still expects original `capability_evidence` mappings;
Run 12 must bind deterministic aggregation support (including derived presence
mappings) and its claim boundaries when publishing, without mutating evidence.
Aggregation records are not published readiness reports. Run 13 supplies the
presentation and evidence navigation; no new report UI is claimed here.
