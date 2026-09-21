# Run 08 handoff — inventory and structural evidence

Status: complete for the scoped local implementation, September 20, 2026. Requirements: ANA-004–005 and ING-009. Public analysis remains unavailable: implementation detectors, aggregation, synthesis and semantic validation remain Runs 09–12. No remote migration, deployment, live provider request or feature-flag change was made.

## Delivered

- Pure, versioned extractors consuming Run 06's filtered context. Bounded JSON/YAML/TOML and TS/JS AST parsing; repository modules/configuration are never imported or executed. Formats, parser budgets, output schema and failure behavior are declared by each extractor.
- Deterministic eligible-file inventory, nearest-manifest project boundaries, language/size/line classification, dependency/generated status and aggregate security-exclusion counters. Excluded paths are not retained. Failed, unsupported and limited files remain in coverage denominators; filename-only test discovery stays at inventory depth.
- Distinct dependency, code, test, config, docs and CI observations: scoped/aliased/workspace/transitive dependency records, framework declarations, candidate tests/suites/assertions/relative-import associations, workflow conditions/test commands, Docker/deployment configuration, SQL/Prisma schema structure and documentation/architecture elements. Fixed descriptions and closed facts replace arbitrary prose, commands and package names. Every item carries a confidence basis, explicit claim boundary and limitations.
- Bounded authorized commits, associated PRs, check runs, combined statuses and Actions metadata. Optional permission denial, outage, parse/size limit, truncation, no signal and not-requested states remain distinct. Subject SHA and exact/ancestor/context relationships prevent another commit's success from becoming a result for the analyzed commit. Captured dates, parent counts and connected-author match/type support later provenance work without retaining names/emails/prose.
- Deterministic HMAC-derived natural IDs, protected content fingerprints, source/language indexes, membership validation and repeatable Run 07 stage persistence. Concurrent/repeated writes yield one artifact; retries reuse the job's saved snapshot. Canonical identity now includes captured metadata and options, preventing stale permission/result reuse. This advances the necessary metadata-cache portion of Run 10.
- Compatible security policy 1.1.0 for new structural runs: bounded lockfiles and schema/migration SQL can enter the existing scanner/context pipeline. Sensitive dump/seed/data paths and detected SQL data statements remain excluded, including comment-separated statements. Old 1.0.0 jobs retain their policy unchanged.
- Shared optional structural contracts, private export/deletion compatibility, safe counts/timing metrics, synthetic benchmark seeds and a blocking parser-process CI check. The real extraction factory is available for downstream worker composition; the complete production registry remains null.

## Stable entry points for Run 09

| Entry | Purpose |
| --- | --- |
| `src/domain/extraction/pipeline.ts` | `extractSnapshot`, `createStructuralExtraction`, immutable `EXTRACTORS` registry; returns a validated `SnapshotBundle` and separate safe metrics |
| `src/domain/extraction/policy.ts` | Per-extractor interface, budgets and `extractionProfile()`; disabled families receive distinct versions and unsupported coverage |
| `src/domain/extraction/parsers.ts` | Pure bounded data-document parsing and in-memory TS/JS AST construction, without module resolution or emit |
| `src/domain/extraction/inventory.ts` | File/source classification, manifest-location boundaries and unambiguous relative-import association |
| `src/domain/github-app/metadata-client.ts` | Fixed-path, bounded transport behind fresh verified repository tokens and context/job checkpoints |
| `src/domain/extraction/metadata.ts` | Captured metadata batch, requested-source and relationship contracts |
| `packages/contracts/src/structural.ts` | Source facts, claim boundaries, inventory and coverage counters, metadata availability/provenance |
| `src/domain/jobs/runtime.ts` | Lazy `productionExtraction()` factory; does not enable intake |
| `supabase/migrations/20260920000100_structural_evidence.sql` | Forward-only schema/RPC changes; apply after Run 07 and before structural worker code |
| `tests/fixtures/evidence/` | Synthetic development corpus and semantic assertions; not held-out calibration data |

Current profile: `structural_inventory@1.0.0`, `structural_signals@1.0.0`, coverage manifest `1.0.0`, security `structuralSecurityPolicy()` 1.1.0. Compose the profile references explicitly into the frozen execution policy; do not spread its `disabled` configuration into `VersionDependencies`. Change bundle versions when adding implementation behavior or changing parsers. The stored canonical snapshot ID returned by persistence remains authoritative.

Keep structural-only observations distinct from meaningful implementation/test detectors. Run 08 emits no capability assignments; confidence/strength values are explicitly uncalibrated placeholders. No dependency, README statement, workflow command, candidate assertion or import association alone proves proficiency, passing tests, test coverage, architecture quality or deployment success. Contribution remains unknown. Preserve these limits through Runs 09–13.

Supported dependency formats include npm manifests/package locks v2/v3, pnpm locks v6/v9, bounded requirements files and PEP 621/735-style pyproject declarations. Yarn lock syntax, npm lock v1, Maven/Gradle dependency evaluation, Poetry/dynamic dependencies and deep non-JS implementation analysis remain explicitly unsupported. Workspace membership is a declaration, not an executed resolver result. SQL is lexical DDL structure, not dialect validation. Run 10 expands coverage; Run 16 must calibrate parsers, scanner, confidence and performance against representative held-out repositories.

## Verification record

All verification used Node 22, synthetic repository/provider inputs and disposable databases.

- Shared contracts: **64 tests passed**.
- Backend: **953 tests in 81 files passed**. Coverage: statements **85.82%**, branches **80.86%**, functions **85.35%**, lines **87.86%**; thresholds unchanged. The final full run used one worker to avoid local contention with existing five-second integration deadlines.
- PostgreSQL: **80 tests passed**, including four new real-database extraction cases for concurrent writes, metadata identity, forged counters/SHA binding, stale fences and owner isolation. Existing migration history, grant, export/deletion, job, billing and retention tests still pass.
- Frontend: **551 tests in 83 files passed**, with unchanged coverage thresholds; typecheck, build and lint pass. The existing unused `vi` lint warning and Next/Sentry build warnings remain.
- Backend typecheck/build pass. `extraction:verify`, `ingestion:verify` and `worker:verify` pass. The parser check uses a separate process with a 256 MiB heap, independent 15-second watchdog, malicious config/hostile documents and exact source-free output checks.
- The real extraction handler runs through Run 07 plus Run 06/PGlite, persists sanitized observations and resumes cached extraction after a transient downstream failure without downloading/parsing again. Unit fixtures exercise all eight evidence source types together, optional permission denial, SHA-mismatched checks, provisional PR merge context, malformed/aliased documents, deterministic repetition and evidence truncation.

Logs: `/tmp/repofy-run08-{contracts,backend,postgres,frontend,frontend-build,frontend-lint,backend-typecheck,frontend-typecheck,parser-process,ingestion,worker-process}.log`. No UI flow changed in this run, so existing browser journeys were not rerun. The verified frontend build targets loopback port 3191; deployment must rebuild for its real backend.

## Deployment and remaining gates

See [ADR 0008](../docs/adr/0008-structural-extraction.md), [database operations](../docs/database.md) and [worker operations](../docs/analysis-worker-operations.md). Deploy the additive migration before code, retain existing sealed artifacts, and keep the separate maintenance service active. Roll back by disabling intake/changing the checked-in handler composition; do not delete or rewrite earlier artifacts or migrations. Static filtering is not a calibrated DLP guarantee, and synthetic provider tests do not replace a real GitHub App permission/archive/metadata smoke test.

Run 09 is next. The release gates for live GitHub credentials, deployed supervision, complete language coverage, capability aggregation, model budgets/disclosure, report UI and held-out quality verification remain in their assigned runs. The complete production handler registry is still null and public analysis remains gated.
