# ADR 0001: Evidence foundation and disabled Feature 1 boundary

Accepted: September 13, 2026. Scope: Run 01, CORE-003/CORE-005 foundations and ANA-001–014 contracts, especially ANA-005/007/012/014. This decision does not deliver repository analysis or authorize rollout.

## Decision

Keep the existing Express and Next.js applications and their separate npm lockfiles. Add `@repofy/contracts` in `packages/contracts`, using Zod 4.3.6 and inferred TypeScript types. Compile ES2022 CommonJS JavaScript and declarations into `dist`; export the runtime and declarations through `main`, `types`, and explicit package `exports`. `typesVersions` supports the backend's existing Node/CommonJS resolver for subpaths. No cross-package source alias, root workspace conversion, or change to the backend's `rootDir` is needed.

Both applications depend on `file:../packages/contracts`. Each application commits `.npmrc` with `install-links=true`, so npm packs a real copy into its `node_modules`, including the contracts' runtime Zod dependency. The installed application can run without a sibling source checkout. Rebuild contracts **before** installing applications; reinstall applications after contract edits. This follows npm's documented [install-links behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci/#install-links) and [package files rules](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files). Strict objects and discriminated unions use [Zod's runtime schemas](https://zod.dev/api).

`@repofy/contracts` exports shared primitives, selection/identity/attestation/snapshot schemas, inventory and coverage, owner evidence, contribution uncertainty, capabilities/rubrics, claims/gaps/improvements, readiness reports, jobs, requests, errors and capability flags. `@repofy/contracts/internal` exports internal locators/observations, constrained model evidence, and the domain-validation interface. `@repofy/contracts/testing` contains synthetic fixtures used by both applications' tests; production imports must never reference this subpath. There is no route that emits synthetic evidence or reports.

## Identity, versions, and ownership

All application entity IDs are canonical lowercase UUIDs with distinct TypeScript brands. Provider user/repository IDs are positive decimal strings (never rounded JavaScript numbers). GitHub commits are full lowercase 40-character SHAs; PRD abbreviated examples are display values only. Timestamps are UTC ISO strings with required seconds and optional fractional seconds. Identifiers, strings, arrays, scores, counts and line ranges have runtime bounds. Every object rejects unexpected fields.

| Identifier | Meaning |
|---|---|
| `jobId` | Logical user request, stable through duplicate submissions and retries |
| `attemptId` | A single execution attempt; never reused by another attempt |
| `analysisRunId` | Immutable computation/artifact membership with fixed snapshots and versions |
| `reportId` | One completed immutable private report |
| `snapshotId` | Canonical repository/commit/extraction-policy artifact, separate from a user's grant |
| `repositoryId` | Canonical provider repository identity; never an access grant |

The version dependency manifest requires contract, snapshot identity, extractor bundle, detector bundle, coverage manifest, aggregation policy, taxonomy, all five role rubrics and disclosure policy. A model-generated result also requires prompt and provider/model identifier/version. Deterministic-only results explicitly record `synthesis.kind = not_used`; a missing model is never represented as a successful integration. Each snapshot records its extraction policy separately; each observation records its detector version. Rubric templates and scoring policies are defined/calibrated in Run 03, not by synthetic fixtures.

Canonical observations can be reused only through explicit user-owned run membership. Run 02 must enforce ownership through user → verified GitHub identity → installation → active repository grant and current attestation, plus job/run/snapshot/evidence membership. A provider identity string and a schema-valid UUID do not prove ownership. Verified identity records have no display-name-based authority.

The report schema checks self-contained membership, matching commits, distinct roles and dependency versions. It cannot prove database membership, active grants, detector validity, semantic support, authorization, redaction, or completed execution. `ReadinessDomainValidator.authorizeSelection` and `validateReport` define those obligations without a permissive implementation. Run 02 implements them at the transaction boundary, including ownership and version checks; later runs add semantic/quality rules. Never finalize solely because `parseReadinessReport` succeeds.

## Evidence and privacy

Source type (code, test, configuration, documentation, commit, PR, CI, dependency), repository visibility (public/private), owner-only disclosure, confidence, relevance, strength and contribution uncertainty are separate fields. Dependency presence is not proof of implementation. An `unknown` assessment cannot carry a zero score; an explicit `not_observed` result cites analyzed coverage and does not assert lack of skill. Positive assessments and verified claims require evidence references. Unverified statements have a distinct discriminator, basis and literal `Unverified` label. All five roles must appear, including honest unknown results.

Internal observations may contain bounded relative locators in process memory, but no unrestricted source blob, archive address, installation token or worker credential. Owner projections remove internal locator IDs, paths and fingerprints and may contain only authorized/redacted display labels and line ranges. The reserved generalized projection excludes repository/snapshot/evidence IDs, commit hashes, paths, lines and fingerprints. No public endpoint or sharing transformer is implemented.

Strict schemas reject unexpected sensitive fields; they **do not detect secrets embedded in allowed text or establish that summaries are safe**. Run 06 must filter source before extraction/model use; Run 12 must validate claims and redaction. Run 02 chooses encryption and retention for persisted private locators. Fingerprints are keyed HMAC-SHA256 with a key version; unkeyed private path/content hashes are not anonymous. Do not log entire Zod errors, requests, fixtures, locators, model output or source. New v1 parser/unhandled errors are handled before generic logging/Sentry using only safe request/version/status metadata.

## HTTP and UI boundary

Use `/api/v1` on Express. Browser/SSR clients already have `/api` as their base, so callers use `/v1/analyses`, not `/api/v1/analyses`. Reserved resources are:

- `GET /api/v1/capabilities`: safe, non-user-specific capabilities in the existing `{ success: true, data }` envelope.
- `/api/v1/github/installations`, `/api/v1/repositories`: later installation/discovery/selection handlers.
- `/api/v1/analyses`, `/:jobId`, `/:jobId/cancel`, `/:jobId/evidence`, `/:jobId/readiness`, `/:jobId/rescan`, `/:jobId/feedback`: logical job resources.
- `/api/v1/readiness-reports/:reportId`: immutable report resources.

The private web routes are `/readiness`, `/readiness/new`, `/readiness/jobs/[jobId]`, and `/readiness/[reportId]`. They currently share an explicit unavailable page and the existing sign-in route guard. No object is fetched or written. Navigation hides Readiness unless server capabilities explicitly say it is available. Cookies alone control the existing page redirect; they never authorize future report data.

| Backend environment variable | Safe response field | Default |
|---|---|---|
| `FEATURE_ONE_ENABLED` | `featureOneEnabled` | false |
| `GITHUB_APP_REPOSITORIES_ENABLED` | `githubAppRepositoriesEnabled` | false |
| `RESCANS_ENABLED` | `rescansEnabled` | false |
| `FINDING_FEEDBACK_ENABLED` | `findingFeedbackEnabled` | false |

Only literal `true`/`false` are accepted; unset means false. The master switch suppresses all child capabilities. `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_WEBHOOK_SECRET` are required only when both master and repository integration flags are enabled. Inject keys through the deployment's managed secret service. Run 04 validates real app permissions, key handling and provider setup. Existing `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET` OAuth login requirements remain unchanged.

Disabled reserved endpoints, including nested routes and writes, return HTTP 503 `FEATURE_DISABLED`, with `retryable: false`. Even when flags are configured true, unfinished handlers return HTTP 501 `FEATURE_NOT_IMPLEMENTED`; capabilities report `not_implemented`, and navigation remains hidden. The reserved web paths return an unavailable page (HTTP 200 after sign-in), with no submission controls. Server flags are loaded at process startup; restart/redeploy applies changes. There are no client environment overrides. Future handlers must add authentication and per-resource authorization after intake gates. Run 07 must narrow gates to intake so cleanup, settlement, cancellation and deletion continue when intake is disabled.

All v1 responses use `Cache-Control: private, no-store` and a safe `X-Request-Id`. Errors preserve `{ success: false, error: "message" }` and add `code`, `retryable` and `requestId`. CSRF and rate-limit failures receive the same additive fields. Existing routes preserve their original success/data and string-error shapes. The frontend retains `ApiError.message/status`, adds optional machine fields, retries authentication once, reuses the original body/headers (including CSRF), and runs the same response schema on initial and refreshed successes. No changes enable `/api/analyze` or reinterpret old reports.

## Idempotency convention

`StartAnalysisRequestSchema` accepts only contract version, 1–10 unique repository IDs, an optional `{ roleId, version }` template reference, bounded boolean metadata options, and an 8–128 character ASCII idempotency key. Omitted metadata is false. Identity, grants, status, snapshots/SHAs, prices, confidence, evidence and request hashes are server-owned.

`canonicalAnalysisRequest` parses input and hashes an ordered serialization with sorted, normalized repository IDs, explicit metadata defaults and the role reference. It excludes the idempotency key. Run 02 must persist uniqueness on **authenticated user + operation + idempotency key** in a transaction. Matching key/hash returns the same logical job; matching key with a different hash returns HTTP 409 `IDEMPOTENCY_CONFLICT`. Concurrent duplicates must converge through a database constraint; this run provides no in-memory idempotency store. Freeze server-resolved versions and commits when accepting/initializing the job; retries must reuse those artifacts. Reauthorization is still required for retries and existing-resource responses. Run 07 adds worker leases and settlement.

## Worker and external engine boundary

The future worker is a separate process under `repofy-backend/src/worker`, using the same built contracts and backend domain modules, with durable database claims/leases from Run 07. It must not run in an API request or rely on the existing in-memory `distributed-lock.ts`. It statically processes a commit-pinned, bounded ephemeral workspace; it never installs, builds or executes repository code.

The current `services/engine.service.ts` is only an HTTP client. It accepts `/analyze` or `/advice`, sends `{ githubData }` with `X-Internal-Key` to `ENGINE_URL`, applies spending/payload/retry controls, and casts returned JSON to caller-provided TypeScript types. `/analyze` callers expect `scorerResponse`, `scoringResult`, `narrativeReport` and optional `tokenUsage`; `/advice` expects `advice` and optional `tokenUsage`. These contracts contain legacy profile scoring and are not evidence readiness contracts. The source of the external engine is unavailable in this checkout (`repofy-engine/` is ignored).

Run 12 must deliver or inspect a real model adapter that consumes constrained, filtered evidence, accepts allowed evidence IDs and versions, validates structured narrative output and claim scope, records provider/prompt/model/input/usage/latency/validation metadata, and verifies retention/privacy behavior. Existing endpoint responses, mocks and configuration names are not evidence that this integration exists. No model/provider calls or pricing changes are part of Run 01.

## Build and deployment

Use Node 22 for CI/deployment. Starting at the full repository root:

```bash
npm --prefix packages/contracts ci
npm --prefix packages/contracts run build
npm --prefix repofy-backend ci
npm --prefix repofy-frontend ci
npm --prefix repofy-backend run build
npm --prefix repofy-frontend run build
```

Application `.npmrc` files must remain present at install time; don't substitute symlinks or a source path alias. Do not publish an empty/stale `dist` directory. `npm pack --dry-run` from contracts verifies the package includes compiled JavaScript/declarations. Build output is ignored by Git and generated before installation in each CI application job. No Next.js `transpilePackages` or external-source setting is necessary because the installed package is already compiled and self-contained.

For Railway, retain repository-root build context and execute the contracts install/build before the backend install/build above. Start with `npm --prefix repofy-backend start`; a packaged backend runtime needs its own `dist`, `package.json`, and production `node_modules` (which includes contracts and Zod). Do not use a service configuration that uploads only `repofy-backend` before building the sibling dependency. Railway documents the directory restriction and custom commands in its [monorepo guide](https://docs.railway.com/deployments/monorepo).

For Vercel with Root Directory `repofy-frontend`, enable inclusion of files outside the Root Directory in the build context, as described in the [Vercel monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq#can-i-share-source-files-between-projects-are-shared-packages-supported). Set Install Command to `npm --prefix ../packages/contracts ci && npm --prefix ../packages/contracts run build && npm ci`; keep Build Command `npm run build`. Alternatively, provide a prepacked/versioned contracts artifact in the build pipeline. Include `packages/contracts/**` in deployment change detection; skip-build rules restricted to the frontend/backend directories must be updated. No deployment was performed in this run.

CI contract changes trigger the `contracts`, backend and frontend checks. Root migration changes trigger backend checks. The contracts job runs typechecking and negative/positive fixtures; application jobs build contracts before installing applications. Existing Playwright remains non-blocking and requires external auth credentials; Run 16 owns making the integrated release gates blocking. The focused Run 01 unavailable-route smoke test requires no real provider credentials.

## Migration and recovery

No database mutation or migration. Disable feature flags and restart services to keep intake unavailable. If rolling code back, remove only new consumers and package dependencies together; preserve old report/advice interfaces and unrelated checkout changes. Regenerate lockfiles using the corresponding manifests and install-link setting. Later immutable evidence records must not be converted from legacy scores without reanalysis. Run 02 owns migration ordering, retention/encryption, RLS, membership constraints and transactional finalization.
