# ADR 0004: Verified GitHub App connections and repository discovery

Accepted September 15, 2026. Run 04 scope: CORE-001–003, GH-001–005, GH-009 foundations, ANA-001–002 foundations. All feature flags retain their existing disabled defaults.

## Decision and authorization boundary

Add a separate backend `domain/github-app` module and shared discovery contracts. Keep the legacy username explorer and login API. A connection verifies a GitHub identity and discovers eligible repositories; it does not record a submission attestation, grant scan authorization, ingest source, or expose readiness reports.

Use GitHub's user-token endpoints to discover the intersection of app access and user access. A shared organization installation is not a grant to every repository. `GET /user/installations/{installation_id}/repositories` supplies the eligible set; require its explicit `permissions.pull` and matching stable owner ID. GitHub documents this intersection in [user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) and the [installation API](https://docs.github.com/en/rest/apps/installations).

Do not accept logins, names, emails, display names or client-provided provider IDs as ownership proof. A provider ID stays a decimal string. Unsafe JSON numbers are rejected, not rounded. Repository names are display/locator data; renamed repositories retain their internal UUID after rediscovery. An old locator returning a redirect, replacement ID, or transferred owner fails closed and requires rediscovery.

## Connection flow

```mermaid
sequenceDiagram
  participant Browser
  participant API as Repofy API
  participant DB as PostgreSQL
  participant GH as GitHub
  Browser->>API: POST installations/start (authenticated, CSRF protected)
  API->>DB: Store state hash, session binding, encrypted PKCE verifier (10 minutes)
  API-->>Browser: OAuth URL + HttpOnly flow cookie
  Browser->>GH: Authorize existing GitHub App with PKCE
  GH-->>Browser: OAuth callback code + state
  Browser->>API: installations/authorize
  API->>DB: Atomically consume state for original user/session/cookie
  API->>GH: Exchange code and verify /user stable ID
  API->>DB: Link identity, store encrypted user credential; fence concurrent unlink
  API-->>Browser: GitHub installation URL with new state
  Browser->>GH: Select installation and repositories
  GH-->>Browser: Setup callback with installation hint
  Browser->>API: installations/callback
  API->>DB: Consume second state
  API->>GH: Check user-visible installations and current app installation
  API->>DB: Save user-scoped installation association
  API-->>Browser: Fixed readiness return path with safe status
```

GitHub explicitly warns that setup callback installation IDs can be forged; the provider relationship must be independently verified. The setup and OAuth callback URLs are different. The installation URL supports a state parameter. See [setup URLs](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url) and [sharing an app](https://docs.github.com/en/apps/sharing-github-apps/sharing-your-github-app).

Each request revalidates the exact Supabase access JWT through `auth.getUser`; only then does it use the JWT's stable `session_id`. A service-only RPC also verifies that the actor still owns an existing `auth.sessions` row. This closes the signed-out JWT validity window described in [Supabase's session documentation](https://supabase.com/docs/guides/auth/sessions). Connection states reference that session with cascading deletion, including a consumed OAuth state awaiting its final link. Refreshing an access token in the same session works. A missing/expired session, a new login session, another user, or a missing flow cookie requires restarting. No account is created or inferred from a callback email. The cookie is HttpOnly, SameSite=Lax, Secure in production and restricted to the installation route prefix. Callbacks set `Referrer-Policy: no-referrer`. Only `/readiness` and `/readiness/new` are accepted return paths.

State is persisted in PostgreSQL with only its SHA-256 hash and encrypted payload. Atomic consumption prevents replay across API instances. A consumed OAuth state remains available solely to the final link transaction; unlink deletes it, preventing delayed callbacks from restoring a removed connection. State and cookie expire after ten minutes per stage. The final database link checks the consumed state's expiry again. Up to twenty pending states per user are permitted; state creation prunes expired records.

`intent: link` stops after verified identity linking and supports an already-installed organization app. `intent: install` continues to GitHub's installation screen. Both are explicit authenticated connection requests. Providing an owned `accountId` pins the expected provider ID during reconnect. Multiple evidence identities are supported, with twenty identities per account. The primary login integration remains the sign-in method; connecting an additional evidence identity does not make it a new sign-in method. Neither new linking nor returning primary login overwrites a customized display name.

Identity uniqueness is enforced across `github_accounts` and the legacy `github_tokens` table, serialized with a provider-ID advisory lock. Conflicts cannot silently move an identity. Unlink revokes the evidence identity and every associated grant, clears its user credential, pending flows and discovery associations, and records a safe audit event. Reconnecting never revives old grants. Local unlink leaves primary Repofy sign-in intact. GitHub-wide authorization revocation is separate; Run 05 must process that provider event.

## Provider client and least privilege

`GitHubHttpClient` implements the injectable `GitHubAppProvider` interface. The concrete client uses fixed GitHub.com origins, REST version `2026-03-10`, explicit runtime validation, 15-second request deadlines, 2 MiB response limits, no automatic redirects, and locally constructed bounded pagination. Rate-limit responses expose a bounded retry delay and perform no automatic retry loop. Raw provider bodies, exceptions and private names never become ordinary errors or logs.

Discovery uses the encrypted user credential, not an installation token. User tokens are bounded locally to at most eight hours, including when the app's optional expiration setting is disabled. Refresh tokens returned during this flow are discarded. Expired/revoked user tokens require explicit reconnection; active organization SAML SSO may be required. This avoids adding a second persistent token-refresh job to Run 04.

Installation tokens are minted only through `withVerifiedRepositoryToken`. Before minting, the service checks the actor's discovery membership, current GitHub user, current installation, current user-readable repository and its actual installation. It verifies stable repository and owner IDs, then requests **one** numeric repository ID and only requested read permissions plus metadata read. IDs outside JavaScript's safe integer range are rejected at this numeric API boundary. The returned repository set, permissions and expiry are checked before use. No unscoped token overload exists.

Tokens live in the operation's closure, have a sixty-second expiry safety margin and are invalidated after use. The client attempts `DELETE /installation/token` in `finally`, including on failure; failed revocation relies on provider expiry and never creates a cache entry. There is no installation-token cache, database/Redis storage or browser projection. Callers must not retain credentials outside the closure. User unlink/credential replacement is checked again before returning the result. Run 05's webhooks and Run 06's ingestion must still handle provider access changes during work.

App JWTs use an injected RSA private key, RS256, a clock-skew allowance and a short expiration, following [GitHub's JWT documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app). Installation-token scoping and lifetime follow [the installation token API](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app).

`resolveCommit` accepts a validated branch, requests the exact `refs/heads/...` ref with a freshly scoped contents token, checks the returned ref name and returns a full SHA. It is an internal interface, not a scan endpoint. Run 06 must resolve once, persist the SHA and keep retries pinned.

## API and persistence interfaces

All endpoints use the existing success/error envelope, server authentication and private/no-store responses. New read operations are active only when both Feature 1 and GitHub repository flags are enabled.

| Endpoint | Meaning |
|---|---|
| `POST /api/v1/github/installations/start` | `{intent?, returnTo?, accountId?}` → `authorizeUrl`, `expiresAt`; sets flow cookie |
| `GET /api/v1/github/installations/authorize` | OAuth callback; verifies code/state/PKCE and links the GitHub identity |
| `GET /api/v1/github/installations/callback` | Setup callback; independently verifies the installation hint |
| `GET /api/v1/github/accounts` | Owned identity UUIDs, logins and credential availability; no tokens |
| `DELETE /api/v1/github/accounts/:accountId` | Local evidence-identity unlink; missing/foreign IDs are indistinguishable no-ops |
| `GET /api/v1/github/installations?accountId=...` | Paginated live installation reconciliation and permission status |
| `GET /api/v1/repositories?accountId=...&installationId=...` | Paginated eligible repositories for the specific verified identity/installation |

The repository endpoint retains Run 01's `/api/v1/repositories` name. Both lists accept `perPage` from 1–100 (default 30) and an optional encrypted cursor, bound to the actor, account, installation, collection and page size. Cursors expire in ten minutes. Limits stop at 10,000 pages; callback membership search stops at 1,000 installations and reports `pagination_limit`. GitHub listing is not a stable snapshot across pages; callers should deduplicate UUIDs and restart discovery after access changes. Every use still requires live authorization.

Lists report `complete`, `partial` or `unavailable`, explicit issues, optional retry delay, and `connectPath`. Permissions separately report contents, pull requests, checks, actions and commit statuses as none/read/write. Missing optional permissions do not claim metadata coverage. Suspended/missing installations, insufficient contents permission, changed access and provider outages never fall back to public username search. Pending approval callbacks produce an explicit status without an installation association. GitHub does not provide an enumerable pending-request set through this adapter; after owner approval the user must reconnect or refresh live discovery.

The migration adds connection/discovery membership tables, private encrypted user credentials and private connection states, plus selection mode/permission fields on existing installations. Every runtime RPC requires `p_actor`; browser and service roles have no direct table access. Credential revision checks prevent results fetched before an unlink/reconnect from being published afterward. Discovery writes insert canonical repository identities without access grants. Export adds `githubConnections` and `discoveredRepositories` and includes installations/repositories reachable through discovery; ciphertext and credentials stay excluded. Cascading deletion and canonical cleanup preserve data still referenced by another user.

AES-256-GCM binds each encrypted credential, state, cursor and locator to its actor and purpose using the existing managed `TOKEN_ENCRYPTION_KEY`. This key is distinct from the app RSA key. Credentials expire within eight hours; state expires within ten minutes. `feature_one_prune_retention()` now removes expired credentials/states as well as existing retention data. Run 07 must schedule that maintenance; state validity never depends on the scheduler. Discovery locators persist until unlink/account deletion and are never reused as proof of current access.

## Verification and remaining boundary

Synthetic provider fixtures are in `tests/helpers/github-app-fixtures.ts`; they are imported only by tests. HTTP tests exercise the real router, session verification boundary, CSRF and safe errors. Provider transport tests verify JWT signatures, numeric repository scoping, permissions, expiry, rate limits and bounded responses. Real PostgreSQL tests exercise private grants, actor isolation, state concurrency on separate connections, conflict locking policy, export, retention and deletion. The previous evidence/rubric suites remain required.

The live provider checklist and credential setup are in [GitHub App operations](../github-app-setup.md). No remote app/database was configured in Run 04. Real installation smoke verification remains pending until development credentials exist. The readiness UI, repository selection/attestation, verified security webhooks and external private scans remain gated by Run 05 and subsequent runs.
