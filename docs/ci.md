# CI Setup

The workflow in `.github/workflows/ci.yml` checks the shared contracts, backend, frontend and Playwright flows.

## Triggers and dependencies

Pull requests and pushes to `main`/`staging` trigger on `repofy-frontend/**`, `repofy-backend/**`, `packages/contracts/**`, `supabase/**`, `docs/benchmarks/run*.json`, and `.github/workflows/**`. Every such change runs all three required Feature 1 jobs. Manual dispatch runs them too; the hosted-account regression requires the separate `hosted_regression` opt-in. Each application job builds contracts before installing the app. npm caches include the contracts lockfile.

There is no root npm workspace. The apps' `.npmrc` files set `install-links=true` to install a packed copy of the compiled contracts. Preserve the repository layout at build time. See [ADR 0001](adr/0001-evidence-foundation.md#build-and-deployment) for Railway/Vercel build context and deployment change detection.

## Checks

- `contracts`: clean install, typecheck, positive/negative runtime fixtures and CommonJS/ESM package build.
- `backend`: contracts install/build, backend clean install, production and release-script typechecks, full tests with unchanged coverage thresholds, real PostgreSQL concurrency/ownership/recovery tests, bounded worker/parser process checks, frozen benchmark/review validation and the integrated HTTP/PostgreSQL/worker workload. No external credentials are used.
- `frontend-unit`: contracts install/build, frontend clean install, lint, typecheck, full tests with existing coverage thresholds, production build, protected-route HTTP checks, selection browser checks, and the complete private report browser flow against real PostgreSQL and the worker.
- `feature-one-gate`: always checks that `changes`, `contracts`, `backend` and `frontend-unit` actually succeeded. Failure, cancellation and skip are failures of this aggregate gate.
- `frontend-e2e` (display name `hosted-app-regression (opt-in)`): the separate credentialed legacy workflow runs only on manual dispatch with `hosted_regression=true`. `continue-on-error` has been removed. Once requested it fails on missing secrets or test failures. A normal skipped hosted check provides no release evidence.

Configure required branch protection for `feature-one-gate`; remote protection was not changed by Run 16. A local pass is not proof that GitHub has run or required this workflow. The readiness smoke test is part of the blocking frontend job. It uses a local capability/auth stub with no actual user or report, exercises all four reserved web routes against the production Next.js build, and needs no external secrets or browser installation. Backend HTTP tests separately exercise real Express boundary middleware; this smoke test is not evidence of real account or database authorization.

## Existing authenticated E2E setup

The opt-in hosted workflow references `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_SUPABASE_ANON_KEY`, `GH_API_TOKEN`, `E2E_GITHUB_APP_CLIENT_ID`, `E2E_GITHUB_APP_CLIENT_SECRET`, and `E2E_STORAGE_STATE`. Use a dedicated non-production project/account with synthetic data only. `auth.setup.ts` loads a manually obtained OAuth storage state; it does not log in with email/password. CI writes that secret JSON to the ignored `e2e/.auth/user.json` with mode 0600 and never logs it. Expired/missing sessions fail. Hosted traces are off so request cookies cannot enter trace artifacts; the session file is not uploaded.

This hosted suite is **unverified** and contains legacy report-generation assumptions against the disabled `/api/analyze/:username` route. It needs separate reconciliation on approved development resources before its regression gate can pass. The main Playwright configuration does not set `MOCK_AI=true` or provide a fake engine; fake CI provider keys cannot establish successful AI calls. Do not re-enable the legacy analyze route, inject production credentials or silently skip failing cases to make it green. Feature 1's real local browser gate is independent and always blocking. See `repofy-frontend/e2e/README.md`.

## Local parity

From the repository root, using Node 22:

```bash
npm --prefix packages/contracts ci
npm --prefix packages/contracts run typecheck
npm --prefix packages/contracts test
npm --prefix repofy-backend ci
npm --prefix repofy-frontend ci
npm --prefix repofy-backend run typecheck
npm --prefix repofy-backend test -- --coverage
npm --prefix repofy-backend run test:postgres
npm --prefix repofy-backend run ingestion:verify
npm --prefix repofy-backend run extraction:verify
npm --prefix repofy-backend run detectors:verify
npm --prefix repofy-backend run worker:verify
npm --prefix repofy-backend run coverage:verify
npm --prefix repofy-backend run aggregation:verify
npm --prefix repofy-backend run rubrics:validate
npm --prefix repofy-backend run release:typecheck
npm --prefix repofy-backend run release:benchmark
npm --prefix repofy-backend run release:load
npm --prefix repofy-backend run build
npm --prefix repofy-frontend run lint
npm --prefix repofy-frontend run typecheck
npm --prefix repofy-frontend test -- --coverage
API_BACKEND_URL=http://127.0.0.1:3191/api npm --prefix repofy-frontend run build
npm --prefix repofy-frontend run test:e2e:readiness
npm --prefix repofy-frontend run test:e2e:selection
npm --prefix repofy-frontend run test:e2e:report
```

Rebuild contracts and reinstall the apps whenever contract source changes. Production artifacts contain installed contracts/Zod; they do not require a runtime sibling source tree. Existing lint/Next/Sentry deprecation warnings do not disable the typecheck, coverage or build gates.

The PostgreSQL suite uses an isolated temporary PostgreSQL 17 cluster locally or the disposable loopback PostgreSQL 17 service in CI. It never loads application database credentials. See [database operations](database.md) for setup, migration order, and the distinction from hosted Supabase end-to-end verification.

The blocking backend job also validates the Run 03 taxonomy and all five role manifests against their immutable SQL seed. JSON changes without matching valid seed content fail `rubrics:validate`; applied seeds must be superseded by a new version and migration. Database tests verify import replay, version conflicts, authenticated discovery and active-version rollback without changing old reports. Human rubric calibration is a separate, pending [benchmark gate](benchmarks/rubric-calibration.md).

Run 04's normal backend suite includes synthetic GitHub transport, session/CSRF/callback, scoped repository discovery, token lifetime and telemetry tests. PostgreSQL verification also covers real session-bound single-use state across separate connections, unlink/reconnect fencing, identity conflicts, owner projections and cleanup. These checks do not require provider credentials or contact a real GitHub installation. On resource-constrained local machines use `npm test -- --coverage --maxWorkers=2`; this retains all tests and the existing coverage/time limits. The separate [live development-app smoke checklist](github-app-setup.md) remains pending and must not be replaced with mock results.


Run 05 adds `npm run test:e2e:selection` to the blocking frontend-unit job. It runs Chromium against the production Next.js build, synthetic GitHub and real selection RPCs in disposable PGlite, with no hosted-account secrets. The job builds its API rewrite for loopback port 3191 and installs backend fixture dependencies plus Chromium. `npm run test:postgres` also verifies concurrent delivery replay and a save waiting on a separate revocation transaction. The existing hosted E2E job remains separate.

Run 06 adds blocking `npm run ingestion:verify`: a separate synthetic worker process, fixed heap limit, parent deadline, deliberate crash and fresh-process orphan sweep. Normal backend tests cover adversarial archives, scanner/privacy boundaries, transport and cleanup; real PostgreSQL tests cover first-pin concurrency and expired-lease fencing. No real repository or provider/model credential is used. The test-clock expiry demonstration is distinct from deploying Run 07's periodic janitor.


Run 07 adds a blocking `worker:verify` check for compiled analysis/maintenance startup, the fixed-entry supervisor, flags-independent cleanup and SIGTERM shutdown. The PostgreSQL suite includes independent process/connection claims, expired fences, draft recovery and reservation/publication rollback on connection loss. The selection browser suite now also tests a deliberately lost POST response, stable idempotency after reload, durable progress polling, cancellation and history. The foundation suite expects an invalid job UUID to return 404 now that job pages are implemented. The full backend/frontend coverage thresholds remain unchanged. See [Run 07 handoff](../feature%20one%20implementation/07-handoff.md) for the local results and deferred live gates.

Run 08 adds blocking `extraction:verify`: compiled structural parsers in a separate 256 MiB process, an independent 15-second watchdog, hostile configuration that must never execute, malformed/deep/aliased documents and exact source-free output checks. Unit fixtures exercise observation semantics and provider permission/SHA/truncation states. The real worker/PGlite test verifies persisted extraction reuse on retry; PostgreSQL verifies concurrent stage deduplication, metadata artifact isolation, forged denominator/commit rejection, owner export and cancellation fences. No live GitHub credentials are used. On a busy local machine, `--maxWorkers=1` avoids contention with the existing five-second integration-test deadlines without changing checks or thresholds.

Run 09 adds blocking `detectors:verify`: 256 indexed synthetic modules, static alias resolution, hostile source that must not execute, malformed/deep/large ASTs, deterministic file/node/byte exhaustion, a 256 MiB heap ceiling and an independent 15-second parent watchdog. It reports counts, elapsed time and peak RSS, without source strings. Detector fixtures cover 16 rules with positive, false-positive, limitation and mutation cases. Worker/PGlite and PostgreSQL tests verify taxonomy membership, immutable registry values, concurrent fenced persistence, semantic forgery rejection, cancellation and private export. The separate human sample review is complete with 4/4 agreement, recorded in [the review sample](benchmarks/run09-human-review.md). This unblinded sample and passing fixtures do not establish calibrated precision.

Run 10 adds blocking `coverage:verify`: pinned Python/Java/XML grammars process 300 synthetic files inside a 256 MiB heap / 15-second watchdog and reject malformed, recovered, deeply nested, oversized and entity-bearing input. The language matrix, contract/UI assertions and PostgreSQL checks cover achieved denominators, immutable parser quarantine, unavailable dependencies, per-file detector limits, owner-only progress and rejection of forged coverage. Selection/progress browser tests verify textual support badges and unknown states. The `run10-*.json` benchmark artifacts trigger affected-package CI because the synthetic DTO is also used in contract/UI checks. [Run 10 evidence](../feature%20one%20implementation/10-handoff.md).

Run 11 also runs `npm run aggregation:verify` as a blocking backend check. It
replays the frozen source-free input/result and processes 20,000 duplicate
observations across ten repositories in a 384 MiB heap under a 30-second watchdog.
The ordinary backend suite and real PostgreSQL suite test arithmetic, role minima,
immutable/fenced persistence, owner evidence pagination, export and deletion.
Changes to `docs/benchmarks/run*.json` trigger the complete Feature 1 checks, including review judgments used by the Run 16 benchmark.


## Run 12 narrative verification

The regular backend suite includes closed-choice semantic validation, source-disclosure attacks, provider schema/refusal/timeout/size failures, ranking, model receipts, budgets and owner publication. The real PostgreSQL suite includes the complete worker with an injected synthetic HTTP provider, concurrent global reservations and stale-attempt fencing. Contract tests cover the additive narrative/ranking fields and generalized projection. No CI test calls OpenAI or requires an OpenAI key. Run `npm run synthesis:smoke` separately with an authorized deployment credential; its result does not replace CI or held-out Run 16 review. See [Run 12 handoff](../feature%20one%20implementation/12-handoff.md).

## Run 13 private report verification

`npm run test:e2e:report` is a blocking frontend check and runs when frontend, backend, contracts, migrations or workflow files change. It uses Chromium and the production Next build, real Express owner endpoints, a disposable PostgreSQL 17 database, and the actual worker from ingestion through validated report publication. The test server injects synthetic GitHub/model/identity transports and never loads application `.env` files. Completed report endpoints are not mocked. The CI job supplies a loopback PostgreSQL service; locally the existing test runner starts and removes its own temporary cluster.

Run after building with `API_BACKEND_URL=http://127.0.0.1:3191/api`. The readiness, selection and report harnesses all use ports 3190/3191; run them sequentially. The main hosted Playwright configuration excludes these separate suites. No live provider credentials, production flags or customer credits are used. Screenshots contain synthetic data only; CI retains them for seven days. The report checks include keyboard focus, axe/contrast, mobile overflow, source sentinels, refresh replay, revoked locations, account isolation, rollback reads and deletion. PostgreSQL adds service-only reader privileges, foreign evidence membership and deletion fencing of an active validator.

## Run 14 rescan verification

The same blocking report suite now also exercises persisted role focus, an
unchanged no-work rescan, refresh/double-click replay, and a provider branch that
moves after admission while the worker is paused. The published report must retain
the accepted SHA and leave the baseline unchanged. It checks comparison filters,
evidence links, cross-owner access, rollback reads and baseline deletion, with
desktop/mobile axe and overflow checks. `run14-*.png` artifacts contain synthetic
data only and use the same seven-day retention.

Backend fixtures cover real two-commit histories (tests, renames/moves, deletion,
dependencies, exclusions and unchanged content), scope/version/permission changes,
ambiguous matching and zero-unit billing. The PostgreSQL suite adds independent
connection admission/revocation races, service-only privileges and queued work
after baseline deletion. Contract/UI checks cover closed outputs, unknown deltas,
paging, private cache cleanup and late mutation responses. No live provider or
model key is used. [Run 14 results](../feature%20one%20implementation/14-handoff.md).

## Run 15 feedback and provenance verification

The blocking report suite adds feedback save/edit after cookie expiry and rapid
submission, persisted review acknowledgement, flags-off reads, reviewer grant
checks, unchanged saved scores and explicit reanalysis into aggregation 1.1.0.
The real pipeline uses synthetic fork/template provider fields and generated/
vendor archive paths. Both feedback and provenance panels receive desktop/mobile
axe and overflow checks. `run15-*.png` captures are synthetic and use the existing
seven-day artifact retention. No new CI secret or external provider is required.

The ordinary suites cover typed membership, all choices, unsafe/overlong text,
idempotent replay, dirty-draft revision fences, private cache cleanup and closed
provenance contracts. Real PostgreSQL adds independent concurrent writes/reviews,
direct-table/RPC privilege checks, actual commit/exclusion data, fabricated
provenance rejection, immutable storage and queued policy selection through a
rollout/rollback. The synthetic fairness fixture is under backend test inputs, so
existing path filters include it. Human A–E review is recorded separately and is
not replaced by CI or represented as statistical calibration. See the
[review process](benchmarks/run15-review-process.md).

## Run 16 release evidence

`npm --prefix repofy-backend run release:verify` runs the 22 local checks sequentially and records real exit codes, durations and an implementation digest in `docs/benchmarks/run16-verification.json`. It expects installed dependencies and Chromium, Node 22 and PostgreSQL 17. It stops at the first failure and records an incomplete result. An implementation edit during verification invalidates the record. It does not install dependencies, call real GitHub/OpenAI, or run the hosted-account suite. Synthetic logs stay in a private temporary directory. The executable CI independently uses clean installs and its own PostgreSQL services.

`release:benchmark` replays the frozen 24-case corpus and 30 hypothetical role boundaries, validates all references and actual review bindings, and fails new unexpected observations or omissions. The one documented false negative remains in recall; it is not relabeled as a negative fixture. Empty/unmeasured metrics stay null. `release:load` starts its own disposable loopback database/API/worker, checks mixed/weak/empty/native cases, five repositories, two queued jobs, the 10,000/10,001 file boundary, privacy and saved reads during both provider outages. Run load and the browser harnesses sequentially because they share ports.

`release:preflight -- --record` records allowlisted local booleans/counts only. `release:decision -- --record` validates the artifacts and reports HOLD until every local and external gate has evidence. Add `--require-ready` to make HOLD exit nonzero for a deployment gate. Ordinary CI does not claim production readiness from passing synthetic checks. Second independent engineering calibration, actual provider integration, deployment supervision/privacy/retention, manual assistive technology, representative capacity, hosted-account regression and branch protection remain separately attributable release gates. See [release evidence](benchmarks/run16-release-evidence.md).
