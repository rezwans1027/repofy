# Run 10 handoff — Language coverage and limitations

Completed 2026-09-20 for ANA-004, ANA-006–007, ANA-010 and ANA-014 foundations, including automated and browser verification. Public analysis remains disabled pending downstream handlers and release validation.

## Delivered

- Baseline Python and Java grammar observations; static Maven direct dependencies/modules; existing Python manifests, configuration, tests, docs and provider history remain available. Repository code, imports, setup scripts, builds and tests are never executed.
- Immutable coverage declaration `1.2.0`, extractor `language_inventory@1.0.0`, parser quarantine variants, per-file outcomes and achieved repository/language/capability scope for all 34 taxonomy capabilities. Run 09's detector versions and confidence values are preserved.
- Explicit unsupported/unknown versus not-observed states, all-file denominators that retain exclusions, independent SQL/CI evidence, metadata bounds and stable trusted reasons. No reduced-scan choice is offered; ingestion limits fail the snapshot, while bounded implementation omissions are recorded.
- Additive contracts/migration, canonical coverage validation, owner-only progress summaries and manifest-driven selection badges. Legacy results remain unknown. The coverage component can be used in Run 13's report.
- A language fixture matrix, parser failure/quarantine/unavailability and per-file detector failure checks, SQL forgery/race tests, UI tests and bounded parser process verification in CI.

## Stable interfaces

| Interface | Location |
| --- | --- |
| Declaration, selection policy and version factory | [manifest.ts](../repofy-backend/src/domain/coverage/manifest.ts), [review JSON](../docs/benchmarks/run10-coverage-manifest.json) |
| Derived facts for Run 11 | [achieved.ts](../repofy-backend/src/domain/coverage/achieved.ts), `coverage.assessment` |
| Baseline parser boundary | [baseline.ts](../repofy-backend/src/domain/extraction/baseline.ts) |
| Worker composition | `createCoverageExtraction` in [pipeline.ts](../repofy-backend/src/domain/extraction/pipeline.ts) |
| Runtime contracts and user-facing reasons | [assessability.ts](../packages/contracts/src/assessability.ts) |
| Immutable declarations and sealing checks | [migration](../supabase/migrations/20260920000300_language_coverage.sql) |
| Shared UI | [analyzer-coverage.tsx](../repofy-frontend/src/components/readiness/analyzer-coverage.tsx) |
| Synthetic fixtures | [language matrix](../repofy-backend/tests/fixtures/evidence/language-coverage.ts), [16-case results](../docs/benchmarks/run10-coverage-matrix.json), [example DTO](../docs/benchmarks/run10-example-coverage.json) |
| Parser decisions, exact scope and recovery | [ADR 0010](../docs/adr/0010-language-coverage.md) |

Compose the three profile references (`extractorBundle`, `detectorBundle`, `coverageManifest`) explicitly into frozen versions. Keep taxonomy `engineering_capabilities@1.0.0`, initial role rubrics and `structuralSecurityPolicy()` version `1.1.0`. `coverage`/`implementation`/`disabled` are factory settings, not version dependency fields. Prior structural and implementation factories remain available for old policies.

## Verification

Node 22.23.2; disposable PostgreSQL 17.11; no application `.env` databases, real model calls or paid provider calls.

| Check | Result |
| --- | --- |
| Backend suite with coverage | 1,058 tests / 86 files passed; statements 87.10%, branches 84.31%, functions 87.92%, lines 89.57%; unchanged thresholds |
| Focused new language/persistence cases | 27 passed, included above; final extraction/coverage regression pass: 76 tests |
| Real PostgreSQL migrations, races, access and forgery checks | 86 passed |
| Shared contracts | 68 passed |
| Frontend suite with coverage | 557 tests / 84 files passed; statements 82.01%, branches 76.62%, functions 78.15%, lines 83.01%; unchanged thresholds |
| Backend/frontend builds and type checks | Passed |
| Frontend lint | Passed; existing unused `vi` warning remains |
| Parser process | 300 files / 400 observations; 61 ms and 167 MiB peak RSS under a 256 MiB heap / 15-second watchdog |
| Worker, ingestion, structural and detector process regressions | All passed |
| Browser selection/progress and responsive rendering | 2 flows passed; desktop/mobile screenshots inspected; mobile coverage has no page overflow |

Final review found that quarantining a parser on an oversized file could conflict with the database seal. Disabled-parser policy now takes precedence over its byte budget. All 76 affected extraction/persistence tests passed after that correction, including oversized quarantined files, and both backend build/type checks passed. Mobile visual review led to stacked language summaries on narrow screens; the final 21 UI tests, frontend build/type/lint checks and both browser flows passed after that adjustment.

The benchmark is synthetic process evidence, not a production latency or precision estimate. Run 09's separate four-example human sample review remains complete (4/4 agreement); no new calibration claim follows from these fixtures. Logs use `/tmp/repofy-run10-*.log`.

## Run 11 requirements and remaining gates

Use achieved scope alongside original evidence, never the current declaration alone. Capability `observations` include weak structural context; they are not scores or new verified capability memberships. `not_assessable` remains unknown. `evidence_not_observed_within_assessed_scope` is bounded absence, not a statement that a person lacks a skill. Preserve the full role denominator and represent unsupported native mobile/AI/runtime requirements explicitly. Do not improve completeness by dropping unsupported files or requirements. Structural counts and implementation traversal counts describe different depths.

Run 11 owns deduplication, calibrated aggregation foundations and role math; Run 12 owns validated narratives; Run 13 owns the full report UI. The production handler registry remains null and public Start remains unavailable. Broader human precision/rubric calibration, live provider verification and service deployment remain outstanding. No remote migration, deployment, publication, billing change or commit was performed. Existing workspace work was preserved.
