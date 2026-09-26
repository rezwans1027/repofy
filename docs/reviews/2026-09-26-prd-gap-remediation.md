# PRD gap remediation — September 26, 2026

Follow-up: [role and exclusion remediation](2026-09-26-prd-role-and-scope-fixes.md)
adds the previously missing role patterns and fixes harmless-exclusion scoring.
The v2 results below are historical and remain unchanged for old reports.

The browser metadata gap is resolved locally. The confidence/rubric incompatibility
has a versioned provisional implementation; qualified role readiness remains an
acceptance gap. Feature 1 rollout remains on HOLD.

## Changes

- [ADR 0017](../adr/0017-bounded-role-evidence-coverage.md): new immutable aggregation
  policies `2.0.0`/`2.1.0` distinguish confidence in a bounded observation from broad
  semantic coverage. Valid implementation evidence can reach Moderate without
  raising strength or changing rubric minima. Unknowns, partial processing,
  independent corroboration and compound requirements retain their safeguards.
  The report explicitly shows provisional evidence coverage and pending calibration.
  V1 reports retain their original values and availability. Queued jobs retain their
  supported pinned versions. Incompatible or incomplete comparisons withhold role deltas.
- [ADR 0018](../adr/0018-browser-metadata-choices.md): initial analyses expose opt-in
  commit, PR and CI controls with read-permission descriptions. Rescans inherit
  original requested options, including denied/unavailable sources. Replay keys
  include metadata scope, and choices survive uncertain responses and remounts.
  Owner report views expose saved job options without rewriting report content.

Apply `20260926000100_report_metadata_choices.sql` and
`20260926000200_bounded_evidence_aggregation.sql` before deploying compatible API,
worker and frontend builds. Build/install shared contracts first. Migrations were
verified in disposable local databases; no deployment or rollout changes were made.

## Observable result

The source-based acceptance fixture adds an independent assertion of a bounded
retry and an assertion of a local state guard. Safe ingestion, real detectors,
aggregation and rendering produce these v2 results:

| Role | Coverage before assertions | Coverage after assertions | Required criteria met after | Unknown weight |
| --- | ---: | ---: | ---: | ---: |
| Backend | 2.75% | 10.40% | 1 / 6 | 42% |
| Frontend | 4.40% | 5.20% | 0 / 6 | 60% |
| Full-Stack | 0% | 5.50% | 1 / 7 | 52% |
| Mobile | 4.40% | 5.20% | 0 / 6 | 82% |
| AI Application | 0% | 6.50% | 1 / 6 | 64% |

These are authored fixture results, not representative readiness measurements or
empirical calibration. Weak patterns fail required thresholds; unsupported
portfolios remain unknown. Frontend handler-test corroboration and Mobile core
coverage still need detector expansion. The accessibility detector's narrow
observation remains below the required minimum even with its permitted test bonus.
Independent engineering calibration and current-version human claim review remain
necessary before a policy can be registered as fully available.

The browser acceptance uses real HTTP routes, PostgreSQL, the worker and authorized
metadata collectors with synthetic provider responses. It verifies two-page
truncated history, exact-commit PR/check/status/Actions observations, history-based
provenance, preserved rescan options, fresh PR permission denial and CI outages.
The immutable baseline remains unchanged and source evidence survives optional
metadata failures. New controls passed automated accessibility checks and desktop/
mobile visual inspection.

## Verification

Node 22.23.2. Passed shared-contract tests (85), backend tests with coverage (1,536),
frontend tests with coverage (591), real PostgreSQL cases (127), report browser
journeys (6), selection browser journeys (2), and readiness HTTP checks (8).
Backend line/branch coverage: 90.98% / 86.05%; frontend: 84.53% / 76.03%.
Typechecks, frontend lint, both application builds, bounded aggregation verification,
and the frozen synthetic regression benchmark passed. The benchmark retains its
known 24 true positives, zero false positives and one documented false negative;
it does not calibrate v2. Historical release artifacts were not overwritten.

Implementation digest after the final test updates:
`af3349ba7041aaeba5e6f3ff27de236e7a8eee27daa2115fc25efb98959b893c`.
All independent human, live-provider, deployment and external release gates remain
separate from these local checks.
