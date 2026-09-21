# Feature One Implementation

Detailed implementation plans for **Feature 1: Project Evidence and Role Readiness**. Prepared from the local repository and [Repofy PRD v1.0](../Repofy_PRD_v1.0.md), dated August 19, 2026. Planning snapshot: September 13, 2026.

These documents define the implementation plans. **Runs 01–15 are complete for their scoped implementations**; see the [Run 01 handoff](01-handoff.md), [Run 02 verification and handoff](02-handoff.md), [Run 03 taxonomy/rubric handoff](03-handoff.md), [Run 04 GitHub App handoff](04-handoff.md), [Run 05 selection/revocation handoff](05-handoff.md), [Run 06 safe-ingestion handoff](06-handoff.md), [Run 07 durable-job handoff](07-handoff.md), [Run 08 structural-evidence handoff](08-handoff.md), and [Run 09 detector handoff](09-handoff.md). Runs 04–05 live development-app installation/webhook checks remain pending credentials; backend, browser, synthetic-provider and real PostgreSQL verification are complete. Run 06 has verified static ingestion and crash-cleanup integration. Run 07 adds durable processing, fenced retries, atomic settlement, supervised worker/maintenance entry points and progress UI. Actual service deployment and live private archive checks remain pending. Run 08 adds reproducible structural inventory/evidence, honest exclusion and parse coverage, bounded authorized provider metadata, and durable stage reuse. Run 09 delivers 16 bounded TS/JS implementation detectors, source references, capability mappings and storage safeguards; see the [Run 09 handoff](09-handoff.md). Its required human sample review is complete with 4/4 agreement; broader precision calibration remains pending. Run 10 adds baseline Python/Java parsing, static Maven declarations, immutable declared/achieved coverage, honest per-capability unknown states and coverage UI; see the [Run 10 handoff](10-handoff.md). Run 11 implements deterministic aggregation, independent confidence, full-denominator matching for all five roles, immutable storage and owner evidence queries; its human review and regression verification are complete. See the [Run 11 handoff](11-handoff.md). Run 12 now implements bounded model selection, semantic validation, source-free usage/budget records, ranked improvements and atomic report publication; human review agreed 4/4. See the [Run 12 handoff](12-handoff.md). Its real-provider success check is blocked by pinned-model access. Run 13 delivers the private saved-report UI, all-five-role calculation views, evidence/location inspection, owner history/deletion and a real API/worker/PostgreSQL browser journey for one and several repositories; its local verification is complete. See the [Run 13 handoff](13-handoff.md). Run 14 adds separately persisted role focus, authorized commit-pinned rescans, unchanged snapshot reuse, immutable lineage and owner-only evidence comparisons; its local verification is complete. See the [Run 14 handoff](14-handoff.md). Run 15 adds owner finding feedback, restricted review, retention/export/deletion and versioned provenance context with unknown contribution and no automatic score penalty. Its local checks and human review are complete with 5/5 agreement; see the [Run 15 handoff](15-handoff.md). Run 16 adds frozen benchmarks, a first approved claim/role-boundary review, real database/worker load and recovery verification, a blocking CI aggregate and a documented **HOLD** rollout decision. See the [Run 16 handoff](16-handoff.md) and [release evidence](../docs/benchmarks/run16-release-evidence.md). Second independent engineering calibration, live provider, deployed infrastructure/privacy/capacity and manual accessibility checks remain pending; the Feature 1 release milestone is not complete. The five initial rubrics and detector confidence values remain uncalibrated; analysis stays gated pending live-provider and rollout verification. The saved-selection picker is available only behind the internal discovery flags. Execute the runs in order; use their acceptance criteria, not a session count, to determine completion. A large run may require multiple sessions or pull requests. Keep 2–4 additional sessions available for integration fixes rather than dropping requirements to fit sixteen sessions.

## Intended outcome

An authenticated engineer selects authorized public/private repositories, starts a commit-pinned analysis, and receives a private, immutable report explaining what the projects demonstrate, supporting evidence, capability confidence, coverage of five role rubrics, and prioritized improvements. The engineer can inspect evidence, change role focus, rescan, compare versions, and challenge findings.

The first end-to-end milestone is one TypeScript/JavaScript repository producing a validated report. It is a development milestone, not a reduction of the final multi-repository, language-coverage, or five-role requirements.

## Run index

| Run | Plan | Main dependency | Reviewable outcome |
|---|---|---|---|
| 01 | [Feature flags and shared contracts](01-feature-flags-and-contracts.md) | Current app | Shared runtime schemas, compatibility decisions, disabled feature boundary |
| 02 | [Database, ownership, and versioning](02-database-ownership-and-versioning.md) | 01 | Tested evidence persistence and authorization model |
| 03 | [Capability taxonomy and role rubrics](03-capability-taxonomy-and-role-rubrics.md) | 01–02 | Versioned taxonomy and all five initial role templates |
| 04 | [GitHub App and repository discovery](04-github-app-and-repository-discovery.md) | 01–02 | Installation association, identity verification, authorized discovery |
| 05 | [Repository selection and revocation](05-repository-selection-and-revocation.md) | 04 | Candidate selection, attestation, verified access-change webhooks |
| 06 | [Safe commit-pinned ingestion](06-safe-commit-pinned-ingestion.md) | 02, 04–05 | Bounded static snapshot ingestion and reliable cleanup |
| 07 | [Jobs, progress, retries, and billing](07-jobs-progress-retries-and-billing.md) | 02, 05–06 | Durable orchestration with fenced workers and idempotent effects |
| 08 | [Inventory and structural evidence](08-inventory-and-structural-evidence.md) | 03, 06–07 | Normalized file/config/test/docs/provider-metadata evidence |
| 09 | [TypeScript and JavaScript detectors](09-typescript-and-javascript-detectors.md) | 08 | Positive and negative fixtures for implementation-level evidence |
| 10 | [Language coverage and limitations](10-language-coverage-and-limitations.md) | 08–09 | Baseline Python/Java and explicit coverage/unknown states |
| 11 | [Aggregation, confidence, and role matching](11-aggregation-confidence-and-role-matching.md) | 03, 08–10 | Deterministic capability and role assessments |
| 12 | [Validated narratives and improvements](12-validated-narratives-and-improvements.md) | 07, 11 | Evidence-constrained explanations and useful improvements |
| 13 | [Readiness report and evidence UI](13-readiness-report-and-evidence-ui.md) | 05, 07, 11–12 | Complete private developer workflow |
| 14 | [Role focus and rescan comparisons](14-role-focus-and-rescan-comparisons.md) | 07, 11–13 | Immutable before/after views and role-specific ordering |
| 15 | [Feedback and contribution provenance](15-feedback-and-contribution-provenance.md) | 08–14 | Finding feedback and reviewed provenance context |
| 16 | [Benchmarks and release verification](16-benchmarks-and-release-verification.md) | All preceding runs | Measured acceptance evidence and a staged rollout decision |

[The requirement map](REQUIREMENTS.md) assigns every ANA requirement and the relevant shared requirements to runs. Use it during review and after any scope change.

## What exists today

The frontend and backend are separate npm packages, not an established root workspace. The backend compiles CommonJS with its source root restricted to its own src directory; the frontend uses Next.js and bundler resolution. A shared contracts package needs real build/install/CI integration, not only a TypeScript path alias.

Existing foundations include account authentication, GitHub profile exploration, advice generation, advice-job persistence/polling, Stripe credits, account export/deletion, logging, Vitest, and Playwright. They require inspection and selective reuse; their existence does not prove Feature 1 acceptance.

Important implementation boundaries:

- [API route registration](../repofy-backend/src/routes/index.ts) disables the old analyze route. Do not simply enable that route and call Feature 1 done.
- [The old report builder](../repofy-backend/src/services/analyze.service.ts) produces candidate-level, overall-score, and hire-recommendation fields. Introduce a separate readiness contract and storage model; keep old consumers compatible.
- [Advice processing](../repofy-backend/src/controllers/advice.controller.ts) runs work in the API process. [Its lock](../repofy-backend/src/lib/distributed-lock.ts) is an in-memory Map, despite the filename. Feature 1 needs durable execution and database-enforced idempotency.
- [The engine client](../repofy-backend/src/services/engine.service.ts) calls an external service whose implementation is not in this checkout. Do not assume that service implements the new evidence contracts. Run 01 records its integration boundary; Run 12 must deliver or verify a real model adapter before claiming model integration complete.
- [GitHub OAuth](../repofy-backend/src/services/github-oauth.service.ts) and configuration names mentioning an app do not establish installation-based repository authorization.
- Migrations exist under both [root Supabase migrations](../supabase/migrations) and [backend Supabase migrations](../repofy-backend/supabase/migrations). Run 02 must document ordering and the authoritative location for new migrations without rewriting deployed history.
- [CI](../.github/workflows/ci.yml) now runs all required Feature 1 checks on either application, contracts, root migrations, benchmark JSON or workflow changes. `feature-one-gate` rejects failed/skipped/cancelled dependencies. The credentialed hosted suite is a separate explicit opt-in and no longer uses `continue-on-error`; missing setup is not release evidence.

At planning time the checkout already contained user changes to configuration, CI, authentication, documentation, and tests. Recheck git status at the start of each run and preserve unrelated changes. These plans do not authorize reverting them.

## Proposed architecture and naming

Use the existing Next.js and Express applications. Add a small shared contracts package and backend domain modules; run the analysis worker through a separate process entry point using shared backend code. A proposed layout is packages/contracts, repofy-backend/src/domain/evidence, repofy-backend/src/domain/github-app, repofy-backend/src/domain/analysis, and repofy-backend/src/worker. These paths are proposals, not claims that files exist.

Use an additive /api/v1 namespace for new APIs. Existing frontend requests already use /api as their base, so a hook requests /v1/analyses rather than /api/v1/analyses. Proposed private web routes are /readiness, /readiness/new, /readiness/jobs/[jobId], and /readiness/[reportId]. Decide and document names in Run 01, then keep them consistent.

Keep completed report content immutable. Mutable preferences, feedback, access grants, deletion/revocation status, and comparison views must not silently rewrite it. A branch is resolved to an exact SHA before extraction; retries never drift to a newer default-branch head.

Separate canonical observations from user-scoped analysis membership and authorization. A repository's existence in the database is never evidence that a requester can read it. Service-role database access still requires explicit policy checks.

## Decisions to resolve before dependent work

| Decision | Owner run | Starting recommendation |
|---|---|---|
| Shared package build and deploy inclusion | 01 | Small installable package compatible with both existing builds; avoid a broad monorepo conversion |
| Migration history and new-migration directory | 02 | Preserve both histories; document a deterministic baseline and one location for new work |
| Private locator retention and encryption | 02 | Retain minimal encrypted locators; retain no raw source by default; document key handling and deletion |
| Exact taxonomy, role weights, strength thresholds | 03 | PRD backend weights plus calibrated drafts for the other four roles |
| GitHub App permissions and organization eligibility | 04–05 | Selected repositories, read-only permissions, verified user/installation relationship |
| Parser and secret-scanner dependencies | 06, 09–10 | Static, bounded parsing; verify maintained primary documentation during implementation |
| Durable worker mechanism | 07 | Existing PostgreSQL as durable truth; choose worker claiming/leases or a queue adapter in an ADR |
| Feature 1 charge policy | 07 | No unapproved pricing changes; internal trials can be free while exercising a billing adapter in tests |
| Coverage denominator and partial scans | 10–11 | Explicit unknown/limited states; incomplete analysis must not inflate readiness |
| Model adapter and provider retention | 12 | Minimum structured evidence context; no unverified provider guarantees |
| Candidate-reported input | 13 | Typed and clearly labeled, but no new professional-claims editor unless separately scoped |
| Feedback review and provenance calibration | 15 | Non-punitive uncertainty; reviewer workflow with controlled access |

Resolve routine technical choices in an ADR within the run. If an external credential or product decision is genuinely unavailable, finish the independently verifiable work and name the specific remaining dependency. Do not call a mocked external integration complete.

## Working agreement for every run

1. Read this index, the assigned plan, the relevant PRD sections, and prerequisite handoffs. Reinspect current code; plans are grounded in the planning snapshot rather than guaranteed future file layouts.
2. Reference requirement IDs in the implementation description. Separate intended behavior, exclusions, database/API impact, and external setup.
3. Keep work additive and focused. Do not migrate old reports into verified evidence without reanalysis. Do not add Features 2–6, candidate ranking, or automatic employment recommendations.
4. Implement server authorization and privacy at the boundary. Tokens, source, secret matches, and private excerpts must not enter ordinary logs, telemetry, client caches shared across users, or fixtures.
5. Add meaningful verification with the change: fixtures and failure cases begin in early runs. Run 16 consolidates evidence; it is not the first time security or correctness is tested.
6. Record feature-flag state, database changes, rollback/recovery instructions, unresolved decisions, and the next run's stable interfaces. Do not enable public access merely because an individual run passed.

## Verification commands and limits

Current package scripts support these commands, each run from its package directory:

| Package | Commands |
|---|---|
| Backend | npm run typecheck; npm test -- relevant-test-file; npm run build |
| Frontend | npm run lint; npm test -- relevant-test-file; npx tsc --noEmit; npm run build |
| Frontend E2E | npm run test:e2e -- relevant-spec-file |

The semicolons above separate examples, not a request to chain them in a shell. Use focused checks during a run and required affected-package checks before completion. Add explicit scripts for the shared package, worker, migrations, and benchmark where needed. PGlite is useful for constraints, but does not replace real PostgreSQL multi-connection locking tests or real Supabase authorization checks. Do not run tests against production or perform real paid/model calls as part of ordinary fixtures.

## Scope and completion gates

- Runs 01–13 target the core P0 developer slice; release remains gated by verification.
- Runs 14–15 complete ANA-015 through ANA-019 P1 scope and must not be silently omitted from the final Feature 1 claim.
- Run 16 verifies the integrated result and records measured results and remaining blockers.
- ANA-020, creating GitHub issues with separate write permission, is deferred P2 work. It is intentionally outside these sixteen plans.
- Feature 1 creates private owner-visible reports only. Public profiles, employer access, job-description matching, Repo Defense, and hiring submissions have later feature plans.
- PRD section 32 includes whole-product public-launch gates involving profile disclosure. This folder alone cannot satisfy Feature 2's publishing tests or authorize the full developer-product launch. Distinguish an internal Feature 1 rollout from the complete product release.

## How to request the next run

> Implement Run 01 from feature one implementation/01-feature-flags-and-contracts.md. Read the folder README and referenced PRD requirements first. Complete the scoped deliverables and acceptance checks, preserve unrelated work, and record the handoff. Keep unimplemented product surfaces disabled.

Replace the run number and filename for each subsequent run. These plans do not require sixteen simultaneous windows or parallel agents.
