# GitHub App connection setup and development smoke check

Runs 04–05 implement the backend integration, saved-selection UI and verified security webhook handler. A live development installation has **not** been verified: this checkout lacks `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_APP_WEBHOOK_SECRET`. Existing OAuth client credentials alone do not establish installation access. No real GitHub App or remote database was changed.

## Configure the appropriate existing app

Inspect the app already used by `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`. Reuse the suitable app in each environment; do not create another production app merely because installation support is new. Keep development and production installations, keys, callbacks and webhook secrets isolated. Since the setup URL is singular, a dedicated development app is appropriate if the existing app is production-only.

For each environment, use its public frontend origin as `FRONTEND_URL` (an origin without a path, query or fragment). The existing Next.js `/api/:path*` rewrite forwards the new callbacks to the backend and preserves the browser's auth/flow cookies. Do not register a backend hostname that cannot receive those same-origin cookies.

| Setting | Value |
|---|---|
| Existing login callback | Retain `<frontend-origin>/callback` |
| Additional OAuth callback | `<frontend-origin>/api/v1/github/installations/authorize` |
| Setup URL | `<frontend-origin>/api/v1/github/installations/callback` |
| Request user authorization during installation | Leave unchecked for this explicit authorize-then-install flow |
| Redirect on update | May be enabled; unsolicited updates without a valid Repofy state require starting again |
| Expire user authorization tokens | Recommended; this integration caps local validity at eight hours regardless |
| Development origin | `http://localhost:3100` is supported locally; a development HTTPS origin may be needed for organization testing |
| Production origin | HTTPS only |

Use selected repository installation access. An organization owner must authorize the installation, and the requesting person must independently have read access to each repository. No organization Members permission is needed for discovery. For SAML organizations, establish an active SSO session before reconnecting. See GitHub's [user-token access rules](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).

## Permissions

| GitHub repository permission | Requirement |
|---|---|
| Metadata: read | GitHub's baseline repository metadata |
| Contents: read | Required for commit resolution and later static ingestion |
| Pull requests: read | Optional, only when later analysis requests PR metadata |
| Checks: read | Optional for later check-run evidence |
| Actions: read | Optional for later workflow-run evidence |
| Commit statuses: read | Optional for later status evidence |

Retain the existing login's account Email addresses read permission if it needs verified email retrieval. The new flow requests no OAuth scopes and does not broaden login scopes. Do not request writes, repository Administration, Issues writes, or organization-wide membership permissions for this run. Discovery accurately reports currently granted optional permissions; later runs must request only those used by a specific operation. GitHub's [permission guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) and [app REST API](https://docs.github.com/en/rest/apps/apps) are the source of permission names.

## Secret injection and rotation

Provision these through the deployment's managed secret service:

- `GITHUB_APP_ID`: stable numeric app ID; it differs from the OAuth client ID.
- `GITHUB_APP_SLUG`: exact app slug used in installation links.
- `GITHUB_APP_PRIVATE_KEY`: RSA PEM (at least 2048 bits), injected into the server process. Real multiline or escaped-newline PEM is accepted. Record the managed secret/version reference in deployment configuration, never SQL or browser configuration.
- `GITHUB_APP_WEBHOOK_SECRET`: independent signing secret for `/api/github-app/webhook`. Configure separate development/production webhook URLs and secrets. Keep this secret configured when discovery/intake flags are disabled.
- Existing `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`: server-only managed secrets. The encryption key must remain consistent across API instances.

An API process loads the private key only for app JWT signing. The future worker receives the same managed reference through its service identity/runtime injection, never through a job payload. Restrict secret-service access to the relevant API/worker identities.

For an app private-key rotation: generate a new key in GitHub, inject its managed version into a development process, validate a narrowly scoped token operation, roll API/worker processes, then revoke the old GitHub key. No installation-token cache needs flushing. Keep the prior key active only during the rollout window. Rotating `TOKEN_ENCRYPTION_KEY` is a different operation: it also protects legacy OAuth data. Coordinate legacy token re-encryption; new connection user credentials may be re-encrypted with their documented actor/purpose context or cleared and reauthorized. Do not replace that key blindly.

## Local verification

Use Node 22 and the repository's existing install/build order. From the backend:

```bash
npm run typecheck
npm run build
npm test -- --coverage --maxWorkers=2
npm run test:postgres
```

Tests inject synthetic responses and never contact GitHub for app authorization or private repository data. They exercise the concrete transport separately, including token scope/expiry. No production fake-provider route or environment bypass exists.

Apply `20260915000100_github_app_connections.sql` after all Run 03 migrations using the [migration runner](database.md). It is also required by the updated account export contract. Keep flags disabled on externally reachable environments. Internal discovery testing requires both `FEATURE_ONE_ENABLED=true` and `GITHUB_APP_REPOSITORIES_ENABLED=true`; readiness availability remains `not_implemented` and scan endpoints remain unavailable.

## Real development-app checklist — pending

Record date, environment, app ID and redacted outcomes only. Do not record tokens, keys, code/state query strings, private names, source or full provider payloads in the verification artifact.

1. In a dedicated development environment with migrations applied, sign in through the existing GitHub login. Confirm refresh and the username explorer still work, and a customized display name remains unchanged.
2. From the same authenticated origin, POST `/api/v1/github/installations/start` with `{ "intent": "install", "returnTo": "/readiness/new" }`, using the normal `X-Requested-With` CSRF header. Open the returned `authorizeUrl` in the same browser. The API sets an HttpOnly connection cookie.
3. Authorize the intended identity, install to a development personal account with only one synthetic public and one synthetic private repository, and complete the callback. Expect a safe `github=connected` return parameter. The authenticated `/readiness/new` picker is now available in the enabled internal environment; Start Analysis remains disabled.
4. GET `/api/v1/github/accounts`, then `/api/v1/github/installations?accountId=<opaque-UUID>`, then `/api/v1/repositories?accountId=<opaque-UUID>&installationId=<opaque-UUID>`. Confirm private/no-store headers, selected repositories only, optional permission status and bounded pagination. Save only redacted pass/fail evidence.
5. Repeat with two development identities sharing an organization installation but having different repository read access. Confirm each sees only its own eligible subset. Try the other user's opaque account/installation/repository references and an unassociated installation callback hint; expect denial without private names.
6. Test an organization approval request. Expect `pending_approval` with no association. After an owner approves, explicitly reconnect or refresh discovery. Test SSO policy if relevant to the intended deployment.
7. Repeat a consumed callback, start in one session and finish in another, and lose the flow cookie. Each must require restarting. Refresh an access JWT within the original session and confirm the callback still works.
8. Rename a synthetic repository: an old locator must require rediscovery; refreshed discovery must retain the stable UUID. Transfer it to another owner/installation and confirm old access is rejected. Suspend/uninstall the development app and verify explicit unavailable states.
9. Use the internal `resolveCommit` interface on a synthetic repository to verify the full expected commit SHA. Inspect only repository scope IDs and permission names in a controlled test assertion; never persist the minted token. Confirm exactly one repository, metadata read and contents read. Verify cleanup after success/failure.
10. Unlink through `DELETE /api/v1/github/accounts/<accountId>` with CSRF protection. Confirm new access is denied, pending callbacks fail, retained credentials/locators are removed, old grants stay revoked after reconnect, and primary sign-in still works. GitHub-wide app authorization removal is a separate provider operation.
11. Verify app/edge/Sentry access-log configuration excludes callback query strings and authorization/cookie headers. The application suppresses provider tracing for integration handlers and drops connection/provider breadcrumbs and transaction events; hosting access logs require deployment configuration.

Run 05 delivers locally verified selection, attestation and security webhooks. The development-app exercise below and later ingestion/worker/release gates remain required before external private scans. Security webhook processing must remain independent of the discovery flag. Do not mark this real checklist passed based on the automated fixtures.

## Recovery

Disable the two discovery flags first. Preserve identity UUIDs, prior grants and immutable reports. Keep the additive migration in place; account export uses it. Reauthorize an expired/invalid user credential through a fresh state-bound flow. Do not manually attach an installation, rewrite provider IDs or reactivate old grants. Use a forward migration for database repairs and follow the existing managed-key rotation process. Account deletion cascades connection data and cleans only unreferenced canonical identities.


## Run 05 webhook and selection exercise — pending development credentials

Configure the app webhook URL as `<public-backend-or-frontend-origin>/api/github-app/webhook`, with JSON content type and the managed signing secret. Subscribe to installation, installation-repositories and GitHub app authorization events (GitHub Apps receive the installation lifecycle events); enable repository access-change notifications available with the existing read permissions. Do not add organization-wide permissions merely to obtain optional membership events. GitHub's [event documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads) defines delivery payloads.

1. Apply the Run 05 migration. Enable the two discovery flags only in the isolated development environment. Confirm `FEATURE_ONE_MAX_REPOSITORIES` is reflected in the picker.
2. Select public/private organization fixture repositories across pages. Confirm consent is required, save/reload preserves selection, and Start Analysis is disabled. Try a mixed foreign/owned request and a request above the server limit; neither may create partial grants.
3. Remove one selected repository through GitHub's installation settings. Confirm signed delivery succeeds, only that repository's grant becomes revoked, its access revision changes, and refresh shows the revoked state.
4. Redeliver the same delivery from GitHub. Confirm a duplicate acknowledgment with no additional audit/revision changes. Send modified bytes with the prior signature; expect 401 and no effects.
5. Suspend and uninstall the development installation, then revoke the development user's app authorization. Confirm grants are revoked, user credentials are deleted for authorization revocation, and retained report data remains owner-scoped.
6. Restore/reinstall access and replay an older addition/unsuspension. Neither may revive an old grant. Rediscover and explicitly save; a new grant must be required.
7. Disable both intake flags while keeping the webhook secret and route deployed. Repeat a real removal: it must still revoke access. GET/DELETE saved selections remain authenticated and available.
8. Review hosting logs and delivery monitoring for failed/oversized deliveries. The endpoint bounds raw payloads at 2 MiB; do not silently accept unprocessed delivery failures. Replay failed genuine deliveries after recovery. No GitHub network call is required to apply revocation.
9. Record redacted date/environment/pass-fail evidence. Real callbacks, cookies, organization SSO and webhook delivery have not been established by local fixtures.

Automated browser verification: build the frontend with `API_BACKEND_URL=http://127.0.0.1:3191/api`, then run `npm run test:e2e:selection` from the frontend. Install backend dependencies and Chromium first. Its synthetic GitHub server is under `repofy-backend/tests/e2e`, binds only loopback, and has no production registration. Rebuild with the normal environment for deployment. Keep the existing disabled-readiness smoke suite as well.
