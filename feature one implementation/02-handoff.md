# Run 02 handoff — Database, ownership, and immutable versions

**Status: complete for the scoped persistence foundation.** Verified September 13, 2026 (America/New_York). Feature endpoints remain disabled. No remote database was changed. Run 03 is next.

## Delivered behavior and requirement scope

An authorized synthetic analysis across two repositories can be persisted and finalized as exactly one private report. Real PostgreSQL checks prove owner reads, missing/foreign equivalence, denied anonymous/direct canonical access, server-only mutations, user/identity/installation/grant binding, explicit run/snapshot/evidence membership, compatible capability/rubric versions, and immutable completed content. Analysis/account deletion and account export cover the new data, including shared canonical observations and pending jobs.

| Requirements | Delivered here | Later integration |
|---|---|---|
| CORE-003–004 | Owner RLS, scoped service RPCs, verified-identity bindings, recorded attestation/version/time and safe audit events | Real provider verification, selection/consent flows, webhooks |
| ANA-002–003 | Immutable SHA/encrypted branch provenance, versioned snapshots/runs, durable idempotency keys/hashes, checked terminal states and unique reports | Actual ingestion, durable workers, retries/fencing/progress and billing |
| ANA-005–007 | Canonical observations, versioned mappings, relational nested claim/assessment citations, strict report validation | Real extractors, calibrated aggregation, semantic/model checks |
| CONS-006 | Extended export, analysis deletion, account cascades, shared-data cleanup and bounded maintenance function | Workspace cleanup/scheduler, finding feedback, deployment backup/provider policies |

These are scoped foundations, not completion claims for the full ANA workflows.

## Stable interfaces

[`EvidenceRepository`](../repofy-backend/src/domain/analysis/persistence.ts) accepts a Supabase-compatible RPC client. Every user operation requires the authenticated actor. It validates input, encrypts locators before transport, sanitizes database errors and validates returned reports. No feature controller invokes these writes yet.

All SQL entry points have the `feature_one_` prefix and are service-only:

| Method / RPC suffix | Result and boundary |
|---|---|
| `bindVerifiedGrant` / `bind_grant` | Server-verified provider facts + attestation → identity/installation/repository/grant UUIDs; checks legacy/new identity conflicts, but does not itself verify GitHub |
| `storeSnapshot` / `store_snapshot` | Actor, grant, validated bundle, injected `LocatorCrypto` → canonical snapshot UUID; atomic sealing and an independent user receipt |
| `createJob` / `create_job` | Strict request and grant IDs → job UUID; identical actor/key/hash replays; changed hash conflicts |
| `createRun` / `create_run` | Queued job, full version dependencies, own receipted snapshots → run/attempt UUIDs; pins five rubrics and explicit memberships |
| `finalizeReport` / `finalize_report` | Parsed report → report UUID; locks job, validates provenance, writes citation edges/assessments/status/audit atomically; duplicate publication rejected |
| `readReport`, `listReports` / `read_report`, `list_reports` | Report/null or metadata list; foreign and missing IDs behave identically |
| `revokeGrant`, `cancelJob`, `deleteAnalysis` | Scoped void operations; terminal cancellation, no future work through revoked access, transactional deletion |
| `exportUserData` / `export` | Safe owner projections of every new retained data family |
| `prune_retention` | Maintenance: abandoned receipts older than 24 hours, audit older than 90 days, orphan canonical cleanup |

Cross-reference FKs validate at transaction commit. A future SQL client must await commit before acknowledging publication. No direct service-role table DML is permitted. Attempts, model observability and job status are scaffolding; leases, retries, worker claiming, model calls, billing and progress updates are not implemented.

Account export adds `evidence_analysis`. Account deletion still invokes Supabase Auth `deleteUser`; new FKs and a deferred trigger clean up Feature 1 data. Existing reports/advice/profiles/credits are not converted or repurposed.

## Seeds, fixtures and dependent work

Production taxonomy/rubric tables are intentionally empty. Run 03 should add versioned root seed migrations for `capability_definitions`, `role_templates`, and `role_requirements`. All five roles must exist, reference the run taxonomy, and each role's weights must total one. Do not edit the meaning of an existing version.

[`tests/helpers/evidence-fixtures.ts`](../repofy-backend/tests/helpers/evidence-fixtures.ts) supplies `grantFacts`, `snapshotBundle`, `multiRepositoryReport`, and a test-only keyring built on shared Run 01 fixtures. PostgreSQL fixtures seed only a synthetic taxonomy/five rubrics in temporary databases.

Canonical reuse returns the original snapshot ID: its original observations/evidence IDs win over those in a discarded duplicate bundle. Run 06 should read those persisted observations, add an efficient actor/grant-scoped worker projection if needed, and capture each retrieval's branch provenance. A repository grant alone cannot attach another user's snapshot; independently verified ingestion/reuse must create a receipt first.

Full `ReadinessDomainValidator` semantic/disclosure/quality gates remain required in Runs 08–12. Strict schemas and relational support are not proof that generated prose accurately describes code. No permissive domain validator or production fixture route was added.

## Operations and decisions

- [Database operations](../docs/database.md): exact historical order, empty duplicates, the checked redundant FK repair, baseline adoption, secure partial deployment and forward recovery.
- [ADR 0002](../docs/adr/0002-evidence-persistence-and-retention.md): entity diagram, policy matrix, encryption/key handling, canonical ownership and retention/deletion semantics.
- New migrations: `supabase/migrations/20260913000100_*`, `20260913000200_*`, `20260913000300_*`. Historical bytes are preserved and hashed in `supabase/history.json`.
- Apply all migrations before deploying the updated account export code. Keep flags false. Roll back application exposure first; retain immutable evidence and use forward database repairs.
- Keys are optional until evidence writes are used, then required from a managed secret provider. No KMS/provider/worker deployment was performed.
- Completed private results stay owner-readable after GitHub revocation; new retrieval, runs and finalization through revoked access fail. Shared canonical data survives a deletion only when another legitimate reference remains.

## Verification

Using Node **22.23.2** / npm **10.9.9** and isolated PostgreSQL **17.11**:

- `npm run test:postgres`: **21/21** real database tests pass, including fresh/replayed/upgrade migrations, secure partial deployment, distinct-subject RLS, encrypted multi-repository persistence, nested foreign citations, incompatible versions, explicit receipts, orphan evidence, immutable updates, shared analysis/account deletion, cancellation and retention.
- `npm test -- --coverage`: **631/631** backend tests pass. Unchanged coverage thresholds pass: statements **81.41%**, branches **74.18%**, functions **82.55%**, lines **82.45%**.
- `npm run typecheck` and `npm run build`: pass.
- Focused crypto/persistence tests cover tampering, context substitution, key rotation, input rejection, actor binding and safe errors. Existing disabled-feature HTTP boundary tests pass in the full suite.
- CI now runs PostgreSQL verification in the blocking backend job; `supabase/**` changes include the baseline manifest. Existing PGlite tests stay separate.

Tests use real PostgreSQL with transaction-local Supabase-compatible auth functions and roles. Hosted Supabase Auth/PostgREST, real GitHub/model calls, multi-connection worker claiming and the future readiness UI remain later checks. No frontend implementation changed in this run.
