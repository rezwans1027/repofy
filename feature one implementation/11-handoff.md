# Run 11 handoff — Aggregation, confidence and role matching

**Status: complete for the scoped implementation.** September 20,
2026. The required human calculation review is complete: one reviewer agreed with
all four calculations and interpretations (4 agreements, 0 disagreements, 0
uncertain). [Review record](../docs/benchmarks/run11-human-review.md). No remote
migration or production flag was changed.

## Delivered

ANA-006–010 and ANA-013 foundations now have a deterministic service for all 34
capabilities and five role templates. `evidence_aggregation@1.0.0` validates frozen
membership/versions, excludes invalid findings with safe reason counts, groups
related observations, bounds independent test corroboration, and calculates
strength and confidence separately. Unknown contribution stays typed and null.

Role matching uses the full detailed Run 03 requirements, compound ALL/minimum
rules and independent-evidence minima. Unknown weight remains in the full rubric
denominator. Each role includes processing assessability, confidence, strongest
support, ranked scoped gaps and repository attribution. The output is selected
repository evidence coverage, not an employment probability or candidate rank.

[ADR 0011](../docs/adr/0011-evidence-aggregation.md) defines the exact arithmetic,
rounding, source/claim boundaries, neutral provenance policy and conservative
cross-repository handling. Current detectors can reach .65 Strong with a linked
test; behavioral confidence remains Low because semantic coverage is partial.
The Very strong band is supported but cannot be manufactured from current evidence.

## Interfaces

| Interface | Location and behavior |
| --- | --- |
| Contract | `packages/contracts/src/aggregation.ts`: result, capability/role traces, support references, closed uncertainty/validation codes, evidence query/page |
| Pure calculation | `aggregateEvidence(input)` in `repofy-backend/src/domain/aggregation/engine.ts`; no provider/model/source execution |
| Frozen input | `AggregationInputSchema` in `aggregation/input.ts`; source-free snapshots, achieved coverage, evidence, detailed catalog and full run versions |
| Policy | `AGGREGATION_POLICY` in `aggregation/policy.ts`; seeded byte-equivalent JSON in private policy registry |
| Role matching | `matchRole` in `aggregation/roles.ts`, using Run 03's `evaluateRequirement`; every component policy applies |
| Worker stage | `createAggregation(jobs).aggregate(context)` / `productionAggregation()`; checkpoints and fenced read/write RPCs; canonical retries |
| Owner read | `AggregationRepository.read(actor, runId)` returns the immutable result or null |
| Evidence query | `.evidence(actor, runId, {repositoryId?, categoryId?, roleId?, requirementId?, afterEvidenceId?, limit?})`; 1–100, UUID keyset cursor; requirement filter requires role |
| Database | Root migration `20260920000400_evidence_aggregation.sql`; private policy/result/support tables, service-only RPCs, independent SQL arithmetic/minimum checks and composite membership FKs |
| Export/deletion | `feature_one_export_v6` adds `aggregations`; deletion/account cascade removes results and support rows |
| Replay fixture | `docs/benchmarks/run11-example-input.json` and `run11-example-result.json`, synthetic and source-free |
| Process check | `npm run aggregation:verify`; CI blocking, 384 MiB heap, 30-second watchdog, maximum-cardinality input |

No report UI or HTTP aggregation endpoint is added in this run. The owner services
are ready for Run 12/13 composition. Legacy report DTOs and historical reports remain
readable; new deterministic output has its own schema and persistence stage.

## Verification

All checks used Node 22.23.2 and disposable PostgreSQL 17.11. No live provider,
model or remote database was contacted. Existing coverage thresholds are unchanged.

| Check | Result |
| --- | --- |
| Backend full suite | 1,085 tests, 88 files; coverage 87.52% statements / 85.08% branches / 88.95% functions / 89.94% lines |
| Frontend full suite | 557 tests, 84 files; coverage 82.09% / 76.58% / 78.36% / 83.03% |
| Contract build and checks | 70 passed |
| Real PostgreSQL suite | 89 passed |
| Backend build/typecheck | Passed |
| Frontend production build/typecheck/lint | Passed; existing unused `vi` warning and existing Next/Sentry build warnings remain |
| Aggregation replay and load | Passed; 20,000 observations, ten repositories, 2,041 ms, peak 507 MiB RSS under a 384 MiB heap / 30-second watchdog |
| Required human review | 4/4 agreement, no disagreements or uncertain responses |
| Final whitespace/source-file visibility checks | Passed |

Run 11 adds 24 calculation cases, three integration cases, three PostgreSQL cases
and two contract cases. Focused checks cover hand-calculated .20/.65 strengths, 2.75% weighted coverage, every band
boundary, all minima, empty/unknown roles, reordered inputs, copies across repos,
exact/content/concept duplicates, mocked/unlinked tests, parser quarantine, reduced
scans, excluded files, missing/conflicting metadata and neutral provenance.

Integration and real PostgreSQL checks cover canonical concurrency, owner isolation,
raw forged score/confidence/minimum rejection, cross-run/foreign evidence, immutable
versions, cancellation/expired leases, atomic rollback, pagination, export/deletion
and browser-role denial. The synthetic load check processed 20,000 repeated weak
observations over ten repositories without strength inflation; see
[verification data](../docs/benchmarks/run11-verification.json).

## Run 12 requirements and rollout

Compose the real extraction and aggregation factories with constrained synthesis
and validation before changing `productionHandlers` from null. Pin the aggregation
policy in job versions at admission. Model input must use these computed values,
actual support boundaries and gaps. The model must not calculate scores, infer
passing tests from assertion source, invent authorship, or turn missing assessment
scope into missing skill.

The legacy report finalizer's `assessment_evidence` foreign keys require original
`capability_evidence` mappings. Run 12 must explicitly adapt publication to the new
immutable aggregation support rows, including derived structural presence, and
validate claim scopes. Do not add retroactive capability IDs to sealed evidence.
Stored aggregation is not permission to publish a schema-valid but unsupported claim.

Apply the new additive root migration after Run 10 before enabling this stage.
For rollback, retain policy/output history and change only future-job composition.
The first policy has no earlier production version; keep the registry gated until
downstream handlers and release gates pass. Human arithmetic review is complete;
detector precision, confidence calibration and rubric-weight validation remain
broader Run 16 work. Run 15 needs a new policy to apply richer provenance.
