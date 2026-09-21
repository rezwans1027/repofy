# Run 05 — Repository selection, authorization, and revocation

**Status:** Complete for the scoped implementation and local verification; see [verification and handoff](05-handoff.md). Live development-app webhook verification remains pending installation credentials. **Depends on:** Runs 01–04. **Requirements:** ANA-001, GH-003, GH-006–009, CORE-003–004, CONS-006 foundations.

## Outcome and scope

An engineer can review and select eligible repositories, understand the requested access, attest authorization for private work, and save the selection. Verified GitHub access-change events revoke grants and prevent future source retrieval.

The full Start Analysis operation is implemented in Run 07. Until then, selection is a real saved selection or a clearly disabled continuation, not a button that fabricates an analysis.

## Read first

- [App request middleware](../repofy-backend/src/app.ts), [CSRF middleware](../repofy-backend/src/middleware/csrf.ts), and [rate limiting](../repofy-backend/src/middleware/rateLimit.ts).
- [Existing GitHub hook](../repofy-frontend/src/hooks/use-github.ts), [API client](../repofy-frontend/src/lib/api-client.ts), [auth provider](../repofy-frontend/src/components/providers/auth-provider.tsx), [sidebar](../repofy-frontend/src/components/layout/app-sidebar.tsx), and [route middleware](../repofy-frontend/src/middleware.ts).
- Run 04's permission model and PRD sections 7.1, 15.2, 22.1, and 29.3.

## Implementation sequence

1. Build the authenticated /readiness/new repository-selection screen using Run 04 discovery APIs. Support search, pagination, stable selection by repository ID, public/private labels, organization ownership, installation status, and empty states.
2. Show the configured maximum repository count and eligibility limits. The PRD starting maximum is five, but the backend entitlement/config response is authoritative. Selections spanning pages must not silently disappear or duplicate.
3. Present concise selected-access, no-execution, private-by-default, and source-retention explanations that match actual implementation. Collect explicit ownership/authorization attestation for selected private/organization work. Record the attestation text/version and timestamp against grants.
4. Implement idempotent save/update/revoke selection APIs. Validate every selected ID against verified user access, installation state, permission scope, and limits. Never accept a client-generated grant, installation owner, or attestation timestamp as authoritative.
5. Add a GitHub webhook endpoint with raw-body signature verification before general JSON parsing, using the existing Stripe webhook ordering as a reference. Keep the narrow server-to-server webhook route outside browser CSRF checks without weakening those checks globally.
6. Handle installation deletion/suspension, repository selection removal/addition, and relevant permission changes. Persist delivery IDs and effects transactionally so duplicates cannot repeat destructive side effects. Invalid signatures fail; genuine duplicate deliveries can return an idempotent acknowledgement with no repeated effect.
7. Reconcile stale/out-of-order events against current provider state where needed. Do not let an old installation-added event revive a revoked grant. Installation reactivation must re-establish current access rather than reuse stale assumptions.
8. Increment an access/grant revision and invalidate user-scoped discovery/token caches after revocation. Run 07 checks that revision before dispatch and each retrieval stage; Run 06 checks provider permission at source fetch. New scans and private evidence drill-down that requires refetch must fail immediately when access is known revoked.
9. Define how a current job responds to revocation: stop new retrieval, invalidate further publication under stale authorization, cancel/terminate safely, and clean temporary content. Record this handoff for Runs 06–07 instead of claiming queued jobs are already handled.
10. Add reconnect/manage-installation UI and clear access-revoked feedback. User-facing grant removal is audited and does not silently delete unrelated historical reports; retention/deletion follows the documented owner-data policy.

## Proposed APIs and privacy

POST /api/v1/repository-selections validates the selected repositories and attestation version. GET returns only the current user's saved selection. A narrow DELETE grant/selection action removes future authorization. The webhook is /api/github-app/webhook unless Run 01 names it differently.

Private names remain in owner-authenticated payloads only. Analytics records repository_selected with safe IDs/counts and visibility categories, not names, paths, source, signatures, tokens, or provider event bodies. Browser query caches must be cleared or user-scoped across logout/account changes.

## Acceptance criteria

- Authorized selections persist and can be revisited; cross-user IDs and excess selections are rejected server-side.
- A private repository cannot be submitted without the required attestation.
- A valid removal event revokes access; invalid and repeated events cannot create grants or duplicate effects.
- Revocation invalidates caches and yields a stable machine-readable access error.
- Installation-management errors and organization approval states are actionable and keyboard accessible.
- Disabling the feature blocks new starts but does not stop security revocation webhooks.

## Verification

Test tampered repository IDs, mixed valid/invalid selections, stale grants, count limits, duplicate save requests, account-switch caching, signature verification over original bytes, repeated webhook delivery, out-of-order events, and a revocation arriving between list and selection save. Include frontend selection/keyboard/error tests and an affected E2E flow against the synthetic GitHub adapter.

Do not send real emails or alter a real organization installation in automated tests. Use a separate documented development-app exercise to verify actual webhook delivery.

## Migration, rollout, and handoff

Add webhook delivery receipts and grant revision/attestation fields if not already present. Retain only safe event metadata with an explicit retention window. Roll back UI exposure with flags while continuing to process revocation. A schema rollback must not restore old revoked grants.

Hand off the selected-repository payload, grant-revision semantics, signature/replay tests, user-facing states, and job cancellation contract. Run 07 wires the selection into a real asynchronous start action.
