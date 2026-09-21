# Run 11 — Capability aggregation, confidence, and role matching

**Status:** Complete for the scoped implementation. Required human calculation review complete (4/4 agreement); see [handoff](11-handoff.md). **Depends on:** Runs 03 and 08–10. **Requirements:** ANA-006–010, ANA-013 foundations; PRD sections 9.6–9.7, 16.4–16.6, and 17.

## Outcome and scope

Turn evidence items into reproducible capability assessments and coverage of all five role templates. Every result explains supporting observations, confidence, deduplication, limitations, and contributing repositories. Role coverage is neither an employment probability nor a candidate rank.

This is deterministic domain logic and persistence. Run 12 adds constrained narrative and improvements; Run 13 presents the results.

## Read first

Read Run 03 rubric policies, Runs 08–09 evidence/concept keys, Run 10 achieved-coverage states, and PRD sections 16.4–16.6. Do not reuse overallScore, recommendation, or candidateLevel from the old report model.

## Implementation sequence

1. Validate input membership before aggregation: the evidence item, snapshot, repository, taxonomy, and selected run must agree. Exclude invalid or quarantined findings with a safe validation record. Authorization and database constraints remain authoritative even when input arrived from a trusted worker.
2. Cluster related observations by repository, implementation concept, detector family, and normalized location/content relationships. Repeated observations, copied code, multiple parser passes, and source plus derived summaries must not create independent proof by sheer count.
3. Define an explicit versioned strength algorithm using the strongest base observation and bounded diminishing corroboration from independent tests/configuration/docs/metadata. Document weak-source ceilings and cross-repository combination rules. More evidence items must not automatically mean stronger engineering evidence.
4. Calculate confidence independently from strength using detector reliability, achieved language coverage, independent support, and provenance uncertainty. Reserve typed provenance inputs now; unknown contribution must be represented neutrally/with uncertainty rather than as a fabricated zero or one. Run 15 supplies richer observations and a new policy version if needed.
5. Produce capability assessments containing strength, confidence, evidence references, supported claim scopes, exclusions/uncertainty, and a structured calculation/explanation trace. Apply the PRD strength bands consistently, including strong and very strong where appropriate.
6. Implement role-requirement combination and minimum-evidence rules from Run 03. Document weighted coverage math and normalization in an ADR. A suggested starting approach is the weighted sum of bounded requirement satisfaction divided by the full applicable rubric weight; choose precise satisfaction mapping before implementation and version it.
7. Preserve not-assessable weight as explicit unknown/uncovered scope under the chosen policy. Do not remove unsupported requirements from the denominator and report a misleading 100% coverage. Show assessable fraction separately and keep partial-scan limitations visible. Required/preferred groups may be retained in the contract without implementing Feature 3's job parser.
8. Compute supporting capabilities, highest-impact weak/missing requirements, and leading repositories for each of the five roles. Separate true negative observations from missing evidence in the analyzed scope. No result says the candidate does not know a technology.
9. Generate deterministic explanation data sufficient for the UI and model to explain each result. It must be possible to reconstruct a displayed value from frozen evidence, rules, and versions without another model call.
10. Persist assessments and role results with immutable analysis/rubric dependencies through Run 07 stages. Provide owner-scoped read services and pagination-ready evidence queries for grouping by repository, capability category, and role requirement.

## Coverage and claim boundaries

A capability with no assessable source is not assessable; it is not a high-confidence negative. A capability that was assessed but not observed can yield a scoped evidence-gap statement. Gaps reference the rubric requirement and achieved analysis coverage; they must not invent an evidence item to claim support for absence.

Positive verified claims reference actual supporting evidence. Role percentages are deterministic summaries referencing the included assessments/rubric. Their wording states coverage of selected repository evidence, not a complete measure of readiness or job performance.

## Acceptance criteria

- Reordered identical inputs yield the same assessments and role coverage.
- Duplicating near-identical evidence does not materially inflate capability strength.
- Independent implementation tests may corroborate a claim according to a bounded, documented rule.
- Weak dependency evidence cannot become a strong capability through repetition.
- All five roles have coverage, confidence, strongest support, high-impact gaps, repository contributions, and limitations.
- Every displayed calculation and claim has a traceable immutable dependency chain.

## Verification

Use hand-calculated fixtures for strength boundaries, minimum evidence, weight normalization, empty roles, conflicting observations, near duplicates, copied modules across repositories, test corroboration, and low-confidence coverage. Exercise missing metadata, not-assessable languages, and reduced scans so removing evidence cannot spuriously improve completeness.

Test cross-run/foreign evidence rejection and version mismatch at the persistence boundary. Have human reviewers inspect representative calculation traces; record disagreement in benchmark data. Avoid tests that only repeat the implementation formula without independently known examples.

## Migration, rollout, and handoff

Add versioned aggregation policies and structured assessment records. New formulas create new versions/runs; they do not mutate completed reports. Roll back the active policy for future jobs while retaining old dependencies and documenting known issues.

Hand off deterministic services, formula ADR, boundary fixtures, evidence-query interfaces, supported claim scopes, and gap descriptors. Run 12 should write from these outputs rather than ask the model to calculate scores or invent capabilities.
