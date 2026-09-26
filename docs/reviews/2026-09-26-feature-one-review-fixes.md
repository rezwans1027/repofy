**Feature 1 review fixes — September 26, 2026**

All four actionable findings from the [branch review](2026-09-26-feature-one-branch-review-7a3f97b.md) are addressed in the working tree based on `7a3f97b`. This closes those findings within the verified local scope; it does not establish full PRD qualification or authorize deployment.

| Finding | Change | Regression evidence |
| --- | --- | --- |
| Unreachable or incompatible form controls | Detector `2.0.1` requires participating controls on a common reachable render path. Dead literal/local-constant branches, callbacks, props, component boundaries and controls assigned to another form do not qualify. | Positive and adversarial source cases; all three independently unreachable controls lose the compound observation, verified claim and corresponding role contribution through the real report pipeline. |
| Mutated AI action allowlists | Only literal arrays and local const aliases with exclusively supported membership reads qualify. Mutations, prototype replacement, exports and escapes invalidate the proof. | Mutation, alias, prototype and escape cases; report-level AI safety and role contribution regressions; valid inline and local alias examples remain supported. |
| Missing improvement file references | An optional report-view projection associates limited-evidence improvements with saved, matching file evidence. Plan buttons use the existing live, owner-authorized location endpoint. Relevant files are distinguished from verified edit recommendations. | Private/public, revoked, foreign, unavailable, missing-evidence and late-response tests. Real browser inspection from a plan, path clearing on blur and cross-account denial pass. No private paths enter model input or ordinary report responses. |
| Outdated deployment migration cutoff | The runbook now specifies migration `20260926000400_detector_claim_guards.sql`, detector `2.0.1`, coverage `1.3.0`, aggregation `3.0.0` / `3.1.0`, and compatible draining/cancellation before rollback. | Fresh real PostgreSQL migration replay, immutable registry checks and old/new snapshot sealing with mixed-version rejection pass. |

Older pinned detector `2.0.0` jobs remain supported and historical reports are unchanged. The correction uses a new detector identity; coverage declarations, aggregation arithmetic and provisional calibration labels remain unchanged. See [ADR 0020](../adr/0020-detector-claim-guards-and-improvement-files.md).

All **22 verification checks passed** under Node `22.23.2` against unchanged source digest `b3cc5dc28c3e44561109b467b5cbe9d0c01246279c7976ab1ad9de706addaf29`. The [verification receipt](2026-09-26-feature-one-review-fixes-verification.json) records commands, exit codes and timestamps.

- Contracts: 85 tests; backend: 1,697 tests; PostgreSQL: 131 tests; frontend: 600 tests.
- HTTP/browser: 17 passing scenarios, including worker publication, improvement file inspection, permissions, rescans and deletion.
- Type checks, lint, production build, six process verifiers, rubric validation, synthetic benchmark and synthetic load checks passed. `git diff --check` passed.
- Backend line/branch coverage: 91.37% / 87.13%. Frontend: 84.73% / 76.38%.

The browser harness still emits the previously observed `MaxListenersExceededWarning`; the workflows pass, and this change does not claim to resolve that warning. Historical release/calibration artifacts were preserved. `release:decision` still exits 1 because its recorded benchmark predates the current domain implementation. Independent calibration and live/deployed acceptance remain outstanding. No remote migration, deployment, feature enablement or paid provider call was performed.
