# Run 06 handoff — Safe commit-pinned ingestion

Status: complete for the scoped internal module and local/test driver, September 19, 2026. Requirements: ANA-002, ANA-004 foundations, ING-001–008 within the internal ingestion boundary. Public analysis and model processing remain unavailable.

## Delivered boundary

- [Ingestion service](../repofy-backend/src/domain/ingestion/service.ts): `resolveSnapshot`, `prepareSafeSnapshot`, `withSafeSnapshot`, `disposeSnapshot`. Inputs are a verified actor, existing job UUID and repository UUID. Selection/grant/provider facts are derived server-side.
- [GitHub source](../repofy-backend/src/domain/ingestion/source.ts) and [archive transport](../repofy-backend/src/domain/ingestion/github-archive.ts): fresh authorization, exact SHA, manual bounded redirects, credential stripping, streamed byte limits and abort handling.
- [Parser](../repofy-backend/src/domain/ingestion/archive.ts), [exclusions](../repofy-backend/src/domain/ingestion/exclusions.ts) and [scanner](../repofy-backend/src/domain/ingestion/scanner.ts): no filesystem extraction or repository execution; strict framing/path/type/size guards; root ignore precedence; scanner failures stop ingestion; suspected secrets exclude whole files.
- [Policy](../repofy-backend/src/domain/ingestion/policy.ts): frozen effective limits and exact component versions. Default ceilings: 100 MiB compressed, 512 MiB decompressed, 50,000 archive entries, 10,000 eligible files, 1 MiB/file, 32 MiB context, 250,000 lines, 120-second preparation. Per-file exclusions reduce scope explicitly; structural/global limits reject the whole attempt.
- [Repository](../repofy-backend/src/domain/ingestion/repository.ts): immutable first-writer commit pins, consent/access checks, 60-second ingestion leases with fencing, encrypted eligible locators and keyed content hashes. Database calls have a five-second deadline. Owner exports exclude ciphertext/hashes/tokens; analysis/account deletion cascades metadata.
- [Workspace manager](../repofy-backend/src/domain/ingestion/workspace.ts): UUID workspaces with 0700 directories/0600 files, immediate archive deletion before context handoff, independent orphan sweeping and an absolute 30-minute lifetime.

`SafeSnapshotContext` exposes immutable pin identity/policy/counts plus guarded `files()` and `readText(locatorId)`. It supplies no disk, credential, archive or arbitrary network capability. The API returns only eligible scanned UTF-8, normalized safe locators and keyed content hashes. `semanticAnalysis` is always `not_performed` in this run. Zero eligible files or reduced coverage cannot support a claim that a capability is absent.

See [ADR 0006](../docs/adr/0006-safe-snapshot-ingestion.md) for scanner selection/false positives, supported tar/ignore syntax, exact limits, privacy and policy reuse. The [private repository threat model](../docs/private-repository-threat-model.md) names trust boundaries and remaining deployment gates. The scanner is a likely-secret filter with limited documented coverage; no complete-DLP or production calibration claim is made.

## Migration and version compatibility

Apply `supabase/migrations/20260919000200_safe_snapshot_ingestion.sql` after Run 05. It adds private ingestion pins/attempts/files, actor-scoped RPCs, maintenance fencing and export v4. It adds security-policy identity to canonical snapshots and enforces matching snapshot/run/report digests. Historical migration bytes are unchanged.

Build contracts before reinstalling the backend/frontend packed local dependency. `RepositorySnapshot.securityPolicyHash` and `VersionDependencies.ingestionPolicyHash` are optional solely for old artifacts; new workers must supply both. Legacy canonical rows use a distinct database identity. Full effective policy manifests are retained on immutable job pins. Different limits/policies cannot silently reuse a prior job pin or canonical observation set.

Deploy the migration before the updated export consumer. Older export RPCs remain available for rolling rollback. Stop intake to roll back exposure, keep janitor/security processing alive, retain the additive schema and use forward repairs. No remote migration, GitHub installation, deployment or feature flag was changed during this run.

## Verification

Synthetic fixtures cover commit movement/retry, pre-download pinning, traversal/absolute/drive paths, symlink/hardlink/device entries, Unicode collisions, parent conflicts, expansion, compressed/decompressed/count/text/line limits, trailing members, PAX interpretation changes, missing terminators, invalid ignore rules, binaries/encodings, unusual secret-bearing files and path names. Tests capture safe contexts/errors/logs and instrument child-process execution. ENOSPC, interrupted/idle streaming, timeout, scanner failure, access revocation, cancellation, incompatible policy and consumer failure all exercise cleanup.

Real PostgreSQL checks include cross-user access, role privileges, immutable pins, encrypted locators/export redaction, original job/grant membership, expired leases, revocation, cancellation/deletion, canonical policy separation and two independent connections racing commit pins and stale-worker cleanup. PGlite still exercises the existing selection HTTP flow with the new migration applied.

`npm run ingestion:verify` runs only checked-in synthetic fixtures in separate Node processes, with a 256 MiB V8 old-generation limit and parent watchdog. It verifies normal disposal, abruptly exits a child after archive creation, then starts a fresh janitor with advanced test time and verifies an empty workspace root. It reads no app `.env`, real repository or provider/model credentials. CI now runs this as a blocking backend check.

Verified using Node **22.23.2** and disposable PostgreSQL **17.11**:

| Check | Result |
|---|---|
| Contracts build and tests | **61/61 passed** |
| Backend typecheck/build | Passed |
| Backend full suite with coverage, two workers | **76 files / 867 tests passed** |
| Backend coverage | Statements 85.61%; branches 79.14%; functions 86.71%; lines 86.95%; thresholds unchanged |
| Real PostgreSQL migration/authorization/race suite | **65/65 passed** |
| Separate process / crash-recovery driver | Passed |
| Frontend typecheck and production build | Passed |
| Frontend contracts/privacy/picker checks | **10/10 passed** |
| Frontend lint | Passed with the existing unused import warning in `src/lib/query-client.test.ts` |

The frontend build used the existing synthetic loopback API rewrite (`http://127.0.0.1:3191/api`); a deployment must rebuild with its own backend configuration. Existing Next/Sentry warnings remain. No public/browser analysis flow was added, so the Run 05 browser flow was not rerun as a claim of end-to-end analysis. The full backend suite and migration checks exercise the changed shared contracts and selection compatibility.

## Run 07 integration contract

1. Create/authorize the logical job before calling ingestion. Resolve each repository once; retries keep the saved SHA, branch provenance and policy. Reuse the first committed pin after a concurrency conflict.
2. Run the module in the separate worker process, outside Express handlers. Wire a production runtime from `IngestionRepository`, `GitHubSnapshotSource`, managed `LocatorCrypto`, `WorkspaceManager` and deployment-owned `securityPolicy`. Add durable queue claims, job fencing, attempt budgets and progress; ingestion leases alone are not the job scheduler.
3. Use `withSafeSnapshot(request, consume, signal)` for extractor scope. Cancellation/deletion must propagate an abort signal and durable job intent. Uncached stage/context reads and two-second polling stop observed revocation; final publication must also use the existing transactional grant/job fence. Do not retain text after the scope.
4. At startup and every **five minutes or less**, run `workspace.sweep(id => store.claimExpired(id))` on each worker volume, independently of intake flags/provider credentials. The callback atomically fences expired attempts before removal. Missing rows mean an orphan; database outages still permit absolute local expiry. Reconcile expired DB attempts even if a crash occurred before workspace creation. Monitor failed sweeps/disposals.
5. Enforce process RSS/disk/concurrency limits and an external watchdog. The fixture demonstrates a V8 old-generation limit; it is not a deployed OS sandbox. The maximum filesystem lifetime is 30 minutes, so an operating five-minute janitor stays inside the PRD's 60-minute cleanup target. Host/backup outages need explicit operations policy.
6. Freeze the policy hash into Run 07's run dependency object and bind each job's retained manifest. Do not enable product intake until the scheduler, cleanup supervision, live provider checks and downstream handlers are ready. Stopping intake must preserve revocation, cancellation, cleanup and later billing reconciliation.

Run 08 consumes only `SafeSnapshotContext`, adds language/classification/semantic coverage and creates Run 02 canonical bundles with this policy hash. It must honor canonical returned IDs on reuse and must not refetch by branch or read disk directly. Additional provider metadata must use exact SHA relationships and fresh permission checks.

Live private GitHub archive verification is pending the same development-app credentials as Runs 04–05. Scanner calibration, real model egress, production worker supervision and scheduled cleanup remain named later-run/deployment gates.
