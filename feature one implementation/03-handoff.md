# Run 03 handoff — Capability taxonomy and five role rubrics

**Status: complete for the scoped taxonomy/rubric foundation.** Verified September 14, 2026 (America/New_York). Feature 1 flags remain unchanged and default off. No remote database was changed. Run 04 is next.

## Delivered scope

ANA-006 and ANA-009–012 now have explicit domain definitions: **34 capabilities in fourteen PRD categories, five versioned rubrics with 50 weighted requirements, and 15 improvement templates**. Backend weights match PRD 17.2 exactly; the other four sets and all required/optional thresholds are documented hypotheses. This is the definition/persistence/discovery foundation for these requirements, not a completed analysis or role-readiness workflow.

Dependency and configuration presence cannot satisfy implementation requirements. Compound requirements require all named capabilities with explicit strength, confidence, assessability and independent-corroboration policies. Missing coverage remains unknown, with its weight retained in the denominator. Strength labels preserve the PRD bands; confidence is independent and has no invented numerical calibration in this run. Claim scopes, limitations, useful improvements and acceptance evidence are attached to each capability.

All roles remain **uncalibrated**, **definitions_only**, and **externalRollout: false**. No production detector, model adapter, worker, UI role selector, employability score or pricing change was added. Human review is pending under the [benchmark protocol](../docs/benchmarks/rubric-calibration.md). The protocol records how Run 16 should recruit reviewers and measure judgments; no review has been performed or scheduled here.

## Stable interfaces and decisions

| Interface | Location / meaning |
|---|---|
| Initial release | `readiness_1_0_0` |
| Taxonomy | `engineering_capabilities@1.0.0`; [taxonomy.v1.json](../repofy-backend/src/domain/rubrics/manifests/taxonomy.v1.json) |
| Roles | `backend`, `frontend`, `full_stack`, `mobile`, `ai_application`, all `1.0.0`; [manifests](../repofy-backend/src/domain/rubrics/manifests) |
| Runtime contracts | [rubrics.ts](../packages/contracts/src/rubrics.ts): taxonomy, capability, role requirement, role rubric, catalog and discovery schemas; existing small Run 01 schemas remain compatible |
| Reference policies | [policy.ts](../repofy-backend/src/domain/rubrics/policy.ts): `evaluateRequirement`, `strengthBand`, `confidenceLabel`; consumes normalized synthetic inputs, does not extract or aggregate real evidence |
| Requirement identity | `requirementId === capabilityId` is the stable anchor used by Run 02; `capabilityIds` contains every required component, including the anchor |
| Discovery | Authenticated `GET /api/v1/role-rubrics` and `/api/v1/role-rubrics/:releaseId`; normal success envelope containing `RubricDiscoveryResponseSchema`, private/no-store, master-flag gated |
| Service repository | `RubricRepository.read(actor, releaseId?)`; validates the actor and returned database manifest; no static fallback |
| Database read | `feature_one_read_rubric_catalog(p_actor, p_release_id)`; service-only, active release when ID is null, historical immutable release otherwise |
| Seed validation | Backend `npm run rubrics:validate`; checks runtime semantics and exact source/SQL parity in CI |

[ADR 0003](../docs/adr/0003-capability-taxonomy-and-role-rubrics.md) explains all five weight sets, required `.55`/moderate-confidence and optional `.40`/low-confidence starting thresholds, independent evidence, full denominator policy, claim boundaries, version transitions and current language limitations. Requirements with a strong minimum always need independent tests or exercised CI. Versioned confidence-number mapping remains Run 11's responsibility.

Run 11 must use the detailed manifest schemas and every component policy, rather than the smaller Run 01 `RoleRubricSchema` or just the anchor. It must also validate actual detector coverage and provenance before using the reference evaluator. Run 12 must bind improvement templates and allowed scopes to real evidence/gaps; schema-valid text alone is not a verified claim.

## Capabilities awaiting detector coverage

Every capability below is pending. Planned-run metadata is a dependency pointer, not a claim of implemented support.

| Category | Pending capability keys |
|---|---|
| Languages/frameworks | `language_presence`, `framework_presence` |
| Frontend | `frontend_interaction`, `frontend_accessibility`, `frontend_state` |
| Mobile | `mobile_lifecycle`, `mobile_navigation`, `mobile_offline` |
| Backend/API | `api_design`, `api_boundary_validation` |
| Data | `data_modeling`, `data_transactions` |
| Architecture | `architecture_modularity`, `architecture_boundaries` |
| Testing | `testing_behavior`, `testing_failures` |
| Reliability | `reliability_recovery`, `reliability_concurrency`, `performance_resources` |
| Security | `security_authorization`, `security_input_handling`, `security_secrets` |
| Delivery | `delivery_automation`, `delivery_reproducibility` |
| Observability | `observability_diagnostics`, `observability_health` |
| AI applications | `ai_integration`, `ai_context`, `ai_evaluation`, `ai_safety` |
| Documentation/collaboration | `documentation_operability`, `documentation_decisions` |
| Provenance | `provenance_history`, `provenance_origin` |

TypeScript/JavaScript and the listed web/config ecosystems have planned deep support, Python/Java baseline, and other languages inventory only. React Native, Swift, Kotlin and Dart have no delivered mobile semantic support. The discovery response carries these limitations for all five roles. Provenance and technology signals are excluded from weighted behavior requirements.

## Migration, rollback and operational boundaries

Apply the two new root migrations after Run 02: `20260913000400_rubric_registry.sql`, then `20260913000500_initial_rubrics.sql`, using the documented [migration runner](../docs/database.md). They add immutable taxonomy/release registries, an active pointer, full role/requirement definitions and relational component memberships. The initial seed supplies all five roles and bootstraps the pointer only if absent.

Published definitions reject updates/deletion/extensions; imports reject conflicting content under an existing version. Exact repeated imports are idempotent and never reset the active pointer. Only the migration owner can import or activate a release. Service-role and browser roles cannot mutate or directly read registry tables. The service read RPC requires an existing authenticated actor supplied by the backend.

To recover, keep Feature 1 flags off and use `feature_one_private.activate_rubric_release` from the migration connection to restore a previously published release. Keep newer versions for reports that already reference them. Do not edit applied seed bytes or delete/reinsert definitions. New identities start at `1.0.0`; forward imports support one patch increment or one minor increment with patch reset. Major changes, prereleases, skipped versions and regressions require a new adapter/migration. Reusing an unchanged version is allowed.

No external credentials or provider setup are needed for this run. Future deployment must apply the migrations before enabling internal discovery; public readiness remains unavailable regardless of successful seed installation. Safe operational records need only release/taxonomy/rubric version identifiers. Existing user data and prior checkout edits are preserved. Test-only rubrics now use `0.0.1` so they cannot collide with production `1.0.0` role keys.

## Verification

Verification used Node **22.23.2** and isolated PostgreSQL **17.11**. Both applications were freshly installed from their existing lockfiles with compiled contracts included. Run 03 adds no dependencies or dependency upgrades.

| Check | Result |
|---|---|
| Contracts typecheck, build and test | Passed; 56 contract checks, including CJS/ESM compatibility |
| Backend manifest/seed validation | Passed; exact validated JSON/SQL parity |
| Backend typecheck and build | Passed |
| Backend full suite with coverage | Passed; all 67 test files, unchanged thresholds. Statements 82.23%, branches 75.93%, functions 83.38%, lines 83.09% |
| Real PostgreSQL suite | 37/37 passed, including immutable publication and active-release rollback |
| Frontend lint, typecheck and production build | Passed; one existing unused-import lint warning and existing Next/Sentry warnings remain |
| Frontend full suite with coverage | Passed; all 80 test files, unchanged thresholds. Statements 80.87%, branches 74.61%, functions 77.00%, lines 82.11% |
| Production readiness HTTP smoke checks | 8/8 passed; unfinished user flows remain unavailable |

New rubric tests cover missing/duplicate keys, negative/NaN/infinite/zero weights, invalid totals and thresholds, unsupported versions, invalid PRD attribution, technology-only evidence, compound all/minimum semantics, duplicate corroboration, unknown coverage and long readable labels. Authenticated HTTP tests cover disabled/anonymous/invalid-session requests, active and historical discovery, absent seeds/releases, rejected writes/invalid inputs and sanitized provider errors. Existing legacy, ownership, deletion/export and disabled-boundary checks continue to pass. Hosted provider E2E was not run; it requires external accounts and is outside this run's scoped definition checks.

Real PostgreSQL checks cover fresh/upgraded/replayed and partially deployed migrations, independent roles/subjects, seed parity, composite reference FKs, repeated imports, immutable definitions, invalid weights/thresholds, unsupported transitions and active-pointer rollback. A synthetic report pinned to the real production taxonomy/role versions remains byte-for-byte unchanged after activating a newer release and rolling back. These checks do not establish hosted Supabase Auth/PostgREST behavior, detector accuracy or human calibration.

## Next run

Run 04 can build GitHub App authorization and repository discovery against the preserved Run 01–02 contracts. It can use authenticated rubric discovery later in the picker; it must not interpret the presence of all five role definitions as available analysis. Runs 08–10 implement coverage/detectors, Run 11 implements full aggregation, Run 12 validates narrative/improvements, Run 13 delivers the UI, and Run 16 owns measured human calibration and rollout approval evidence.
