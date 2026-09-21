# Run 04 handoff — GitHub App connections and repository discovery

**Status: complete for the scoped backend integration and locally verified installation flow.** Verified September 15, 2026 (America/New_York). Live development-app verification is pending because installation credentials are absent. No remote GitHub App/database was changed. Feature 1 and private scans remain disabled. Run 05 is next.

## Delivered scope

CORE-001–003, GH-001–005, GH-009 foundations and ANA-001–002 foundations now have a separate GitHub App integration: verified multi-identity linking, session-bound installation flow, user-scoped installation associations, selected/eligible repository discovery, explicit permission/availability states and an internal exact-commit resolver.

The installation callback checks the GitHub user's actual installation visibility and independently reads the app installation. Repository discovery uses the intersection of app and user permissions. A second organization member cannot retrieve another member's private repositories merely by knowing an installation or repository ID. A discovered UUID creates no access grant or attestation.

State is expiring, single-use, persisted as a hash plus an encrypted payload, and bound to the original Repofy actor, verified Supabase session and HttpOnly flow cookie. The session must still exist in `auth.sessions`. Its deletion removes pending and consumed callback state. Local unlink also invalidates a callback already waiting on GitHub, removes credentials/discovery membership, revokes associated grants and fences delayed provider responses. Reconnecting preserves identity UUIDs and never reactivates old grants.

Installation tokens are minted only when an internal operation needs one, scoped to exactly one repository and requested read permissions. The returned scope/expiry is validated, the token remains in the operation's memory, its lease is invalidated/cleared afterward, and upstream revocation is attempted on success or failure. There is no token cache or installation-token persistence. The app private key is supplied through managed server-secret injection. User OAuth credentials are stored separately with encryption and at most eight hours of validity; they require reconnection after expiry. Run 07 must schedule physical cleanup through the retention RPC.

Legacy GitHub login, account refresh and username exploration retain their routes. Returning login preserves customized display names. Additional linked identities are evidence connections, not additional sign-in methods. No scanner, worker, selection/attestation UI, security webhook handler, pricing change, public report or new login scope was added.

## Stable interfaces

| Interface | Location / meaning |
|---|---|
| Shared schemas | [`packages/contracts/src/github-app.ts`](../packages/contracts/src/github-app.ts): strict connection, identity, permission, installation, repository and pagination contracts |
| Provider interface | [`provider.ts`](../repofy-backend/src/domain/github-app/provider.ts): user/installation discovery, repository checks, exact ref resolution and scoped token callback |
| Concrete provider | [`client.ts`](../repofy-backend/src/domain/github-app/client.ts): GitHub.com REST `2026-03-10`, signed app JWTs, bounded requests, sanitized errors; no redirects/caches |
| Connection service | [`service.ts`](../repofy-backend/src/domain/github-app/service.ts): actor/session-bound flow, live discovery, `verifyRepository`, `withVerifiedRepositoryToken`, `resolveCommit` |
| Persistence | [`repository.ts`](../repofy-backend/src/domain/github-app/repository.ts): service-only `feature_one_github_*` RPCs with explicit actor and credential revision |
| Routes | [`github-app.routes.ts`](../repofy-backend/src/routes/github-app.routes.ts): existing `/api/v1` envelope, fresh session checks, CSRF, safe callbacks |
| Synthetic adapter | [`github-app-fixtures.ts`](../repofy-backend/tests/helpers/github-app-fixtures.ts), test-only; never loaded by production routes |
| Decisions / operations | [ADR 0004](../docs/adr/0004-github-app-connections.md), [setup and live checklist](../docs/github-app-setup.md), [database operations](../docs/database.md) |

API names retain Run 01's reserved repository route:

- `POST /api/v1/github/installations/start`: optional `intent: install | link`, `returnTo: /readiness | /readiness/new`, and owned `accountId` for a pinned reconnect; returns the OAuth URL and expiry.
- `GET /api/v1/github/installations/authorize`: PKCE OAuth callback; `intent: link` returns after verification, otherwise redirects to installation with a second state.
- `GET /api/v1/github/installations/callback`: independently verified setup callback; supports safe pending-approval/suspended/permission status.
- `GET /api/v1/github/accounts` and `DELETE /api/v1/github/accounts/:accountId`: safe owned identity status and explicit local unlink.
- `GET /api/v1/github/installations?accountId=...`: live, paginated installation reconciliation.
- `GET /api/v1/repositories?accountId=...&installationId=...`: eligible repository discovery, bounded `perPage` and opaque actor-bound cursor.

Both discovery lists return explicit complete/partial/unavailable states, reconnect action paths, permission limitations and bounded retry delays. Repositories return opaque application UUIDs and owner-authorized display metadata. Provider IDs, user/installation tokens, key locations and raw provider errors are never returned. Every response remains private/no-store.

## Verification

Verification uses Node **22.23.2** and isolated PostgreSQL **17.11**. Contracts were compiled before reinstalling both applications from their existing lockfiles; no dependency upgrades were introduced.

| Check | Result |
|---|---|
| Contracts typecheck/build/test | Passed, 58 checks including existing compatibility tests |
| Backend typecheck/build and rubric seed validation | Passed |
| Backend full suite with coverage | Passed, 71 files / 758 tests; statements 83.97%, branches 77.44%, functions 85.64%, lines 85.06% |
| Real PostgreSQL suite | Passed, 46/46, including independent-connection callback consumption |
| Frontend lint/typecheck/production build | Passed, one existing unused-import lint warning and existing Next/Sentry warnings |
| Frontend full suite with coverage | Passed, 80 files / 535 tests; statements 80.71%, branches 74.61%, functions 76.58%, lines 82.11% |
| Production readiness HTTP smoke checks | Passed, 8/8; unfinished readiness flows remain unavailable |
| Diff whitespace check | Passed |
| Live GitHub App/Supabase provider smoke | Pending; installation configuration absent |

New tests exercise forged/expired/replayed/cross-session state, signed-out sessions, provider identity conflicts, PKCE, safe redirects, lost-cookie recovery, different organization access sets, missing/suspended installations, optional permissions, renamed/transferred repositories, cursor binding/bounds, provider outages/rate limits, exact token scopes, expiry and cleanup, encrypted data substitution, telemetry suppression and disabled scans. PostgreSQL additionally verifies browser/direct-table denial, owner export, multiple identities, legacy link conflicts, credential revision fencing, session/account cascades and shared canonical cleanup.

The uncapped parallel backend run hit existing PGlite startup timeouts, and a four-worker run hit an existing rate-limit test timeout during concurrent database checks. The complete two-worker run passed without changing tests, time limits or coverage thresholds.

## Migration, setup and recovery

Apply [`20260915000100_github_app_connections.sql`](../supabase/migrations/20260915000100_github_app_connections.sql) after Run 03, using the existing checksum-verified runner. It adds connection/discovery memberships, encrypted user credentials, session-bound state and installation selection/permission fields; extends identity conflict guards, safe export and cleanup; and creates service-only RPCs. Historical migration bytes are preserved.

Deploy this migration before the updated account export consumer. `feature_one_export_v2` adds `githubConnections` and `discoveredRepositories`, while credentials, state and encrypted locators remain excluded. The original `feature_one_export` shape is preserved for older instances during rollout/rollback. Account deletion removes connections, credentials, states and locators; cleanup retains repositories/installations still referenced by another user. Existing completed reports remain immutable and owner-readable under prior policy.

Keep `FEATURE_ONE_ENABLED=false` and `GITHUB_APP_REPOSITORIES_ENABLED=false` externally. Internal setup requires the app ID, slug, managed RSA private key, webhook signing secret, matching existing OAuth client credentials and the configured frontend origin. The two callback URLs must be added/configured as documented; existing `/callback` login remains. Webhook configuration is reserved for Run 05, not delivered by this run. All four missing installation settings and the live smoke checklist are documented in [setup](../docs/github-app-setup.md).

Rollback exposure through feature flags first. Retain the additive schema and immutable reports. Reauthorize expired connections rather than manually changing identities or grants. Rotate the app RSA key through the managed secret provider and process rollout. Coordinate any separate `TOKEN_ENCRYPTION_KEY` rotation with legacy OAuth encryption. `feature_one_prune_retention()` prunes expired connection state/user credentials; Run 07 must schedule maintenance. No secret-manager resources, production flags or remote schema were changed.

## Run 05 handoff and limitations

1. Build the repository picker from owned identities → live installations → eligible repositories. Preserve opaque IDs and explicit availability/permission states. Distinguish organization installation authorization from the individual's repository access and disclose the organization boundary.
2. Before recording the user's authorization attestation and calling Run 02's `bindVerifiedGrant`, call `verifyRepository` again and use its freshly verified provider IDs, owner, visibility and identity. Never accept display names, client provider IDs or cached discovery alone as authorization.
3. Deliver verified installation, installation-repositories and GitHub authorization webhooks with replay protection. Update grants, connections, installation state and in-flight work. Keep security processing active independently of discovery flags. There is no token cache to invalidate in Run 04.
4. Retain the revision fence when adding asynchronous work. Provider observations are not a cross-request snapshot; Run 05 must reconcile webhook ordering and Run 06 must recheck before retrieval. A provider permission change can occur while a request is in flight.
5. Use `resolveCommit` as a foundation for Run 06's single resolution/pinned snapshot. It reads a ref only; source ingestion, safe archives, workspace cleanup and job retries are not implemented here.
6. User credentials require reconnect after eight hours; automatic refresh is intentionally absent. GitHub Enterprise Server and enterprise-owned installations are not supported by this GitHub.com personal/organization adapter. Pending organization requests are surfaced when returned by the callback, not inferred from an empty installation list.
7. Complete the real development-app smoke checklist when credentials are available. Automated fixtures and PostgreSQL authorization tests do not establish hosted callback/cookie, organization SSO or GitHub App configuration correctness. No external private scanning rollout is authorized.
