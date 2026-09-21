# Database migrations and Feature 1 operations

New migrations belong only in [`supabase/migrations`](../supabase/migrations). Historical files in both directories remain byte-for-byte unchanged. [`supabase/history.json`](../supabase/history.json) records the ordered baseline with SHA-256 checksums; [`migrations.mjs`](../repofy-backend/scripts/db/migrations.mjs) verifies it and appends new root migrations in timestamp order.

## Historical inventory

The baseline applies the 15 root migrations through `20260306300000_add_pending_signups_expiry_index.sql`, followed by the 11 nonempty backend migrations from `20260320000000_create_github_tokens_table.sql` through `20260402000000_add_github_user_id.sql`. The manifest is the exact file-by-file order.

| Historical detail | Treatment |
|---|---|
| Backend copies of `20260220195818_create_api_usage_table.sql` and `20260220200714_reload_schema.sql` are empty | Use the nonempty root versions once; verify the empty placeholders remain empty |
| Root `001`–`005` precede timestamped migrations | Apply them first; profiles/auth precede credits and report corrections |
| Root OTP migrations create pending signups/functions; backend March 20 removes them | Preserve both steps in chronological order |
| Backend `20260321100000` already declares the advice-job user FK; `20260321200000` adds the same named FK | Skip only the latter's SQL when `pg_get_constraintdef` exactly matches the intended cascading FK; record `verified-redundant`. Apply it if absent; fail if its definition differs |
| Old migration 003 has references to an earlier historical variant | Do not fabricate deployment history. Migration 004 handles its known upsert correction; inspect actual deployments before adopting the baseline |

Previously, the checkout documented Supabase migrations but contained no unified application runner, Supabase local config, or deployment migration job. Existing PGlite tests apply selected root SQL with stubs. This does not establish which migrations a remote deployment has applied. No remote database was inspected or modified during Run 02.

## Reproducible application

Use Node 22. Build/install shared contracts and install backend dependencies as described in [CI setup](ci.md). PostgreSQL must already provide the Supabase `auth.users` and `auth.sessions` tables, `auth.uid()` / `auth.role()` functions, and `anon`, `authenticated`, `service_role` roles. The production runner never creates auth stubs.

From `repofy-backend`:

```bash
# Read-only ordered paths and hashes; does not connect to a database.
npm run db:migrate

# Provision REPOFY_MIGRATION_DATABASE_URL using the deployment's secret mechanism.
# Fresh database with real Supabase auth prerequisites:
npm run db:migrate -- --apply

# Only for a reviewed existing historical baseline with no Repofy migration ledger:
npm run db:migrate -- --apply --adopt-existing
```

The runner uses only the explicit `REPOFY_MIGRATION_DATABASE_URL`; it does not load application `.env` files or infer a database from Supabase API credentials. It serializes migration runners with an advisory lock, applies each migration and its ledger entry in one transaction, and records hashes/dispositions in the private `repofy_migrations.applied` table. A changed applied file stops replay. Unknown historical files and new migrations under the backend directory are rejected.

For an existing deployment, back up its schema/data and preserve its current Supabase migration ledger. Compare its catalog and migration records with the manifest. The `--adopt-existing` preflight checks the expected final historical tables/columns, removed OTP table, credits RPC, report/advice uniqueness state, GitHub identity index, and exact advice-job FK. It records **adoption of a reviewed schema**, not proof that every historical file ran. If preflight fails, resolve the discrepancy with a reviewed forward repair; do not rerun all old migrations over existing data or mark unknown history as applied. Do not mix the two directory histories through separate `supabase db push` invocations.

Run 02 then applies:

1. `20260913000100_feature_one_schema.sql`: entities, explicit memberships, constraints, RLS enabled and grants revoked immediately.
2. `20260913000200_feature_one_transactions.sql`: owner-scoped operations, cleanup, export; all new function execution is revoked at this migration's boundary.
3. `20260913000300_feature_one_policies.sql`: immutable-content guards, owner read policies, and explicit service-only RPC grants.

Deploy all three migrations before deploying the updated account export service. Every intermediate migration is closed to clients; an interruption cannot expose a SECURITY DEFINER function with PostgreSQL's default PUBLIC execute privilege. Keep all Feature 1 flags false. No taxonomy/rubric production seed is inserted here; Run 03 owns versioned seeds. Synthetic seeds exist only in tests.

Run 03 follows with `20260913000400_rubric_registry.sql` and `20260913000500_initial_rubrics.sql`. These register taxonomy `engineering_capabilities@1.0.0`, five role versions `1.0.0` and release `readiness_1_0_0`. Build/install contracts, then run `npm run rubrics:validate` from the backend to check the machine-readable definitions against the SQL seed. The same migration runner applies them in order; no separate production seed command is needed. The initial active pointer is bootstrapped only if absent. Existing report/advice data is not reinterpreted.

Run 03's runtime read RPC is `feature_one_read_rubric_catalog(p_actor uuid, p_release_id text default null)`, callable only by the backend service role after authentication. Import/activation and direct table access remain unavailable to application roles. Human calibration and all detectors remain pending even after a successful seed. See [ADR 0003](adr/0003-capability-taxonomy-and-role-rubrics.md).

For a reviewed future release, validate the complete manifest, add a new root migration calling `feature_one_private.import_rubric_release(jsonb)`, and retain all previously published files. Import does not activate the release. The migration owner can activate or roll back to a known release within a transaction:

```sql
BEGIN;
SELECT feature_one_private.activate_rubric_release('readiness_1_0_0');
COMMIT;
```

The private activation function serializes with imports and rejects unknown releases. Capture the previous release ID in the deployment record before changing it. Rollback changes the active pointer only; retain every taxonomy, rubric and release referenced by an existing report. Do not delete/reinsert or update published definitions. These operations require the explicit migration connection, never browser or application service-role credentials. They do not enable any Feature 1 flag.

## Local and CI verification

Run 04 adds `20260915000100_github_app_connections.sql` after Run 03. It adds user-scoped installation/discovery memberships, private encrypted user credentials and session-bound connection state; all writes remain service-only RPCs. It also extends owner export, identity-conflict protection across legacy/new links, and cleanup. Apply it before deploying the updated export consumer. It requires the existing Supabase `auth.sessions` table; tests model that table only inside disposable databases. See [ADR 0004](adr/0004-github-app-connections.md) and [app setup](github-app-setup.md). No real provider installation has been verified. Public scans remain disabled.

`feature_one_github_active_session(p_actor,p_session)` is a boolean service-only check for current Repofy sessions. Connection state references the real session with cascading deletion, so signing out invalidates pending/consumed callbacks. `feature_one_github_*` operations separately validate the actor, owned account/installation and credential revision. The canonical repository UUID created during discovery is not an attestation or an access grant. The updated account export calls `feature_one_export_v2`, which includes `githubConnections` and `discoveredRepositories` plus safe installation/repository records reached through them; credentials and encrypted locators are excluded. The original `feature_one_export` RPC keeps its response shape for older application instances during rollout or rollback.

```bash
# Local PostgreSQL 17 binaries, automatically found at the Homebrew path or via pg_config:
npm run test:postgres

# Or configure PG_BINDIR to the installed PostgreSQL bin directory.
# CI supplies TEST_PG_ADMIN_URL for its disposable loopback PostgreSQL 17 service.
```

The default harness initializes a private temporary cluster, listens only on its temporary Unix socket, creates a randomized test database, and removes the database/cluster afterward. It never starts a system login service. An explicitly supplied test URL must point to loopback; its server must be disposable and permit role/database creation. The harness creates only randomized `repofy_feature_test_*` databases. Do not use an application server as the test server.

Tests run real PostgreSQL RLS with separate role/subject contexts and a BYPASSRLS service role. Auth functions read transaction-local JWT settings; they do not return a constant null. They model Supabase's broad default table grants to verify that new migrations revoke them. Tests force deferred constraints at each emulated RPC commit and use actual database savepoints, rather than mocked query builders. This proves PostgreSQL authorization and relational behavior; it is not a hosted Supabase Auth/PostgREST end-to-end test. Run 07 adds multi-connection worker claiming/fencing tests.

CI's blocking backend job runs the real PostgreSQL suite; both `supabase/**` and backend changes trigger it. See the [Run 02 handoff](../feature%20one%20implementation/02-handoff.md) for measured results.

## Recovery and maintenance

Roll back application exposure with feature flags first. Keep migrations/data in place when reverting application code. Never drop evidence tables, disable immutability triggers, or rewrite completed reports as a routine rollback. A failed migration rolls back its own transaction and ledger row; prior successful migrations remain. Reconcile that state against the recorded hashes, restore a backup into a separate recovery database if necessary, and deliver a forward repair. Test the repaired upgrade before deployment.

`feature_one_prune_retention()` is a service-only maintenance RPC: remove unreferenced ingestion receipts older than 24 hours, prune safe audit events older than 90 days, then remove unreferenced canonical artifacts. Account deletion runs canonical cleanup in a deferred database trigger after all user cascades; analysis deletion cleans its memberships in its own transaction. Run 07 supplies separate supervised worker/maintenance entry points; deploy the maintenance service on each worker volume. Shared canonical references are protected by FKs, so a cleanup race cannot silently cascade away another user's receipt. Retry serialization/FK conflicts through the future worker policy instead of weakening those constraints.

No billing behavior changes. Account deletion still invokes Supabase Auth's `deleteUser`; Feature 1's cascades run in that database transaction. The export API adds `evidence_analysis` and requires these migrations even while feature intake is disabled.


## Run 05 selection and security delivery migration

Apply `supabase/migrations/20260919000100_repository_selection_and_revocation.sql` after Run 04 using the checksum-verified migration runner. It adds private delivery/idempotency receipts, encrypted saved selection entries, a server-only access epoch, immutable consent text and grant access revisions. Run 05 uses `feature_one_export_v3`; deploy the schema first. Older exports stay available during a rolling rollback.

`feature_one_prune_retention()` retains its earlier cleanup and additionally deletes webhook/save receipts after 90 days. Run 07 schedules it independently of intake flags. Receipt payloads contain only a delivery UUID, body hash, event/action and time. Account deletion clears user-scoped selections and request receipts; unlinked safe delivery receipts expire independently. No raw webhook bodies or display values are exported.

Never undo revocation as part of recovery. Roll back exposure using feature flags while retaining security webhook processing and its secret. Keep this additive migration and immutable historical reports. See [ADR 0005](adr/0005-repository-selection-and-revocation.md) for locking, replay, authorization and future worker requirements.

## Run 06 ingestion migration

Apply `20260919000200_safe_snapshot_ingestion.sql` after Run 05 before deploying the export-v4 consumer. It adds private owner/job/grant-bound commit pins, expiring ingestion attempts, eligible encrypted file metadata, and security-policy identity to canonical snapshots. Matching policy hashes are required in bundles, runs and reports; existing artifacts retain their separate legacy identity. All new tables deny direct browser/service access, and public worker RPCs require service role plus explicit actor ownership. The janitor's claim RPC can only fence expired/disposed/missing attempts.

Exports add ingestion snapshot/attempt/file metadata while stripping encrypted paths, branch names, lookup/content hashes and lease tokens. Job/account deletion cascades this data. Filesystem cleanup remains independent of database deletion and is required on each worker volume. The new migration was applied/replayed only against disposable local PostgreSQL/PGlite fixtures. No remote database has been migrated. See [ADR 0006](adr/0006-safe-snapshot-ingestion.md) for lease order, cleanup scheduling and forward recovery.


## Run 07 durable queue and settlement migration

Apply `20260919000300_durable_analysis_jobs.sql` before deploying the export-v5 consumer. Private execution rows freeze policy/revisions and hold current claims; attempts are separate from immutable runs. Service-only RPCs serialize creation, source access, stage output, publication and settlement. A stale token cannot write or fetch. Existing advice credits are untouched; the new internal policy costs zero units and the separate unit wallet is test-only.

Owner export v5 adds execution policy/budgets, settlement/ledger records and source-free staged drafts. Lease tokens and input fingerprints are excluded. Deleting analysis content leaves minimal owner/key tombstones and settlement history; deleting the account removes them. Snapshot-output references now participate in canonical retention/deletion without regressing GitHub discovery/connection retention.

Run `npm run worker:analysis` and a separate `npm run worker:maintenance` on each private workspace volume. Maintenance continues with flags off, repairs terminal settlement decisions and bounds orphan retention during database outages. See [worker operations](analysis-worker-operations.md). Local verification includes real PostgreSQL multi-process claims and disconnect-before-commit tests; no remote migration or service deployment was performed.

## Run 08 structural evidence migration

Apply `20260920000100_structural_evidence.sql` before deploying the structural handler. It adds per-file structural facts, private content fingerprints, source/language indexes and a metadata-sensitive canonical artifact key. Old artifacts keep legacy defaults. Eligible file rows remain capped at 10,000; excluded files are represented by validated aggregate counters, without retaining their paths. Source and language coverage retains parse failures, unsupported types and processing limits in its denominator.

Canonical uniqueness includes the captured metadata/options/content identity, so permission denial or a different check result cannot reuse an unrelated snapshot. The Run 07 output reference still resumes the same stored artifact for a job. Membership, current fences, immutable snapshots, owner-only export and reference-aware deletion remain in force. Export v5 omits the new artifact key and content fingerprints. The migration accepts the explicit security policy 1.1.0 alongside old 1.0.0 pins; it does not rewrite older policies or evidence. See [ADR 0008](adr/0008-structural-extraction.md). Local migrations were applied only to disposable PostgreSQL/PGlite.

## Run 09 implementation detector migration

Apply `20260920000200_implementation_detectors.sql` after Run 08. It registers 16 immutable rule/capability/strength definitions in the private schema and validates implementation observations on insert and coverage on snapshot sealing. It rejects foreign source references, incorrect source families, inflated confidence/strength, fabricated capability mappings, mismatched quarantine releases and forged coverage counts. No new owner API or export version is required: fixed observation details and opaque references use the existing immutable evidence JSON; source paths and content fingerprints stay private.

Old artifacts remain unchanged. Keep the additive migration on rollback, and choose the earlier extraction factory with a matching new job policy or quarantine rules through a new version. Do not downgrade by editing prior evidence. Local PostgreSQL tests cover concurrent fenced writes and complete rollback on rejected observations; no remote migration was applied. See [ADR 0009](adr/0009-typescript-javascript-detectors.md).

Run 11 adds `20260920000400_evidence_aggregation.sql`: private immutable aggregation
policies and results, run/snapshot/taxonomy-bound support rows, fenced source-free
input/store RPCs, owner read/keyset evidence queries, and export v6. SQL rechecks
coverage, calculation arithmetic and full rubric minima. New tables have no browser
or service-role direct grants; service-only RPCs enforce the actor or worker fence.
Deletion cascades through the existing run/owner foreign keys.

Run 13 adds `20260920000600_readiness_readers.sql` after validated synthesis. It
adds service-only owner history/view/evidence/locator readers, narrow report
deletion and membership-checked safe audit events. Current privacy/access state
is projected separately from immutable report content. Existing owner-created
indexes support bounded keyset history; evidence reads remain bound to the
report's run. New audit actions use the existing 90-day retention and account
cascade. No raw source or new credentials are stored. Apply before deploying the
new read APIs, retain the migration on rollback, and keep completed read/delete
routes available when intake is off. See [ADR 0013](adr/0013-private-readiness-ui.md).

Run 14 adds `20260920000700_rescans_and_comparisons.sql`: private report preferences
and explicit rescan lineage, owner-only focus/history/comparison RPCs, atomic SHA
pinning at rescan admission and fenced reuse of compatible authorized snapshots.
No legacy lineage is fabricated and no original report payload is updated.
Preferences cascade on report deletion; a deleted baseline becomes an unavailable
parent while independently authorized child reports/jobs survive. Account deletion
cascades both resources. Export v7 includes preferences/lineage without replay
keys or hashes. Comparison fingerprints stay internal; no raw source is retained
or fetched. Apply before the new API/worker/export consumer; retain it on rollback.
See [ADR 0014](adr/0014-role-focus-and-rescans.md).

Run 15 adds `20260920000800_finding_feedback_and_provenance.sql`: private typed
finding responses, safe classification history, idempotency tombstones, explicit
reviewer grants, revision-fenced reviews and immutable per-run provenance. All
tables deny direct browser/service-role access; narrow RPCs enforce owner,
reviewer or worker membership. The migration registers aggregation 1.1.0 while
retaining 1.0.0 arithmetic and completed data. SQL validates provenance against
recorded snapshot SHA, inventory and commit metadata. Export v8 adds owned
feedback/history/reviews and provenance without request hashes or reviewer IDs.
Feedback and reviews expire 180 days after the owner's last edit; maintenance
prunes them independently. Analysis/account deletion cascades associated records;
private request-key/hash tombstones prevent late replay until account deletion.
Apply before the API/worker/maintenance/export consumer and retain on rollback.
No reviewers are granted by default. See [ADR 0015](adr/0015-finding-feedback-and-provenance.md).
