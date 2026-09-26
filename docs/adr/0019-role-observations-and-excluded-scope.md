# ADR 0019 — Role observations and excluded-file scope

September 26, 2026. Addresses the two implementation findings in the
[current-tree PRD review](../reviews/2026-09-26-feature-one-current-tree-review.md).
Extends ADR 0017 for new analyses; existing reports and registered policies retain
their recorded meanings.

## Decision

Register detector bundle `tsjs_implementation` `2.0.0` with 34 patterns, coverage
manifest `1.3.0`, and aggregation policies `3.0.0` / `3.1.0`. The latter retains
the separately frozen, non-scoring provenance context. New intake pins this
combination; workers select the analyzer from the queued job's pinned version.
Supported v1 and v2 jobs still use their original detector and scoring policies.
Parser and detector quarantine variants remain explicit and fail closed.

The 18 additional patterns inspect resolved source relationships:

| Area | Added observations |
| --- | --- |
| Frontend | Labelled controlled form with a connected change handler and named submit control; reducer action and immutable state update |
| React Native / Expo | Labelled native press action; AppState listener with returned cleanup; validated route parameters; same-key cached fallback; awaited secure-storage write |
| Boundaries / security | Parsed input crossing a local module boundary; guarded environment credential; rejecting resource ownership guard |
| AI application | Bounded context records feeding a structured model prompt; literal action allowlist before dispatch; finite expected-output cases calling a resolved implementation that reaches a model API |
| Observability | Literal structured failure diagnostic; awaited dependency probe with distinct success/failure statuses |
| Tests | Expected throw or awaited rejection; named-role component query; assertion of an imported immutable declaration's property |

All new observations have explicit required syntax and limitations. They retain
literal package identity, local binding resolution, reachability checks, bounded
parsing, no source execution and no claim of passing tests. API availability,
installed versions, computed accessibility, native execution, model quality and
system-wide security remain unverified. Narrow existing patterns keep their
strength ceilings, including the 0.40 button and 0.45 schema/state observations.
Rubrics, required-component minima, weights and the independent-test bonus are
unchanged. Source test linkage can now refer to a component, route handler or
immutable declaration in addition to a direct function call.

Test evidence itself receives corroboration only from a separate success/failure
assertion source referring to the exact same production file, symbol and concept
in the same snapshot. The sources must have different files, content fingerprints
and patterns, and neither may be mocked. Self-reference, duplicate assertions,
unrelated tests and a passing-test claim are not permitted. SQL independently
checks these conditions and the resulting rubric calculations.

## Exclusion interpretation

Ingestion keeps all existing mandatory exclusions. It additionally counts a
bounded set of known non-source exclusions using their path and exclusion reason:
`.repofyignore`, passive image/font/audio/video extensions, and `.env.example`,
`.env.sample` or `.env.template`. Excluded content is never opened for this
classification. Total excluded counts and their categories remain visible.

Only v3 removes this recorded count from the per-capability missing-source
denominator. A policy file does not itself imply that source was omitted; any
files actually matched by its rules remain unassessed. Vendor/generated code,
other sensitive paths, secret-screened content, executable binaries, undecodable
text, parser failures, unresolved bindings and exhausted budgets still reduce
confidence. The new classification does not establish repository-wide security
or completeness. Older snapshots without the classification retain conservative
old-policy handling.

The count is carried through the ingestion receipt, snapshot inventory, achieved
coverage, aggregation trace and owner UI. Contracts bound it by total exclusions;
snapshot sealing checks it against the eligible exclusion categories; aggregation
persistence recomputes from sealed coverage and rejects altered counts or labels.
Same-version comparisons ignore exclusion-category changes only when both sides
explicitly record exclusively known non-source exclusions. Genuine source loss
still marks comparisons incomplete and withholds role deltas.

## Acceptance and qualification

Authored source fixtures for each of the five roles now satisfy every required
criterion through real ingestion, extraction and aggregation: Backend 6/6,
Frontend 6/6, Full-Stack 7/7, Mobile 6/6, AI Application 6/6. Removing independent
assertions makes all required criteria unmet. Unsupported languages remain
unknown. Counterexamples break each added control or assertion; tests also cover
hidden controls, skipped/mocked assertions, missing cleanup, unawaited operations,
wrong cache keys and unrelated test linkage.

Adding an empty ignore file, an ordinary asset or an environment template leaves
capability strength, confidence labels and required-criterion states unchanged.
Actual source exclusions still lower confidence. Real PostgreSQL acceptance checks
both v3 variants and rejects forged counts, High labels and self/unrelated test
corroboration. Browser acceptance follows an implemented portfolio through the
worker, saved report, asset-only rescan and comparison while preserving the baseline.

These fixtures demonstrate that the previous structural impossibility and
packaging-file regression are removed. They do not establish representative
detector precision, calibrated role readiness or improvement usefulness. The
registered projection remains `provisional / calibration_pending`; High confidence
and fully qualified availability remain unavailable. Human claim review, independent
calibration and the existing live-provider, operational and release gates remain
required. Historical release acceptance artifacts are not overwritten.

## Deployment

Apply `20260926000300_role_observations_and_scope.sql` after the preceding
migrations, build/install shared contracts, then deploy compatible API, workers
and frontend. The migration appends registry versions and strengthens snapshot
and aggregation validation; it does not rescore or rewrite stored reports. Drain
v3 jobs before rolling workers back to a v2-only build. Local verification applies
migrations only to disposable databases; it does not enable rollout.

API references used to check the supported source forms:
[React Native AppState](https://reactnative.dev/docs/appstate),
[Expo Router navigation](https://docs.expo.dev/router/basics/navigation/),
[AsyncStorage 2 usage](https://react-native-async-storage.github.io/2.0/Usage/),
[Expo SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).
