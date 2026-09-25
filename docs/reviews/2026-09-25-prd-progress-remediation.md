# PRD review remediation — September 25, 2026

Scope: the four findings in the [PRD progress review](2026-09-25-prd-progress-review.md)
on `feature/project-evidence-readiness`, preserving the pre-existing worktree edits.

| Finding | Result |
| --- | --- |
| Unattainable role requirements | Safe presentation mitigation implemented. Current roles explicitly show unavailable/unknown; original calculations remain inspectable. Comparisons withhold role-score deltas. Meaningful calibrated role readiness remains open. |
| SQL data admitted to schema extraction | Fixed for the reproduced UPSERT and optional-INTO MERGE forms, including aliases, TOP, hints, comments and stored bodies. New security policy 1.1.4 prevents old source reuse. |
| Indistinguishable improvement cards | Cards identify the capability, gap state/explanation and relevant roles. Direct keyboard-accessible scope and evidence navigation reaches the existing permission-checked location lookup. No change location is invented. |
| CI permission omission | Only the `changes` job receives `pull-requests: read` alongside `contents: read`. Remote PR execution and required-check configuration remain external qualification work. |

See [ADR 0016](../adr/0016-role-readiness-availability.md) for the role-availability
decision. No confidence thresholds were relaxed and no frozen calculation or
report was rewritten. No deployment, remote permission, feature flag or rollout
setting was changed.

Deploy schema through
`20260925000200_upsert_and_merge_sql_screening.sql` before application code. Build
and install the shared contracts into both applications. Old policy pins remain
readable; workers reject incompatible queued jobs before acquiring source.

## Verification

`npm run release:verify` passed all **22 required local checks** on Node 22.23.2
against one unchanged implementation digest:
`80914953202eedd3aee9bacb177856f871ad5308e2638ad75d426362e08d2ce8`.

| Suite | Result |
| --- | --- |
| Shared contracts | 84 passed |
| Backend unit/integration | 1,528 passed across 109 files |
| Real PostgreSQL | 125 passed, including additive migrations, immutable results and rescan reuse fences |
| Frontend | 585 passed across 88 files |
| HTTP/browser | 15 passed: 8 readiness-boundary, 2 selection and 5 private report scenarios |
| Other required checks | Typechecks, lint, builds, coverage thresholds, process boundaries, rubric parity, frozen benchmark and synthetic load passed |

Total: **2,322 contract/unit/integration/PostgreSQL tests**, plus the 15 HTTP/browser
checks. Workflow YAML and the job-scoped read permissions were also validated
locally. Mobile screenshots of the revised role and improvement cards were inspected;
browser tests check keyboard navigation, current permission checks, no horizontal
overflow, automated accessibility, isolation, revocation and deletion.

The new browser regression exposed an empty-evidence navigation path and an
overflowing long button during implementation. Cards now offer evidence navigation
only for observed, limited-evidence gaps and constrain the button to the card width;
unobserved and unassessable gaps link to scope. Both corrections passed the final
complete verification. A stale comparison-version assertion was updated for the
new read algorithm without weakening its scope checks.

Current artifacts: [verification](../benchmarks/run16-verification.json),
[benchmark](../benchmarks/run16-results.json), [load](../benchmarks/run16-load.json),
and [release decision](../benchmarks/run16-release-decision.json). The decision was
regenerated and remains **HOLD** with the same nine human/external blockers. Local
passes do not establish calibration, live-provider access, deployed operation,
manual assistive-technology acceptance, hosted regression or remote PR CI protection.
