# Analysis worker operations

Run 07 supplies the durable queue, settlement and recovery boundary. Run 08 adds the real structural extraction factory, `productionExtraction()`. Run 12 provides the complete lazy `productionHandlers()` composition. It returns null while synthesis is disabled. Runs 13–15 provide the private report, comparison and feedback UI. Intake stays gated pending the successful pinned-model smoke and [Run 16 external release gates](benchmarks/run16-external-gates.json).

## Deploy and operate

1. Apply migrations through `20260924000100_sql_dialects_and_import_coverage.sql` with the checksum-verified migration runner. Keep all earlier migrations unchanged. The new migration registers detector bundle `1.0.5` and accepts SQL-screening policy `1.1.2`; deploy schema before application code. Build shared contracts before installing/building the applications. Drain compatible work or cancel older jobs through the authorized API before switching workers; unsupported frozen policies fail before source acquisition.
2. Build the backend with Node 22 (`npm run build`). Deploy the API with existing feature flags off. Do not run jobs inside an HTTP handler.
3. Run `npm run worker:analysis` as a supervised, restart-on-failure process (one job at a time per process). Run **`npm run worker:maintenance` as a separate supervised service on every worker volume**, including when no analysis worker is accepting work. Both entry points handle SIGTERM/SIGINT. The worker stops intake, aborts its current handler, and exits within ten seconds; any uncertain attempt is recovered from SQL.
4. Both services require the normal backend environment and service-role database access. Worker-only GitHub App and locator key material is constructed lazily when processing an eligible job. Configure `FEATURE_ONE_WORKSPACE_ROOT` to a dedicated absolute private directory, mode 0700, outside public/static paths. Mount the same volume into its maintenance service. Never use ephemeral unmounted storage if a separately supervised janitor cannot inspect it.
5. Enforce an OS/container memory limit (suggested initial ceiling 768 MiB per analysis process), no core dumps, no swap-backed source retention where feasible, and restart-on-failure. The supervisor has a 64 MiB heap and forks only the fixed application entry with a 384 MiB heap. Its independent 16-minute active-work watchdog kills a blocked child even if the child event loop is stuck; it also enforces a 30-second startup/idle watchdog and restarts failed children after two seconds; neither replaces a native RSS/container limit. The maintenance heap is 128 MiB. Start with one worker, measure representative repositories, then scale within provider and database budgets. No repository code or subprocess is executed by a handler.
6. Keep the database service-role RPC statement/HTTP timeout bounded (5 seconds at the client, a matching bounded PostgREST/database statement timeout in deployment). A timed-out mutation may have committed: reuse its idempotency identity or query its durable status. Never infer rollback from a network error.
7. When the complete registry and downstream acceptance gates pass, enable the existing feature/GitHub flags and set `FEATURE_ONE_ANALYSIS_ALLOWLIST` to explicit comma-separated user UUIDs. Empty means nobody. No paid policy is configurable. The Run 12 composition pins `internal_free_v1`; no paid customer policy is enabled. Max repositories comes from `FEATURE_ONE_MAX_REPOSITORIES`; SQL also allows at most two unfinished jobs per owner.

Maintenance runs immediately at startup and every 30 seconds. It requeues expired leases with bounded 5/10-second backoff, checks revocation, expires the 24-hour logical budget, reconciles terminal settlements, sweeps local workspaces, and prunes existing retention records. These operations continue independently after intake flags are disabled and do not require browser polling. All three maintenance operations are attempted even if one fails. Raw workspace deletion still has Run 06's absolute 30-minute TTL during a database outage, plus at most one sweep interval. Failed sweeps must be alerted on and retried; a stopped host requires volume cleanup before reuse.

Supervision/alerts must cover process exit, missed maintenance cycles, sustained database failure, oldest queued age, expired attempts, refunded settlements and uncertain model outcomes. Existing worker messages contain fixed codes only; use job IDs/stages/counts for any added metrics, never request bodies, source, paths, provider responses, tokens or model text. Suppress tracing across the worker task; API and frontend analysis/report routes are excluded from repository telemetry.

Rollback: stop new intake, retain both services long enough to drain/cancel work and reconcile refunds, keep maintenance active on every volume, and retain migrations, request tombstones and ledger history. Do not reset grants, pins, leases or settlement rows manually to force a retry. An incompatible frozen policy fails explicitly rather than executing under new versions. Deployment rollback of code is not authorization to delete evidence or billing history.

## API and state

All routes authenticate a live Supabase session. Browser writes retain the existing CSRF protection. Responses use the shared v1 envelope and never forward exception text.

| Route | Behavior |
| --- | --- |
| `GET /api/v1/analyses/availability` | Owner-specific intake gate, without repository data |
| `POST /api/v1/analyses` | Validated selection/options/key; 202 with durable job; repeated key/payload returns same job; changed payload 409 |
| `GET /api/v1/analyses` | Most recent 50 owner jobs |
| `GET /api/v1/analyses/:jobId` | Real stage, attempt number and safe terminal state |
| `POST /api/v1/analyses/:jobId/cancel` | Durable cancellation, fencing and atomic refund |
| `POST /api/v1/analyses/:jobId/retry` | Accelerates an already scheduled transient retry, preserving original pins/policy/budget |
| `DELETE /api/v1/analyses/:jobId` | Deletes analysis content; retains minimal replay tombstone and settlement history until account deletion |
| `GET /api/v1/readiness-reports/:reportId` | Retained owner report; no GitHub/model call |

Owner reads, cancellation and deletion work with intake disabled. Unknown/cross-owner IDs do not reveal existence. A terminal failed/refunded job cannot be resumed. `MODEL_OUTCOME_UNKNOWN` requires review/new request; it is not permission to repeat the original provider invocation. An expired worker can read owner status to resolve a lost completion acknowledgement but cannot finalize, settle, mutate progress or retrieve source.

The UI supports `/readiness/jobs` and `/readiness/jobs/:jobId`. Start uses the saved repository selection and retains its idempotency key through double-clicks, network failure, remount and auth-refresh replay. Pending keys contain only an opaque UUID scoped to the owner and saved selection revision in session storage; they are removed after a successful response. Progress is indeterminate unless a future stage supplies a real measured unit. Run 13 adds `/readiness` saved history and `/readiness/reports/:reportId`, with evidence drill-down, deletion and provider-independent reads.

## Handler integration checklist (Runs 08–12)

- Implement the checked-in `AnalysisHandlers` interface in `src/domain/jobs/worker.ts`; register a complete validated `ExecutionPolicy`. All four handlers are required. No environment-driven plugin loading or fake completion.
- `extract` receives Run 06's safe context and trusted pinned metadata. Read source only through `files`/`readText`, honor the abort signal, never run repository code, and return a coherent `SnapshotBundle`. The worker encrypts/persists it atomically with its job output reference. Use the returned canonical snapshot ID.
- Run 08's factory implements that interface with structural observations and authorized optional metadata. Compose its returned profile into frozen versions and explicitly use `structuralSecurityPolicy()` for new runs. It does not assign capability conclusions. Preserve its source-specific boundaries and eligible/excluded/failed denominators when adding Run 09 detectors. See [ADR 0008](adr/0008-structural-extraction.md) for supported formats, budgets, artifact identity and disabled-extractor versions.
- Run 09's `createImplementationExtraction` composes the structural pass with the bounded TS/JS registry. Copy only `extractorBundle`, `detectorBundle`, and `coverageManifest` from its profile into frozen versions; `disabled` and `implementation` are profile settings, not `VersionDependencies` fields. Use taxonomy `engineering_capabilities@1.0.0` and the initial role rubrics. This factory remains available for earlier pinned policies; the full Run 12 handler registry remains gated by synthesis configuration. Quarantining a rule changes the profile/version and requires a new job; never alter an existing job's pinned versions. The required human sample review is complete with 4/4 agreement; broader human precision evaluation and confidence calibration remain pending. See [ADR 0009](adr/0009-typescript-javascript-detectors.md).
- `aggregate` receives stable snapshot/run IDs and must use idempotent fenced SQL writes for deterministic mappings. Persist source-free structured outputs, never temporary source. The run is immutable and retains its originating attempt; replacement attempts reuse it. Every added mutation must take the job token and call the same SQL fence before writing. Do not introduce a parallel background loop.
- `synthesize` receives a durable invocation reservation. Only return a structurally validated, source-free report-shaped draft. If the provider outcome is unknown after a crash, current recovery fails closed. Add durable provider receipts/reconciliation before enabling any automatic recovery of ambiguous outcomes.
- `validate` must perform the Run 12 semantic/evidence/disclosure checks and throw on failure; it runs again on a recovered draft. SQL still validates relational membership and freezes exactly one report per job. Structural validation alone is not verified evidence quality.
- Honor `checkpoint()` before additional provider work and `signal` throughout. Compare all versions and pinned SHAs. Mixed repositories use `fail_all_v1`; no omitted repository or implied partial coverage. No cache hit bypasses grants or owner boundaries.
- Add end-to-end supported-repository fixtures, adverse model/provider tests and handler-specific budgets; run the real PostgreSQL race/crash suite before changing any lease, settlement or publication behavior.

Actual deployment supervision, remote migrations and live GitHub checks were not performed locally. Run 12 attempted the live model smoke; the pinned model was unavailable. The local fixtures are synthetic and cannot substitute for those release gates.

Run 10’s `createCoverageExtraction` is now returned by the production extraction factory. It uses `language_inventory@1.0.0`, coverage `1.2.0`, the unchanged TS/JS detector bundle and `structuralSecurityPolicy()` 1.1.0. Python/Java/Maven disable masks create immutable new extractor/coverage variants. Missing parser dependencies record a service limitation; unsupported languages record unsupported depth. Never relabel old snapshots or hide exclusions. Ingestion limits fail the whole snapshot; bounded implementation omissions remain explicit in achieved scope. Apply the additive language-coverage migration before composing this profile. See [ADR 0010](adr/0010-language-coverage.md) and [Run 10 handoff](../feature%20one%20implementation/10-handoff.md). No production Start gate or billing policy was enabled.

## Run 11 deterministic aggregation

Apply `20260920000400_evidence_aggregation.sql` after the Run 10 migration. The
`productionAggregation()` factory reads canonical source-free run inputs through
the lease/access fence and stores immutable calculations through a second fence.
It supports all 34 capabilities and five frozen rubrics. Set
`aggregationPolicy: {id: "evidence_aggregation", version: "1.0.0"}` in the future
composed execution policy; admission must pin it before extraction.

Run 12 now composes these stages with the actual model gateway and semantic validator.
The provider success and downstream rollout gates remain unpassed; defaults remain disabled.
`npm run aggregation:verify` checks replay and cardinality/resource bounds; it does
not enable analysis. Overflow fails the stage without silently omitting repositories.
Rollback affects future job composition only; keep immutable policy/result history.
Owner export now uses v6 and includes source-free `aggregations`.


## Run 12 validated synthesis

See [ADR 0012](adr/0012-validated-narratives.md) for semantic boundaries, privacy disclosure and budget arithmetic. All Feature 1 model calls use the database reservation ledger, not the legacy cached spending-cap helper.

Configure the worker/API deployment with `FEATURE_ONE_MODEL_PROVIDER=openai`, `FEATURE_ONE_MODEL=gpt-4.1-mini-2025-04-14`, `FEATURE_ONE_MODEL_POLICY=bounded_narrative_1.0.0`, and an API key from the secret store. Review the provider data policy and set `FEATURE_ONE_PROVIDER_DATA_POLICY=openai_standard_retention_acknowledged` only after acceptance. `FEATURE_ONE_SYNTHESIS_ENABLED=false` is the default. These settings do not imply ZDR or enable the Run 13 UI. Do not enable rollout until the pinned-model smoke passes and the remaining release gates are reviewed.

Run `npm run synthesis:smoke` explicitly from `repofy-backend` with an authorized key. It checks access to the pinned model and makes at most one synthesis request ($0.05 reserved), using synthetic application-authored facts. It writes only safe validation/usage metadata to `docs/benchmarks/run12-provider-smoke.json`. It never loads user repositories or changes the application database. A synthetic adapter is used only through explicit test dependency injection, never an environment switch.

For an outage, keep completed reports available through the normal owner read API. Explicit 429 receives at most one retry; unknown paid outcomes retain their reservation and never regenerate automatically. Run 07 maintenance continues to expire/refund unsettled jobs. A successful stored draft can resume validation/finalization without another model call. An invalid response is metadata-only quarantine and cannot become a verified report. Budget changes require a new reviewed immutable policy release. Run retention maintenance to remove anonymous budget charges after 30 days.

## Run 13 report access

Apply the Run 13 reader migration before the new API/UI. Saved report/history/evidence reads do not construct the worker or require model credentials. `readinessAvailability: available` exposes the completed UI when the parent flag is enabled; actual start availability remains an authenticated owner-allowlist decision with all handlers present. Default deployment flags and the pinned-model/live GitHub release gates remain unchanged.

Location inspection requires current GitHub permission plus database checks before and after verification. It decrypts only the retained locator; it never fetches raw source. Current private visibility suppresses public links, and a revoked grant cannot fall back to a saved public name/path. Keep locator keys available for retained key versions if location inspection is required. Without a key/provider, generic saved observations remain readable and location inspection returns an explicit unavailable state. Keep owner read/delete routes and maintenance running during UI/intake rollback. [Reader/privacy decision](adr/0013-private-readiness-ui.md).

## Run 14 rescans and comparisons

Apply the Run 14 migration before deploying the new API, worker and export-v7
consumer. `RESCANS_ENABLED` and the parent flag gate new rescans/comparisons;
admission also requires the existing production handlers/configuration and owner
allowlist. Role focus and saved history remain available with intake disabled.
Keep pending workers/maintenance running so accepted jobs settle and clean up.

Rescan admission pins the current authorized SHA set before queuing. Workers must
use those pins, even if the provider branch moves. Source reuse requires a sealed
baseline snapshot with matching source/security/coverage versions, the same grant
and current live permission. The database repeats the access-revision/lease fence
before attachment. Rubric-only changes may reuse source while recomputing new
assessments; metadata-enabled or changed source-policy requests cannot use this
shortcut. An unchanged full request returns the existing report without reserving
units or invoking extraction/model work. Queued rescans use `internal_free_v1`.

Do not change stored baselines to fix a comparison or reconstruct deleted reports.
Compare from saved observations under `evidence-diff-1.0.0`; scope, access and
version differences are interpretation limits. Safe events contain no private
names, paths or matching fingerprints. See [ADR 0014](adr/0014-role-focus-and-rescans.md)
and [Run 14 verification](../feature%20one%20implementation/14-handoff.md).

## Run 15 feedback and provenance

Apply the Run 15 migration before updating the API, worker, maintenance and
export-v8 consumer. Both `FINDING_FEEDBACK_ENABLED` and
`FEATURE_ONE_PROVENANCE_ENABLED` default to false and require the parent feature
flag. The former gates owner feedback writes independently of analysis intake;
saved feedback remains readable with writes disabled. Review uses an active
session, the existing admin secret and an explicit database reviewer grant;
[review setup and procedure](benchmarks/run15-review-process.md) documents this
separate operational boundary. Never install an admin key in the browser.

Provenance enables aggregation 1.1.0 for future jobs. Workers select trusted
handlers by the claimed immutable policy, supporting both 1.0.0 and 1.1.0 while
intake flags change. A claim with a different unsupported composition still fails
closed. The provenance stage checks access before/after bounded provider work,
records available fork/template context and reuses captured commit/inventory
facts. Transient provider context failure is explicit unavailable context; access
revocation prevents publication and database failure remains retryable. No
provenance modifier changes strength or confidence.

An explicit rescan creates a report under the revised policy; existing reports
are never rewritten. Metadata-free source artifacts may be reused after normal
reauthorization. Disable the provenance intake flag for future work if the
context is misleading, retain owner reads and queued policy handlers, publish a
generalized quality notice through the approved process and offer explicit
reanalysis. Do not silently replace history. Keep maintenance active: its new
feedback prune removes responses/history/reviews after 180 days without an owner
edit, even if another maintenance task fails. Monitor only safe failure counts;
comments, identities and request keys do not belong in operational telemetry.

## Run 16 release and incident procedure

The current decision is **HOLD**; see [release evidence](benchmarks/run16-release-evidence.md) and the [machine decision](benchmarks/run16-release-decision.json). Local configuration has all six intake/provenance/feedback flags false and an empty analysis allowlist. Local preflight is not a remote deployment audit. No migration, service deployment, secret rotation or flag activation was performed by Run 16.

The measured local workload uses one worker, at most two queued jobs and five repositories, with 10,000 small eligible files at the count limit. It does not measure the maximum compressed/decompressed byte limits or real provider latency. Keep the initial proposal to one worker and one consenting internal owner, with no paid customer policy. Before any enablement, the reliability operator must validate the intended workload under actual container RSS/disk/network limits and provider budgets, then record the approved allowlist and limits. Scaling or changing immutable ingestion/model policies requires new measurements. The suggested 768 MiB process ceiling above is a starting configuration to test, not a proven production capacity.

### Secrets and provider retention

- The deployment operator supplies GitHub App private keys/webhook secrets, provider credentials and locator encryption keys from the managed secret store. Grant only the documented read permissions. Verify key availability without logging values.
- Rotate GitHub signing keys with overlap: load the new key, verify scoped token minting against the development installation, deploy all consumers, then revoke the old key. Rotate the webhook secret with a coordinated provider/config rollout and verify signed delivery before dropping old configuration; do not disable revocation handling during the change.
- Preserve the locator key ID/ring for retained ciphertext. API and worker runtimes read the active `EVIDENCE_LOCATOR_KEY_VERSION`, `EVIDENCE_LOCATOR_ENCRYPTION_KEY`, and `EVIDENCE_FINGERPRINT_KEY`, plus optional `EVIDENCE_LOCATOR_READ_KEYS`: a JSON array of `{ "version": "1.0.0", "encryptionKey": "<64 hex characters>", "fingerprintKey": "<64 hex characters>" }` entries injected by the managed secret service. The array is limited to 32 entries and 16 KiB; versions must be unique and must not include the active version. Malformed configuration fails closed with a fixed error that excludes key material. Omission or `[]` preserves single-key configuration; an empty string is invalid.
- For rotation with overlapping processes, first deploy the new key as a read key to every API/worker consumer while the old key remains active. Then activate the new version, remove its read-key entry and add the former active version to the retained array. New writes use only the active key. Test old locator/branch decryption and new writes across both process configurations before retiring any key. Never silently re-encrypt immutable artifacts in place or delete a required old key without a retention decision covering saved reports, pending pins and backups. OAuth token encryption uses its existing deployment key and requires its own reconnect/rotation plan.
- `store:false` and source-free structured input do not establish provider zero retention. The privacy operator must approve the actual organization/project retention settings and policy acknowledgment before enabling synthesis. Record the policy review date, provider setting and applicable retention limits; keep secrets and raw prompts out of the receipt. The pinned model must pass `synthesis:smoke` using approved development resources. Do not substitute an available alias without a new reviewed model policy/version.

### Failed work, billing and privacy incidents

Inspect only safe job/attempt IDs, immutable versions, stage timestamps, fixed failure codes and aggregate cost/cleanup counts. Ordinary reads do not refetch source or call the model. A privacy/authorization incident stops new intake and the affected policy immediately; preserve owner reads only where those reads remain safe. Keep access-change webhooks, cancellation/deletion, maintenance, cleanup and billing reconciliation active.

Transient work retries at most three attempts under the existing absolute deadline. Terminal failed/refunded jobs remain terminal; they are not a queue to be bulk reset. A stored valid draft can resume validation without another model call. A reserved invocation with no durable outcome is `MODEL_OUTCOME_UNKNOWN`: preserve its reservation, investigate the provider's safe usage receipt, and require an explicit new request after review. Never force a retry by editing leases, requests, settlement rows or model receipts. Reconciliation must preserve exactly one reserve/settle or reserve/refund pair; production admission currently reserves zero customer credits, and paid behavior is exercised only in the isolated database fixture.

Deletion removes active owner access/content and fences workers; account deletion cascades owned records. Shared canonical records survive only another legitimate reference. Raw workspaces use the absolute 30-minute TTL and independent 30-second maintenance sweep. Verify the deadline with a killed worker and a database outage on every deployed volume, alert on any failed or missed sweep, and quarantine a stopped volume until it is swept. Core dumps, source-bearing snapshots, worker-volume backups and observability payload capture must be disabled. Managed database backup retention and restore/deletion replay procedures remain unconfigured external gates; this checkout does not promise deletion from backups or provider logs.

### Rollback and closure evidence

Disable new intake/affected feature flags first. Either drain compatible accepted jobs under their pinned policies or cancel them through the authorized API and allow normal refunds/cleanup; record which choice was made. Keep both aggregation 1.0.0 and 1.1.0 handlers while queued work references them. Preserve schema, ledger tombstones, immutable reports and owner read/delete routes. Do not roll back a migration by dropping retained user data. Apply forward corrective migrations when necessary.

The release owner records dated evidence for remote migration/replay, live GitHub install/revoke/reconnect, model schema/usage/retention, forced kill/recovery, cleanup during database outage, secret rotation, deletion/backup restore, representative capacity, human screen-reader review and required CI branch protection. These are the pending items in `run16-external-gates.json`; mark a gate passed only with an attributable artifact. `npm run release:decision -- --require-ready` fails while any required gate is pending, failed or absent and never changes deployment state.
