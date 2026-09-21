# Run 04 — GitHub App installation and repository discovery

**Status:** Complete for the scoped backend integration and local verification; see [verification and handoff](04-handoff.md). Live development-app smoke verification remains pending installation credentials. **Depends on:** Runs 01–02. **Requirements:** CORE-001–003, GH-001–005, GH-009 foundations, ANA-001–002 foundations.

## Outcome and scope

An authenticated Repofy user can associate an authorized GitHub App installation with a verified GitHub identity and discover only repositories they are eligible to analyze. Installation access tokens are minted on demand and remain in memory.

This run provides the backend integration and installation flow. Run 05 completes repository selection, authorization attestation, webhooks, and revocation. Do not enable private scans externally before Run 05 is complete.

## Read first

- [GitHub OAuth service](../repofy-backend/src/services/github-oauth.service.ts), [auth service](../repofy-backend/src/services/auth.service.ts), and [GitHub service](../repofy-backend/src/services/github.service.ts).
- [Backend environment](../repofy-backend/src/config/env.ts), [auth routes](../repofy-backend/src/routes/auth.routes.ts), and [frontend callback](<../repofy-frontend/src/app/(auth)/callback/route.ts>).
- Runs 01–02 and PRD sections 15.1–15.2 and 22.1. Verify current official GitHub App documentation during implementation before fixing permission names, token lifetimes, or callback mechanics.

## External setup to document

Create/configure the appropriate GitHub App, separate development and production callbacks/webhooks, app identifier, managed private-key reference, and webhook signing secret. Request read-only Contents plus the smallest extra read permissions needed for selected PR/CI metadata. Record which capabilities require optional permissions. Do not request write access for future GitHub issue creation.

Existing GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET settings support the current login integration; they do not prove that a server installation-token key or installation management exists. Prefer extending a suitable existing app configuration over assuming a second app is necessary.

Never place real keys in environment examples or the database. Document secret-manager injection, rotation, and how the worker obtains the key reference without exposing it to the browser.

## Implementation sequence

1. Define a GitHub App client interface for installation discovery, eligible repository listing, access verification, exact-commit resolution, and temporary token acquisition. Keep the legacy username explorer separate.
2. Implement a server-generated installation-start flow with expiring, single-use state bound to the authenticated user/session and a safe return destination. Validate the callback independently of user-supplied installation IDs. Session loss requires recovery, not installation attachment to a new arbitrary account.
3. Verify the GitHub identity using the authenticated provider identity and stable provider ID. Preserve display-name customization separately. Support a verified identity-link flow when the existing account model permits multiple identities, including conflict handling and unlink/revocation behavior.
4. Reconcile the installation's actual provider owner, state, selected repository set, and the user's legitimate relationship to it. Organization installation visibility and installation authorization must not imply that every organization member may scan every repository.
5. Persist installation metadata and user-scoped authorization associations. Store provider IDs, owner type, active/suspended status, selection mode, and safe timestamps. Avoid treating mutable logins or repository names as primary authorization keys.
6. Mint least-scoped installation access tokens only when needed. Keep tokens process-local, expire/discard them safely, and invalidate associated cache entries after access changes. Never write tokens to jobs, SQL, Redis, error messages, telemetry, or frontend responses.
7. Implement paginated repository discovery with rate-limit handling and explicit partial/unavailable states. Private names can appear only in the owning authenticated UI. Validate repository ownership and access on use even after a discovery response was cached.
8. Handle installation missing, suspended, pending organization approval, insufficient permissions, renamed/transferred repositories, and GitHub outages. Discovery failures must not fall back to unrestricted public-username search as proof of permission.
9. Publish safe integration status and actionable reconnect/install links for Run 05. Add a local provider adapter using synthetic responses, with a separate real installation smoke-check checklist.

## Proposed APIs and file boundaries

Add a github-app domain service, policy helpers, validated controllers, and routes under /api/v1/github. Proposed endpoints are POST /installations/start, GET /installations/callback, GET /installations, and GET /repositories with bounded pagination. Final naming follows Run 01.

Responses return opaque repository/installation references, display metadata allowed for the user, provider permission status, and cursors. They never return installation tokens, managed-key locations, or raw provider errors. Add environment examples with placeholders only; do not broaden global auth scopes or weaken callback protections.

## Acceptance criteria

A user can complete an installation association and list selected authorized repositories. Forged callback state, another user's installation ID, a replayed callback, and an unverified identity are rejected. Optional metadata permissions are accurately reported. A private repository does not become accessible to a second user who merely knows its ID. Existing GitHub login, account refresh, and profile exploration still work.

## Verification

Test callback CSRF/state binding, expiration/replay, provider identity conflicts, pagination boundaries, installation suspension, restricted organization access, repository transfer, rate limits, token expiry, and logging redaction. Assert the exact repository scope passed to token acquisition rather than only checking that a mocked function ran. Exercise application policy with two user identities.

Use synthetic provider fixtures for automated tests. Record a real development-app smoke check as external verification when credentials exist. A mocked callback does not prove provider configuration is correct.

## Migration, rollout, and handoff

Use Run 02 tables and additive fields only if provider reconciliation requires them. Feature flags prevent discovery/scanning from being exposed prematurely. Disabling discovery does not disable future security webhook processing once Run 05 exists.

Hand off permission documentation, external setup steps, the provider client/policy interfaces, verified-identity linking behavior, fixture adapter, and known permission limitations. Run 05 must receive enough information to distinguish eligible repositories from merely installed repositories.
