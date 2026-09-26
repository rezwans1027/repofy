# Role and exclusion remediation — September 26, 2026

The two code gaps from the [current-tree review](2026-09-26-feature-one-current-tree-review.md)
are addressed by new immutable analyzer/scoring versions. This supersedes the
earlier remediation's outstanding detector and exclusion findings for new analyses.
Independent product qualification remains separate; rollout stays on HOLD.

## What changed

- Added 18 resolved source patterns and component/declaration/failure assertion
  linkage. All five initial roles now have attainable required criteria. Existing
  detector strengths and rubric thresholds were preserved. Independent
  success/failure assertion sources can corroborate testing evidence only when
  they refer to the same production symbol; clones, self-reference, unrelated
  tests and mocks do not qualify.
- Recorded known non-source exclusions separately from unassessed source.
  Empty ignore files, passive assets and environment templates retain inventory
  counts without downgrading unchanged implementation evidence. Real omissions,
  secret screening, unsupported code, parser failures and unresolved imports
  still retain uncertainty. Mandatory exclusions remain enforced.
- Applied the rules through shared contracts, ingestion, extraction, snapshot
  sealing, aggregation, SQL recomputation, report rendering and comparisons.
  New intake uses detector `2.0.0`, coverage `1.3.0` and aggregation `3.0.0` or
  `3.1.0`. Supported older jobs retain their pinned analyzer; saved reports are
  not rescored. The UI keeps the provisional calibration label.

[ADR 0019](../adr/0019-role-observations-and-excluded-scope.md) records the supported
patterns, exact limits and deployment order.

## Observable acceptance

These are authored source fixtures processed by real ingestion, detectors and
aggregation. They demonstrate reachable criteria, not representative portfolio
scores or empirical calibration. The fixture source is never executed.

| Role | Required criteria without independent assertions | With assertions | Provisional weighted coverage with assertions | Unknown requirement weight |
| --- | ---: | ---: | ---: | ---: |
| Backend | 0 / 6 | 6 / 6 | 53.75% | 13% |
| Frontend | 0 / 6 | 6 / 6 | 55.25% | 10% |
| Full-Stack | 0 / 7 | 7 / 7 | 54.25% | 9% |
| Mobile | 0 / 6 | 6 / 6 | 58.50% | 10% |
| AI Application | 0 / 6 | 6 / 6 | 54.60% | 8% |

Satisfying every required criterion does not imply 100% weighted coverage: the
unchanged calculation uses observed strength and retains supporting requirements
that the fixture does not establish. Broad runtime and professional-readiness
claims remain unavailable.

Regression checks compare an identical portfolio before and after adding an empty
`.repofyignore`, `public/logo.png` or `.env.example`. Strength, confidence labels
and requirement states stay identical. Ignoring actual source, adding excluded
vendor/generated code, secret-screened source or executable binary content still
lowers confidence. Unsupported Go input remains unknown, and v2 retains its old
exclusion arithmetic.

The browser acceptance saves an implemented portfolio, checks all 31 required
criteria across five provisional roles, adds all three harmless file categories,
rescans, and checks unchanged measurements and compatible comparison deltas.
The original report must remain byte-for-byte equal through its owner projection.
The test uses HTTP routes, the worker and disposable PostgreSQL with synthetic
provider responses.

## Verification

All 22 local verification commands passed using Node 22.23.2:

| Check | Result |
| --- | --- |
| Shared contracts | 85 tests; typecheck/build passed |
| Backend | 1,636 tests across 112 files; application/release typechecks passed |
| Real disposable PostgreSQL | 129 tests, including both v3 variants and rejection of forged traces |
| Frontend | 591 tests across 89 files; lint, typecheck and production build passed |
| HTTP / browser | 8 route boundaries, 2 selection journeys, 7 report journeys passed |
| Ingestion / worker / extraction / detectors / coverage / aggregation | All six process checks passed; detector check exercises both v1 and v2 within the existing heap/watchdog limits |
| Rubrics | Manifest/seed validation passed; no threshold changes |
| Frozen legacy detector corpus | 24 true positives, 0 false positives, 1 documented false negative; 58/58 major claim references valid |
| Synthetic integrated workload | 13/13 completed; zero terminal workspaces retained |

Total: **2,441 contract/unit/integration/PostgreSQL tests plus 17 HTTP/browser
checks**. Backend line/branch coverage is 91.32% / 86.97%; frontend is
84.53% / 75.97%. Both configured coverage gates pass. The 100 detector/role
regression cases are included in the backend total.

The final factory default was aligned with v3 after the full suites; 27 targeted
aggregation tests, the 129 PostgreSQL cases, an independently runnable role/rescan
browser scenario and typechecks passed afterward. The browser assertions check all
31 required criteria, unchanged asset-only measurements, zero role deltas and
baseline immutability. Role controls passed axe; mobile role/coverage screenshots
were inspected and the viewport check found no horizontal overflow. These are
automated/visual checks, not human assistive-technology qualification. Existing
synthetic-server response-listener warnings remain in the browser logs.

The legacy corpus is a compatibility regression, not precision calibration of the
18 new patterns. New patterns have positive and broken-control fixtures plus
adversarial source cases; independent representative review remains pending.

[Machine-readable evidence](2026-09-26-prd-role-and-scope-evidence.json) records
commands, exit codes, log hashes, fixture measurements and remaining gates. Final
implementation digest:
`047d29cece3090555f194fda048dc6784e4b08489afcb733af5f9d16830d9596`.
Historical benchmark/human-review artifacts were preserved. `release:decision`
still exits 1 because its saved benchmark predates the current implementation;
this remediation does not manufacture a current release approval.

## Remaining acceptance boundary

The prior review's implementation impossibility and packaging-file regression are
removed. Independent representative detector/claim review, confidence/rubric
calibration, improvement usefulness, live GitHub/model acceptance, deployed
operations, human assistive-technology checks and required remote CI remain open.
Synthetic tests cannot supply those approvals. Python/Java retain baseline support;
Swift/Kotlin runtime behavior, model quality and contribution confidence remain
unassessed as disclosed. No deployment, rollout flag, provider configuration or
remote repository setting was changed.

Apply `20260926000300_role_observations_and_scope.sql` after the preceding
migrations and build/install shared contracts before deploying matching API,
worker and frontend builds. Drain v3 jobs before rolling back to v2-only workers.
