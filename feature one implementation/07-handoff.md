# Run 07 handoff — durable jobs, progress, retries and settlement

Status: complete for the scoped local implementation, September 19, 2026. Requirements: ANA-001–003, CORE-003 and ING-007–008 foundations. Public intake remains unavailable because Runs 08–12 have not supplied production extraction, aggregation, synthesis and validation handlers. No remote migration, deployment, paid policy or feature flag was changed.

## Delivered

- PostgreSQL queue truth, atomic claims across processes, renewable 60-second leases, token fencing, attempt records, bounded transient backoff, three-attempt/15-minute attempt/24-hour job budgets, and explicit failed/canceled/expired states.
- Authenticated owner start/list/status/cancel/retry/delete routes and retained-report reads. Start validates saved grants and consent in SQL, freezes execution versions/options and uses owner/key/canonical-payload idempotency. A changed payload conflicts; deletion leaves a minimal replay tombstone until account deletion. Display order remains separate from sorted request identity.
- All repository commits pinned before extraction, fresh grant-revision checks at source operations/progress/publication, and `fail_all_v1` for mixed sets. Run 06's archive/scanner/context boundary now emits real downloading/inventorying stage callbacks and is subordinate to the job fence. Extracted outputs must match the pinned repository, branch, provider ID, SHA and visibility.
- Durable source-free snapshot/run references and strict report-shaped drafts. Retry reuses the original pinned inputs and cached outputs for that job. Canonical snapshot deduplication remains in Run 02 storage; cross-job report reuse is not enabled. Metadata options must agree with the requested and retained inventory. An incompatible canonical artifact fails explicitly; Run 10 must version any expanded metadata cache identity.
- A durable synthesis reservation prevents automatic repeat generation after an uncertain provider outcome. A recorded draft resumes validation/finalization without another model call. An unrecorded model outcome terminates as `MODEL_OUTCOME_UNKNOWN`, requiring review/new request.
- Separate analysis billing wallet/settlement/ledger structures. Production policy is zero-cost internal rollout only, with an explicit allowlist and repository/concurrency limits. A test-only unit policy exercises actual SQL reservation/debit/refund semantics. Advisor credits/prices are unchanged. Report publication, completion and settlement commit together; cancellation/failure and refunds are atomic. Terminal/refunded jobs cannot resume. The retry endpoint accelerates a pending transient retry without resetting its budget.
- Supervised worker process with an independent parent watchdog, graceful shutdown, separate flags-independent maintenance service, periodic recovery/refund reconciliation/retention/orphan cleanup, and a process lifecycle verification command. The supervisor forks only the fixed application entry, never repository code.
- Saved-selection Start action, private progress/history screens, reconnect/poll/resume/cancel, honest indeterminate progress and safe recovery messages. The request key survives lost HTTP responses, reloads and auth-refresh replay. Query data and late mutations remain owner-scoped. Analysis API/page telemetry is suppressed.
- Export v5 includes safe execution/settlement/ledger/draft records while omitting lease tokens and internal fingerprints. Analysis deletion clears drafts/pins/outputs while retaining minimal request and settlement history; account deletion clears all owner records.

## Entry points and operations

- [Job ADR](../docs/adr/0007-durable-analysis-jobs.md): queue, billing, cache, refund/retry and ambiguous model outcome decisions.
- [Worker operations and handler checklist](../docs/analysis-worker-operations.md): migration order, scripts, supervision, shutdown, configuration, deployment/rollback, routes and Run 08–12 obligations.
- `repofy-backend/src/domain/jobs/`: policy, repository, worker, runtime registry and scheduler.
- `repofy-backend/src/workers/`: supervised analysis entry and separate maintenance mode.
- `supabase/migrations/20260919000300_durable_analysis_jobs.sql`: private queue, fences, settlement, reusable references and service-only RPCs.
- `repofy-frontend/src/components/readiness/analysis-progress.tsx`: Start and owner progress/history; `/readiness/jobs` and `/readiness/jobs/:jobId` are active authenticated pages. Report presentation remains Run 13.

Schema first, then worker/API with intake off, then a complete checked-in registry and explicit internal allowlist after downstream release checks. Keep a separately supervised maintenance process on **every** worker volume, with an OS/container RSS limit and alerts. The parent watchdog handles a blocked child event loop; an external service manager must restart the parent and maintenance services. No environment switch can load a synthetic handler into production.

## Verification record

Local Node 22 verification uses synthetic repositories and disposable PostgreSQL/PGlite. No live GitHub/model credentials were used.

- Shared contracts: **61 tests**.
- Backend: **890 tests in 78 files**, coverage thresholds unchanged.
- Real PostgreSQL: **76 tests**, including independent connection/process claim races, stale token denial, reservation rollback on connection loss, bounded crash refunds, draft recovery, publication transaction rollback on disconnect, duplicate completion, lost acknowledgement recovery, revocation, mixed repositories, account deletion, permission boundaries and replay tombstones.
- Frontend: **551 tests in 83 files**, existing coverage thresholds passed; focused progress/picker/privacy/auth-refresh checks also pass.
- Both application builds/typechecks and frontend lint pass. The existing unused `vi` lint warning and Next/Sentry build warnings remain.
- Chromium: selection/security delivery plus durable start after a deliberately lost response, same-key reload replay, progress polling, cancellation and history; existing guarded/unavailable-route smoke suite. Desktop/mobile progress screenshots inspected for layout.
- `npm run worker:verify`: real compiled maintenance and supervised analysis processes, flags-off startup, independent orphan sweep, source-free output and bounded SIGTERM shutdown.
- `npm run ingestion:verify`: existing separate-process heap/deadline/crash/fresh-janitor verification passes.

Local logs: `/tmp/repofy-run07-{backend,postgres,frontend,frontend-focused,contracts,browser,readiness-browser,worker-process,ingestion}.log`. Test artifacts are ignored by Git. The E2E build targets loopback port 3191; deployment must rebuild with its actual backend URL.

## Remaining release gates

Run 08 is next. Runs 08–12 must fill the four handler interfaces and preserve fencing, version checks, source-free staging, deterministic retry behavior and semantic validation. Run 12 must enforce real model budgets, output minimization and any provider-receipt reconciliation before enabling production synthesis. Rubric/scanner calibration, representative performance measurement, live GitHub archive/webhook checks, hosted deployment supervision and full Feature 1 acceptance remain their existing downstream gates. The production registry is intentionally empty and public analysis stays unavailable.
