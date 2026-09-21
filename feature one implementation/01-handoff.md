# Run 01 handoff — Feature flags and shared contracts

**Status:** Complete, September 13, 2026. Feature 1 remains unavailable. Runs 02–16 have not been implemented by this run.

## Delivered behavior and requirement scope

CORE-005's Feature 1 boundary is implemented: backend flags default off, safe capabilities are mirrored to server-rendered navigation, reserved API writes perform no domain/provider work, and all four private web paths have a defined unavailable state. CORE-003 is satisfied for this boundary by denying unfinished operations; real owner/repository/report authorization still requires Run 02 and later handlers. ANA-005/007/012/014 have shared structural foundations, not a completed user analysis workflow. The remaining ANA-001–014 behavior is still assigned to later runs.

The existing analyze route stays disabled and legacy report/advice contracts are unchanged. No repository ingestion, worker, detector, model call, database mutation, billing change or public sharing endpoint was added.

## Stable interfaces

| Area | Export / location |
|---|---|
| Runtime package | `@repofy/contracts` from `packages/contracts`, version `1.0.0`; compiled CommonJS + declarations, supports ESM/bundler consumption |
| Identity and selection | `VerifiedIdentityReferenceSchema`, `RepositorySelectionSchema`, `AccessAttestationSchema`; provider IDs are strings, application IDs are branded canonical UUIDs |
| Snapshot and coverage | `RepositorySnapshotSchema`, `OwnerSnapshotSchema`, `AnalyzerCoverageSchema`, `InventorySummarySchema` |
| Evidence | `InternalEvidenceObservationSchema` from `/internal`; `OwnerEvidenceSchema`, `GeneralizedEvidenceSchema`, `ContributionUncertaintySchema` |
| Capability and roles | `CapabilityDefinitionSchema`, `CapabilityAssessmentSchema`, `RubricRequirementSchema`, `RoleRubricSchema`, `RoleResultSchema` |
| Narrative/report | `ClaimSchema`, `GapSchema`, `ImprovementSchema`, `ReadinessReportResponseSchema`; exactly five distinct roles; unknown states carry no numeric assessment |
| Jobs/requests | `StartAnalysisRequestSchema`, `AnalysisJobResponseSchema`, `AnalysisProgressSchema`; distinct job, attempt, run and report IDs; safe stage/progress/failure metadata |
| Semantic/persistence boundary | `ReadinessDomainValidator.authorizeSelection` and `.validateReport`; no permissive default implementation |
| Idempotency | `canonicalAnalysisRequest` in backend `src/domain/analysis/request.ts`; hashes parsed normalized inputs; Run 02 supplies transactional user/operation/key uniqueness |
| Errors | v1 retains string `error` and adds `code`, `retryable`, `requestId`; frontend `ApiError` retains message/status and auth refresh behavior |
| Capabilities | `GET /api/v1/capabilities`, `ClientCapabilitiesSchema`; never includes integration credentials |
| Fixtures | `createSyntheticEvidenceFixture` and `createSyntheticReportFixture` from `/testing`; same fixture parsed by both apps, never emitted by production routes |

[ADR 0001](../docs/adr/0001-evidence-foundation.md) records namespace/route names, version dependencies, worker architecture, package/deployment configuration, privacy boundaries, and the exact external-engine integration gap.

## Verification

Clean verification used a separate source copy without `node_modules`, compiled artifacts, or local environment files, with Node **22.23.2** and npm **10.9.9**. Contracts were installed/built first, followed by independent application `npm ci` installs. No dependency versions were upgraded; lockfiles add contracts and the backend's Zod dependency.

| Check | Result |
|---|---|
| Contracts `npm run typecheck`, `npm test` | Passed; 56 valid/invalid contract checks |
| Contracts packaging / CJS / ESM | Compiled exports/declarations present; runtime imported by both apps; installed copies, not source aliases |
| Backend `npm run typecheck`, `npm run build` | Passed |
| Backend `npm test -- --coverage` | 603 tests passed; all existing coverage thresholds passed |
| Frontend `npm run lint`, `npm run typecheck`, `npm run build` | Passed; lint retains one pre-existing unused-import warning in `query-client.test.ts` |
| Frontend `npm test -- --coverage` | 535 tests passed; all existing coverage thresholds passed |
| Frontend `npm run test:e2e:readiness` | 8 production-build HTTP smoke checks passed across index, selection, job and report paths |
| Disabled/enabled API matrix | 39 integration checks cover disabled writes/reads, child switches, still-unimplemented enabled switches, CSRF, legacy analyzer, safe errors and zero external work |
| Existing authenticated provider E2E | Not run; needs dedicated external account/Supabase configuration and remains non-blocking in the existing workflow |

Negative checks cover unsupported versions, missing/foreign evidence, commit mismatch, private internal fields in owner/generalized projections, excessive arrays/text, score/coverage bounds, impossible timestamps/line ranges, unverified labels, and unknown states with scores. Refreshed requests preserve body/CSRF/correlation and schema validation. Malformed v1 JSON containing a sentinel is neither echoed nor logged. These are synthetic boundary checks, not proof of provider authorization or real model integration.

Two existing verification issues were corrected while preserving the current app configuration: the backend's port test now expects the user's `3101` default, and a Vitest module declaration types the already-installed accessibility matcher. No existing coverage thresholds or tests were disabled. Next/Sentry retain existing deprecation warnings.

## Flags, privacy, migration and recovery

All four flags default to **false**: `FEATURE_ONE_ENABLED`, `GITHUB_APP_REPOSITORIES_ENABLED`, `RESCANS_ENABLED`, `FINDING_FEEDBACK_ENABLED`. The tests also verify synthetic enabled combinations. No deployed flag settings were changed. With flags disabled APIs return 503 `FEATURE_DISABLED`; enabled-but-unimplemented APIs return 501 `FEATURE_NOT_IMPLEMENTED`. Both are non-retryable. All v1 responses are private/no-store. Page routing remains unavailable even if configured flags are true.

Strict schemas keep tokens, unrestricted source and archive/worker locations out of responses. They cannot detect secret text or validate semantics; future security filtering, projection and transactional domain checks remain mandatory. Internal locators are not an authorization grant. Persisted private locator encryption/retention is deliberately owned by Run 02. No new database objects or cleanup jobs exist, so rollback requires no data migration: keep flags off and revert new consumers/package wiring together if needed. Preserve unrelated checkout changes and existing report/advice contracts.

CI now includes shared-package and root-migration path filters, a contracts check, correct install/build ordering, frontend typechecking, and a blocking local readiness smoke test. Deployment requires the full sibling-package build context and contracts compilation before installing an app; Railway/Vercel instructions are in the ADR. Hosting settings were documented, not changed.

## Next run and remaining dependencies

Run 02 should reuse these IDs, snapshot/version fields, private report schema and canonical request hash, then implement the domain validator against real database ownership and membership. Choose the authoritative migration location/order, locator encryption and retention, immutable artifacts, idempotency uniqueness, account export/deletion, and transactional finalization. A schema-valid synthetic report alone must never bypass these checks.

Run 04 needs real GitHub App credentials/permissions and verified installation/user associations. Run 07 needs a separate durable worker; narrow future intake flags so maintenance/cancellation/deletion still work when intake is off. Run 12 needs a verified real model adapter: the checkout contains only a client for legacy `/analyze` and `/advice`, not the external engine's implementation or the new model contracts. Public rollout and the integrated authorization/quality/privacy guarantees remain gated by the later runs.
