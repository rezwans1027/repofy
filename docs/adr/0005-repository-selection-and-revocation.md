# ADR 0005 — Saved repository authorization and security revocation

Status: accepted for Run 05, September 19, 2026. Requirements: ANA-001, GH-003/GH-006–009, CORE-003–004, CONS-006 foundations. No external rollout is enabled.

## Selection and consent

`/readiness/new` is an authenticated picker exposed only when backend discovery flags are enabled. Discovery remains the intersection of the GitHub user's access and the app installation. Search explicitly covers loaded pages; stable repository UUIDs keep choices across pages and installations. Archived repositories and repositories without a default branch are ineligible. `FEATURE_ONE_MAX_REPOSITORIES` defaults to five and is validated in the range 1–10. The authenticated saved-selection response is authoritative for that limit.

POST `/api/v1/repository-selections` accepts only repository/account/installation UUIDs, an expected selection revision, a UUID idempotency key and optional versioned consent. Every requested repository goes through `verifyRepository`, including current user credentials, provider identity, installation status/owner, user read permission and app repository access. A single failed repository rejects the entire update. No source is retrieved and no job or charge is created.

Private **or organization** repositories require the exact version `1.0.0` attestation. SQL records its immutable text, server timestamp, generated attestation ID and confirmation against each newly issued grant. Public personal choices record selection intent without falsely claiming a private-work attestation. If a saved public repository becomes private, a new attested grant replaces the old grant. Historical grant identity and consent remain immutable.

The selection RPC specializes Run 02's grant binding inside one transaction, using existing verified canonical identities and discoveries. It does not call the older stand-alone `bind_grant` RPC, because that operation lacks atomic selection replacement and consent text. A selected repository has one current selection entry; older grants remain revoked for historical report provenance.

A request key/hash receipt and effects commit together. Reusing a key with another payload fails. A matching replay returns the **current** saved authorization, not a cached earlier grant. The expected selection revision detects another tab's update or a revocation during verification. Consent and timestamps cannot be supplied through browser-generated grant facts.

## Revocation and ordering

`POST /api/github-app/webhook` is registered before JSON parsing, cookie parsing and browser CSRF. It accepts bounded original JSON bytes (2 MiB), validates `X-Hub-Signature-256` with HMAC SHA-256 and a constant-time comparison, then validates delivery/event/payload metadata. It has no discovery/intake flag gate. Keep `GITHUB_APP_WEBHOOK_SECRET` configured even when both feature flags are false. Missing verification configuration returns 503; bad signatures return 401; malformed signed input returns 400. Browser selection writes retain normal CSRF and freshly validated Supabase sessions.

Delivery UUID, body checksum, safe event/action and receipt time are stored with revocation effects in one transaction. The same delivery and payload receive an idempotent acknowledgment. Conflicting reuse is rejected. No event body, signature, token, private name or source is retained. Receipts and save-request idempotency records have a 90-day retention window, pruned through the existing maintenance RPC. Beyond that window, replay is conservatively processed again and still cannot revive grants.

Handled effects:

- Installation `deleted`, `suspend`, and `new_permissions_accepted` revoke all active grants for that installation. Suspension/deletion also update known installation status.
- `installation_repositories` revokes grants only for `repositories_removed`, including when present in an `added` payload.
- `github_app_authorization.revoked` revokes that verified identity and its grants, deletes its user credentials, and clears its connections and pending flows.
- Repository and member changes revoke the affected repository's grants. Organization/membership events, if available under existing subscriptions, conservatively revoke the installation's grants. Additional organization permissions are not requested for these optional notifications.
- Creation, addition and unsuspension clear discovery and advance the security epoch but **never** grant access or reactivate old grants. A live discovery/verification and explicit save must issue a new grant. Missing individual user-permission events are also covered by fresh user/provider checks before selection and, in Run 06, each fetch.

Restrictive events apply even if delayed. We deliberately accept a possible extra reconnect/reselection instead of making a stale restoration event authoritative. We do not infer event order from arrival time, and do not restore permissions from webhook payloads. Current provider state is reconciled in the subsequent explicit discovery and selection flow. Provider outages therefore cannot prevent processing a verified removal.

A database epoch row serializes short security-effect and selection-commit transactions. The service reads its revision **before** provider verification; the commit locks it and rejects a changed epoch. Network requests never run under that lock. This prevents a revocation between list/verification and save from being overwritten. The global fence is intentionally conservative: an unrelated security delivery can require retrying a selection. Partitioning it is deferred until load warrants a more complex lock protocol.

Each grant has an opaque `access_revision`. Every path that first revokes a grant advances it and the owner's selection revision. Revoked grants cannot be restored by UPDATE. Discovery is invalidated on security deliveries; no installation-token cache exists. Existing on-demand installation tokens remain operation-local and are revoked/invalidated at operation end. This run does not claim to interrupt an already executing source fetch: ingestion and workers do not exist yet.

## Privacy, deletion and future execution

GET/DELETE selection remain authenticated and available while intake is off. DELETE removes future authorization once, is owner-scoped and audited, and leaves historical reports intact. Account deletion cascades selection metadata. `feature_one_export_v3` adds opaque selection membership to Run 04's owner export; immutable grant consent/revisions are included, encrypted display values are excluded. Existing export RPCs remain available for rolling deployment.

Repository display data is encrypted with actor/repository-bound vault context. Frontend queries are keyed by the authenticated user, have zero retention after unmount, use no-store, and are canceled/removed when the picker unmounts. Selection and consent state remount on user or saved revision changes. Private screens and endpoint telemetry are suppressed; the picker is blocked from Sentry replay. Audit analytics record counts/visibility categories and opaque references, never repository names. Hosting access-log exclusions still require environment configuration.

Runs 06–07 must carry `{repositoryId, accountId, installationId, grantId, accessRevision}` from the saved response. `RepositorySelectionService.checkGrant(actor, grantId, accessRevision)` must be called at dispatch, before **each** retrieval/refetch, and before publication, together with a fresh GitHub check at source fetch. A revoked grant or mismatched revision yields `REPOSITORY_ACCESS_REVOKED`. Do not cache a successful check.

On revocation during work: stop new reads, cancel/terminate the active attempt safely, prevent publication under the old authorization, delete its temporary workspace, and settle its idempotent billing effect once. A new grant does not authorize an old attempt. Run 07 must persist the expected revision, implement execution fencing/leases, durable cancellation, billing and scheduled retention; Run 06 must deliver isolated snapshot cleanup. Existing report persistence already denies finalization through revoked grants. Completed immutable reports stay owner-readable; any drill-down that refetches source must reauthorize.

## Verification and operations

The local synthetic-provider browser flow uses real service code and migration/RPC execution in disposable PGlite. Real PostgreSQL separately verifies ownership, rollback, consent, revisions, duplicate effects and independent-connection ordering. Neither establishes hosted Supabase/GitHub configuration correctness. The development-app delivery exercise remains pending; see [setup](../github-app-setup.md).

Apply `20260919000100_repository_selection_and_revocation.sql` after Run 04 before deploying the export consumer. Keep the additive schema during rollback. Disable intake/UI flags but retain the webhook endpoint/secret and revocation handling. Do not restore old revoked grant rows in a schema or data rollback.

Protocol sources: GitHub's [signature verification](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [event payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads), and [delivery/replay guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks).
