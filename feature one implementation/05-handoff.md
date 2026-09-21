# Run 05 handoff — Repository selection, authorization and revocation

**Status: complete for the scoped implementation and local verification.** September 19, 2026 (America/New_York). Live development-app installation/webhook verification remains pending credentials. No real GitHub App, remote database, external feature flag, email or paid service was changed. Run 06 is next.

## Delivered behavior and requirements

ANA-001 and GH-003/GH-008/GH-009 now have a real authenticated saved-selection flow at `/readiness/new`: owned GitHub identities, paginated installations/repositories, search over loaded pages, stable UUID selection across pages, public/private and organization labels, status/recovery states, backend limits, and explicit authorization for private **or organization** work. Saves persist and can be revisited. Start Analysis is visibly disabled; no analysis job, billing effect or fabricated result is created.

GH-006, GH-007 foundations and CORE-003–004 now include raw-byte signed webhook verification, transactionally deduplicated effects, grant revocation/revisions, discovery invalidation, fresh-access checks and all-or-nothing selection replacement. A delivery between provider verification and save prevents that save from committing. Revoked grants cannot be updated back to active. Delayed addition/restoration events never recreate authorization; fresh provider verification and a new explicit selection are required.

CONS-006 foundations extend account deletion/export with selection membership and immutable consent. User removal is authenticated, idempotent and audited; it retains unrelated historical reports. Completed reports remain owner-readable under the existing policy. Source ingestion, worker cancellation, source refetch, billing and temporary workspace cleanup remain Runs 06–07.

## Stable interfaces

| Interface | Behavior |
|---|---|
| `GET /api/v1/repository-selections` | Owner's saved entries/revision and authoritative selection policy; works with intake disabled |
| `POST /api/v1/repository-selections` | Exact `{repositories: [{repositoryId, accountId, installationId}], expectedRevision, idempotencyKey, attestation?: {version: "1.0.0", accepted: true}}`; fresh provider validation and atomic replacement |
| `DELETE /api/v1/repository-selections/:grantId` | Owner-scoped idempotent revocation/removal; works with intake disabled |
| `POST /api/github-app/webhook` | Raw signed JSON before general parsing/CSRF; independent of discovery/intake flags; exact duplicate acknowledgment |
| `SavedRepositorySelectionSchema` | Selected display metadata, `grantId`, `accessRevision`, `status`, server `attestedAt`; preserves Run 01's separate `RepositorySelectionSchema` compatibility |
| `RepositorySelectionService.checkGrant(actor, grantId, accessRevision)` | Uncached worker/refetch precondition; revoked or mismatched access returns `REPOSITORY_ACCESS_REVOKED` |
| `feature_one_export_v3` | Adds opaque saved membership to prior owner export; grant consent/revisions included, encrypted names/locators/credentials excluded |

Missing private/organization authorization returns `CONSENT_REQUIRED`. Changed selection or conflicting idempotency key returns `IDEMPOTENCY_CONFLICT`. Revoked/stale access returns `REPOSITORY_ACCESS_REVOKED`. Invalid inputs/limits return `INVALID_REQUEST`. Provider and persistence errors are sanitized; private payloads are no-store. Fresh Supabase sessions and existing browser CSRF remain enforced.

The authenticated response publishes `FEATURE_ONE_MAX_REPOSITORIES` (default five, configurable 1–10), non-archived/default-branch eligibility, exact consent text/version, and `analysisAvailable: false`. The API owns those decisions. Account switching unmounts private selections/consent, cancels user-scoped queries, removes their caches and ignores delayed mutation responses. Browser callback failures return to actionable picker states. Private route/request telemetry is suppressed and the picker is excluded from session replay.

## Database and security decisions

[ADR 0005](../docs/adr/0005-repository-selection-and-revocation.md) records locking, consent, retention, event handling and failure policy. Apply [`20260919000100_repository_selection_and_revocation.sql`](../supabase/migrations/20260919000100_repository_selection_and_revocation.sql) after Run 04 before the updated account-export consumer. Historical migration bytes remain unchanged. The new selection/receipt tables and RPCs are inaccessible to browser roles; writes are service-only with explicit authenticated ownership.

The transaction specializes Run 02's grant binding so consent text, selection replacement, revision checks, audit and idempotency receipts commit atomically. Consent identity/text/version/time remain immutable. A public-to-private change requires a newly attested grant. A first revocation always advances `access_revision` and the owner's saved-selection revision, including prior unlink/revoke paths.

Webhooks handle installation removal/suspension/permission changes, selected repository removal, app user authorization revocation and available repository/member access-change events. Repository-specific events preserve other repository grants. Organization/membership events conservatively revoke installation grants. Restoration/addition only invalidates discovery; it never grants access. This can require reselection after a stale restrictive event, which is intentional. Provider reconciliation occurs during the next explicit discovery/save; provider outages do not delay known revocation.

A single database epoch fences short security and selection commits. Network calls occur outside the lock. An unrelated event may make a save retry; there is no per-repository lock complexity yet. Delivery UUID/hash/event/action/time and request-key/hash receipts are retained for 90 days through the existing maintenance RPC. Full webhook bodies, signatures and repository names never enter receipts/audit. The raw webhook limit is 2 MiB; failures require operational review/redelivery rather than silent acknowledgment. Run 07 schedules maintenance.

## Verification

Verified with Node 22.23.2, disposable PostgreSQL 17.11, isolated PGlite, synthetic GitHub and Chromium. No tests send real emails, change real installations or call paid/model services.

| Check | Result |
|---|---|
| Contracts typecheck/build/tests | Passed, 60 checks including compatibility |
| Backend typecheck/build and rubric seed validation | Passed |
| Backend full suite with coverage, two workers | Passed, 73 files / 773 tests; statements 83.94%, branches 77.28%, functions 85.68%, lines 85.24% |
| Real PostgreSQL suite | Passed, 59/59 including independent-connection delivery/save ordering |
| Frontend full suite with coverage, two workers | Passed, 82 files / 544 tests; statements 81.11%, branches 75.62%, functions 77.25%, lines 82.36% |
| Frontend lint/typecheck/production build | Passed; one existing unused-import lint warning and existing Next/Sentry warnings |
| Synthetic-provider production-browser selection flow | Passed, 1/1; desktop/mobile visually inspected |
| Disabled-readiness production HTTP smoke | Passed, 8/8 |
| Diff whitespace check | Passed |
| Live development GitHub App/hosted Supabase smoke | Pending installation credentials |

A concurrent run of frontend, backend and database suites hit the existing rate-limit test's five-second timeout. The complete backend run passed with two workers when run alone; no test timeout or coverage threshold was changed.

The production-browser exercise covers keyboard selection across two discovery pages, search, required consent, saved reload, disabled analysis, signed removal, duplicate delivery, revoked feedback and user removal. Desktop and mobile screenshots were visually inspected. Real PostgreSQL checks include separate connections committing the same delivery, an uncommitted revocation with a waiting save, all-or-nothing mixed inputs, identity boundaries, consent upgrades, immutable grants, safe export and deletion. HTTP tests exercise original-byte signatures before parsing/CSRF and security handling while flags are off.

## Rollout and recovery

Local installation settings remain absent: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`. Existing OAuth credentials are insufficient. Local discovery flags are unset and default false. `readinessAvailability` remains `not_implemented` when internal flags are enabled. Scans are not enabled externally.

Complete the [development-app selection/webhook checklist](../docs/github-app-setup.md) with a dedicated development installation. Hosted Supabase callbacks/cookies, real organization SSO and webhook delivery remain unverified. Configure delivery monitoring/redelivery and hosting log exclusions. Keep the webhook secret/route deployed while disabling UI/intake flags. Retain the additive schema and previous revoked grants during application rollback; never recover by restoring their authorization.

The blocking frontend CI job now includes the secret-free synthetic browser flow. Its build points the API rewrite at the loopback fixture. Deployment builds must use their normal backend origin. Existing hosted E2E remains a separate check.

## Runs 06–07 contract

1. Carry the saved `repositoryId`, `accountId`, `installationId`, `grantId` and `accessRevision`. Never treat a repository UUID, a saved display name, a GitHub installation alone or an old discovery page as authorization.
2. Persist the expected revision when creating future jobs. Call `checkGrant` before dispatch, each retrieval/refetch stage and publication; repeat live GitHub permission verification at source fetch. Do not cache successful checks. A new grant cannot authorize a prior attempt tied to a revoked grant.
3. On revocation: stop new retrieval; prevent stale publication; safely cancel/terminate execution; remove temporary contents; settle each billing effect once. Run 05 establishes denial/fencing interfaces, not a running-worker cancellation implementation.
4. Run 06 must deliver commit-pinned bounded ingestion and cleanup. The current `resolveCommit` reads a ref only. No repository code, package manager, tests or build is executed.
5. Run 07 must deliver durable jobs/attempt leases, idempotent start/retry/billing, revision persistence, cancellation and retention scheduling. Only then wire Start Analysis to a real start operation.
