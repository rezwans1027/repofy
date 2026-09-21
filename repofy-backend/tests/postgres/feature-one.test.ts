import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IngestionRepository } from "../../src/domain/ingestion/repository";
import { SnapshotIngestionService } from "../../src/domain/ingestion/service";
import { GitHubSnapshotSource } from "../../src/domain/ingestion/source";
import { GitHubArchiveClient } from "../../src/domain/ingestion/github-archive";
import { WorkspaceManager } from "../../src/domain/ingestion/workspace";
import { securityPolicy, policyHash } from "../../src/domain/ingestion/policy";
import { archiveFixture } from "../helpers/ingestion-fixtures";
import { ReadinessReportResponseSchema, RubricCatalogSchema, type RubricCatalog } from "@repofy/contracts";
import { initialRubricCatalog } from "../../src/domain/rubrics/catalog";
import { RubricRepository } from "../../src/domain/rubrics/repository";
// @ts-expect-error The migration runner is a plain Node ESM operational script.
import { migrate, migrationPlan } from "../../scripts/db/migrations.mjs";
import { EvidenceRepository, type FeatureOneRpcClient } from "../../src/domain/analysis/persistence";
import { fixtureCrypto, grantFacts, snapshotBundle, multiRepositoryReport, syntheticRubricVersion } from "../helpers/evidence-fixtures";
import { RepositorySelectionService } from "../../src/domain/github-app/selection";
import { GitHubConnectionService } from "../../src/domain/github-app/service";
import { GitHubWebhookService } from "../../src/domain/github-app/webhook";
import { createHmac } from "node:crypto";
import { GitHubConnectionRepository } from "../../src/domain/github-app/repository";
import { GitHubVault, digest, randomSecret } from "../../src/domain/github-app/crypto";
import { fixtureInstallation, SyntheticGitHubProvider, testKey } from "../helpers/github-app-fixtures";

if (!process.env.REPOFY_PG_TEST_CONFIG) throw new Error("Run npm run test:postgres; never point these fixtures at an application database");
const config = JSON.parse(process.env.REPOFY_PG_TEST_CONFIG);
const db = new pg.Client(config);
const user1 = randomUUID(); const user2 = randomUUID(); const requestId = randomUUID();
const functions: Record<string, string[]> = {
  bind_grant: ["p_actor", "p_facts", "p_request_id"], revoke_grant: ["p_actor", "p_grant", "p_request_id"],
  store_snapshot: ["p_actor", "p_grant", "p_bundle"], create_job: ["p_actor", "p_request", "p_request_hash", "p_grant_ids", "p_request_id"],
  create_run: ["p_actor", "p_job", "p_versions", "p_snapshot_ids", "p_request_id"], finalize_report: ["p_actor", "p_report", "p_request_id"],
  cancel_job: ["p_actor", "p_job", "p_request_id"], delete_analysis: ["p_actor", "p_job", "p_request_id"],
  read_report: ["p_actor", "p_report"], list_reports: ["p_actor"], export: ["p_actor"], export_v2: ["p_actor"], export_v3: ["p_actor"], export_v4: ["p_actor"], export_v5: ["p_actor"], export_v6: ["p_actor"], export_v7: ["p_actor"], export_v8: ["p_actor"], prune_retention: [],
  read_rubric_catalog: ["p_actor", "p_release_id"],
  ingestion_access: ["p_actor", "p_job", "p_repository"], ingestion_read: ["p_actor", "p_job", "p_repository"],
  ingestion_pin: ["p_actor", "p_job", "p_repository", "p_pin"], ingestion_begin: ["p_actor", "p_pin", "p_attempt"],
  ingestion_checkpoint: ["p_actor", "p_attempt", "p_token"], ingestion_ready: ["p_actor", "p_attempt", "p_token", "p_summary", "p_files"],
  ingestion_dispose: ["p_actor", "p_attempt", "p_token"], ingestion_claim_expired: ["p_attempt"],
  selection_read: ["p_actor"], selection_epoch: [],
  selection_save: ["p_actor", "p_expected", "p_key", "p_hash", "p_epoch", "p_items", "p_limit", "p_attestation", "p_request_id"],
  selection_remove: ["p_actor", "p_grant", "p_request_id"], selection_check_grant: ["p_actor", "p_grant", "p_revision"],
  github_webhook: ["p_delivery", "p_hash", "p_event", "p_action", "p_installation", "p_repositories", "p_provider_user"],
  github_start_state: ["p_actor", "p_hash", "p_binding", "p_stage", "p_payload", "p_expires", "p_session"],
  github_active_session: ["p_actor", "p_session"],
  github_consume_state: ["p_actor", "p_hash", "p_binding", "p_stage"],
  github_link: ["p_actor", "p_provider", "p_login", "p_token", "p_expires", "p_state_hash"],
  github_accounts: ["p_actor"], github_identity: ["p_actor", "p_account"], github_credential: ["p_actor", "p_account"],
  github_associate: ["p_actor", "p_account", "p_revision", "p_facts"],
  github_connection: ["p_actor", "p_account", "p_installation"],
  github_mark_missing: ["p_actor", "p_account", "p_revision", "p_installation"],
  github_discover: ["p_actor", "p_account", "p_revision", "p_installation", "p_repositories"],
  github_repository: ["p_actor", "p_account", "p_installation", "p_repository"], github_unlink: ["p_actor", "p_account"],
};
async function asRole(role: "authenticated" | "anon" | "service_role", actor: string | null, sql: string, args: unknown[] = []) {
  await db.query("SAVEPOINT role_operation");
  try {
    await db.query(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [actor ?? "", role]);
    const result = await db.query(sql, args);
    await db.query("RESET ROLE");
    // Each PostgREST RPC commits its transaction; force deferred FK checks here
    // before returning from this test savepoint, then restore the outer fixture scope.
    await db.query("SET CONSTRAINTS ALL IMMEDIATE");
    await db.query("SET CONSTRAINTS ALL DEFERRED");
    await db.query("RELEASE SAVEPOINT role_operation");
    return result;
  } catch (error) { await db.query("ROLLBACK TO SAVEPOINT role_operation"); throw error; }
}
const rpc: FeatureOneRpcClient = { async rpc(name, args) {
  const suffix = name.replace(/^feature_one_/, "");
  const keys = functions[suffix]; assert.ok(keys, "Known test RPC only");
  try {
    const { rows } = await asRole("service_role", null, `SELECT public.${name}(${keys.map((_, i) => `$${i + 1}`).join(",")}) AS data`, keys.map(key => ((key === "p_items" || key === "p_files") || (key === "p_repositories" && suffix === "github_discover")) ? JSON.stringify(args[key]) : args[key]));
    return { data: rows[0].data, error: null };
  } catch (error) { const e = error as Error & { code: string }; return { data: null, error: { message: e.message, code: e.code } }; }
} };
const repository = new EvidenceRepository(rpc);
async function bootstrap(client: pg.Client) {
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
}
before(async () => {
  await db.connect(); await bootstrap(db);
  await migrate(db, { feature: false });
  await db.query("INSERT INTO auth.users(id) VALUES ($1), ($2)", [user1, user2]);
  await db.query("INSERT INTO reports(user_id, analyzed_username, report_data) VALUES ($1, 'legacy', '{\"legacy\":true}')", [user1]);
  await db.query("INSERT INTO advice(user_id, analyzed_username, advice_data) VALUES ($1, 'legacy', '{\"legacy\":true}')", [user1]);
  await db.query("SELECT grant_growth_credits($1, 3, 'synthetic_pi', null)", [user1]);
  // Simulate a manually deployed historical baseline with no consolidated ledger.
  await db.query("DROP SCHEMA repofy_migrations CASCADE");
  await migrate(db, { adoptExisting: true });
  await seedVersions();
});
after(async () => { await db.end(); });

async function isolated(fn: () => Promise<void>) {
  await db.query("BEGIN");
  try { await fn(); } finally { await db.query("ROLLBACK"); }
}
async function count(table: string, where = "true", params: unknown[] = []) {
  const { rows } = await db.query(`SELECT count(*)::integer AS n FROM public.${table} WHERE ${where}`, params);
  return rows[0].n as number;
}
async function rejectsSql(sql: string, params: unknown[], match: RegExp) {
  await db.query("SAVEPOINT invalid_operation");
  try { await assert.rejects(async () => { await db.query(sql, params); await db.query("SET CONSTRAINTS ALL IMMEDIATE"); }, match); }
  finally { await db.query("ROLLBACK TO SAVEPOINT invalid_operation"); }
}
async function prepare(actor = user1, providerUser = "100", providerRepositories = ["300", "301"]) {
  const grants = await Promise.all(providerRepositories.map(async repo => grantFacts(providerUser, repo)));
  const bindings = [];
  for (const facts of grants) bindings.push(await repository.bindVerifiedGrant(actor, facts, requestId));
  const bundles = bindings.map((binding, i) => snapshotBundle(binding.repositoryId, providerRepositories[i]));
  for (let i = 0; i < bundles.length; i++) await repository.storeSnapshot(actor, bindings[i].grantId, bundles[i], fixtureCrypto());
  const request = { contractVersion: "1.0.0", repositoryIds: bindings.map(binding => binding.repositoryId), idempotencyKey: randomUUID() };
  const jobId = await repository.createJob(actor, request, bindings.map(binding => binding.grantId), requestId);
  const { runId, attemptId } = await repository.createRun(actor, jobId, bundles[0].versions, bundles.map(bundle => bundle.snapshot.snapshotId), requestId);
  const report = multiRepositoryReport(actor, jobId, runId, bundles);
  return { bindings, bundles, request, jobId, runId, attemptId, report };
}

test("fresh historical + feature migrations apply, redundant FK is verified, replay is stable", async () => {
  const freshName = `repofy_feature_test_${randomUUID().replaceAll("-", "")}`;
  await db.query(`CREATE DATABASE ${freshName}`);
  const freshConfig = config.connectionString ? { connectionString: (() => { const url = new URL(config.connectionString); url.pathname = `/${freshName}`; return url.toString(); })() } : { ...config, database: freshName };
  const fresh = new pg.Client(freshConfig);
  try {
    await fresh.connect(); await bootstrap(fresh); await migrate(fresh, { feature: false });
    await fresh.query("BEGIN");
    const additions = (await migrationPlan()).filter((entry: { path: string }) => entry.path.includes('20260913'));
    await fresh.query(additions[0].sql);
    const partial = await fresh.query("SELECT has_table_privilege('anon','public.repository_snapshots','SELECT') AS exposed");
    assert.equal(partial.rows[0].exposed, false);
    await fresh.query(additions[1].sql);
    const callable = await fresh.query("SELECT has_function_privilege('anon','public.feature_one_export(uuid)','EXECUTE') AS exposed");
    assert.equal(callable.rows[0].exposed, false);
    await fresh.query(additions[2].sql);
    await fresh.query(additions[3].sql);
    const registry = await fresh.query("SELECT has_table_privilege('anon','public.feature_one_rubric_releases','SELECT') AS table_exposed, has_function_privilege('anon','public.feature_one_read_rubric_catalog(uuid,text)','EXECUTE') AS rpc_exposed");
    assert.deepEqual(registry.rows[0], { table_exposed: false, rpc_exposed: false });
    await fresh.query("ROLLBACK");
    await migrate(fresh); await migrate(fresh);
    const { rows } = await fresh.query("SELECT disposition FROM repofy_migrations.applied WHERE path LIKE '%20260321200000%'");
    assert.equal(rows[0].disposition, "verified-redundant");
    const { rows: counts } = await fresh.query("SELECT count(*)::integer AS n FROM repofy_migrations.applied");
    assert.equal(counts[0].n, (await migrationPlan()).length);
  } finally { await fresh.end(); await db.query(`DROP DATABASE ${freshName} WITH (FORCE)`); }
});
test("upgrade preserves existing profiles, advice, saved reports, and credits", () => isolated(async () => {
  assert.equal((await asRole("authenticated", user1, "SELECT report_data FROM reports")).rows[0].report_data.legacy, true);
  assert.equal((await asRole("authenticated", user1, "SELECT advice_data FROM advice")).rows[0].advice_data.legacy, true);
  assert.equal((await asRole("authenticated", user1, "SELECT growth_balance FROM credit_wallets")).rows[0].growth_balance, 3);
  assert.equal((await asRole("authenticated", user1, "SELECT id FROM profiles WHERE id = $1", [user1])).rowCount, 1);
  assert.equal((await asRole("authenticated", user2, "SELECT id FROM reports")).rowCount, 0);
}));
test("persists a real multi-repository synthetic report with FK citation edges and encrypted locators", () => isolated(async () => {
  const fixture = await prepare();
  await repository.finalizeReport(user1, fixture.report, requestId);
  assert.deepEqual(await repository.readReport(user1, fixture.report.reportId), fixture.report);
  assert.equal((await repository.listReports(user1)).length, 1);
  assert.equal(await count("analysis_run_snapshots"), 2);
  assert.equal(await count("report_evidence_citations"), 2);
  assert.equal(await count("assessment_evidence"), 2);
  assert.equal(await count("report_capability_mentions"), 1);
  const { rows: [stored] } = await db.query("SELECT locator_encrypted FROM evidence_items WHERE id = $1", [fixture.bundles[0].evidence[0].evidenceId]);
  const bundle = fixture.bundles[0];
  assert.deepEqual(fixtureCrypto().decryptLocator(stored.locator_encrypted, { repositoryId: bundle.snapshot.repositoryId, snapshotId: bundle.snapshot.snapshotId, locatorId: bundle.evidence[0].locatorId }), bundle.evidence[0].locator);
  const rows = await db.query("SELECT to_jsonb(s)::text AS payload FROM repository_snapshots s UNION ALL SELECT to_jsonb(e)::text FROM evidence_items e UNION ALL SELECT to_jsonb(f)::text FROM file_inventory f");
  assert.ok(!JSON.stringify(rows.rows).includes("tests/synthetic.test.ts"));
  assert.ok(!JSON.stringify(rows.rows).includes("fixture-sensitive-branch"));
}));
test("RLS uses distinct verified subjects, denies anonymous access and all direct canonical queries", () => isolated(async () => {
  const fixture = await prepare(); await repository.finalizeReport(user1, fixture.report, requestId);
  assert.equal((await asRole("authenticated", user1, "SELECT payload FROM readiness_reports")).rowCount, 1);
  for (const table of ["readiness_reports", "analysis_jobs", "analysis_runs", "analysis_run_snapshots", "analysis_run_evidence", "capability_assessments", "report_evidence_citations", "github_accounts", "repository_access_grants", "audit_events"]) {
    assert.equal((await asRole("authenticated", user2, `SELECT * FROM ${table}`)).rowCount, 0, table);
  }
  assert.equal((await asRole("authenticated", null, "SELECT id FROM readiness_reports")).rowCount, 0);
  for (const table of ["readiness_reports", "evidence_items", "repository_snapshots", "file_inventory"]) {
    await assert.rejects(asRole("anon", null, `SELECT * FROM ${table}`), /permission denied/);
  }
  for (const role of ["authenticated", "service_role"] as const) {
    await assert.rejects(asRole(role, user1, "SELECT * FROM evidence_items"), /permission denied/);
    await assert.rejects(asRole(role, user1, "UPDATE readiness_reports SET payload = '{}'"), /permission denied/);
    await assert.rejects(asRole(role, user1, "DELETE FROM readiness_reports"), /permission denied/);
  }
  await assert.rejects(asRole("authenticated", user2, "SELECT feature_one_read_report($1, $2)", [user1, fixture.report.reportId]), /permission denied/);
}));
test("service-role repository reads and deletion hide foreign objects exactly like missing ones", () => isolated(async () => {
  const fixture = await prepare(); await repository.finalizeReport(user1, fixture.report, requestId);
  assert.equal(await repository.readReport(user2, fixture.report.reportId), null);
  assert.equal(await repository.readReport(user2, randomUUID()), null);
  assert.deepEqual(await repository.listReports(user2), []);
  await repository.deleteAnalysis(user2, fixture.jobId, requestId);
  await repository.deleteAnalysis(user2, randomUUID(), requestId);
  assert.equal(await count("readiness_reports"), 1);
  const stolen = { ...fixture.report, ownerUserId: user2 };
  await assert.rejects(repository.finalizeReport(user2, stolen, requestId), /NOT_FOUND/);
}));
test("one provider identity cannot silently link across users; multiple identities and login changes work", () => isolated(async () => {
  const first = await repository.bindVerifiedGrant(user1, grantFacts(), requestId);
  const renamed = await repository.bindVerifiedGrant(user1, { ...grantFacts(), login: "renamed-fixture" }, requestId);
  assert.equal(first.githubAccountId, renamed.githubAccountId);
  const second = await repository.bindVerifiedGrant(user1, grantFacts("101"), requestId);
  assert.notEqual(first.githubAccountId, second.githubAccountId);
  await assert.rejects(repository.bindVerifiedGrant(user2, grantFacts(), requestId), /NOT_AUTHORIZED/);
  await db.query("INSERT INTO github_tokens(user_id, github_token, github_username, github_user_id) VALUES ($1, 'synthetic-encrypted-placeholder', 'legacy', 999)", [user1]);
  await assert.rejects(repository.bindVerifiedGrant(user2, grantFacts("999"), requestId), /NOT_AUTHORIZED/);
  await rejectsSql("UPDATE github_accounts SET user_id = $1 WHERE id = $2", [user2, first.githubAccountId], /IMMUTABLE_IDENTITY/);
}));
test("installation ownership and an active repository grant alone do not authorize another user's snapshot", () => isolated(async () => {
  const fixture = await prepare();
  await assert.rejects(repository.createJob(user2, fixture.request, fixture.bindings.map(b => b.grantId), requestId), /NOT_FOUND/);
  const grant = await repository.bindVerifiedGrant(user2, grantFacts("200"), requestId);
  const jobId = await repository.createJob(user2, { ...fixture.request, repositoryIds: [grant.repositoryId] }, [grant.grantId], requestId);
  await assert.rejects(repository.createRun(user2, jobId, fixture.report.versions, [fixture.bundles[0].snapshot.snapshotId], requestId), /NOT_FOUND/);
  await assert.rejects(repository.storeSnapshot(user2, fixture.bindings[0].grantId, fixture.bundles[0], fixtureCrypto()), /NOT_FOUND/);
  await rejectsSql("INSERT INTO snapshot_receipts(user_id,snapshot_id,repository_id,grant_id) VALUES ($1,$2,$3,$4)",
    [user2, fixture.bundles[0].snapshot.snapshotId, fixture.bindings[0].repositoryId, fixture.bindings[0].grantId], /foreign key constraint/);
}));
test("logical request replay is stable; hash conflicts and duplicate unique keys are rejected", () => isolated(async () => {
  const fixture = await prepare();
  const reversed = { ...fixture.request, repositoryIds: [...fixture.request.repositoryIds].reverse() };
  assert.equal(await repository.createJob(user1, reversed, fixture.bindings.map(b => b.grantId), requestId), fixture.jobId);
  await assert.rejects(repository.createJob(user1, { ...fixture.request, includeMetadata: { ci: true } }, fixture.bindings.map(b => b.grantId), requestId), /IDEMPOTENCY_CONFLICT/);
  await rejectsSql("INSERT INTO analysis_jobs(user_id, idempotency_key, request_hash, request) SELECT user_id, idempotency_key, request_hash, request FROM analysis_jobs", [], /unique constraint/);
}));
test("foreign nested citations and incompatible capability mappings fail atomically at persistence", () => isolated(async () => {
  const fixture = await prepare();
  const extra = await prepare(user2, "200", ["302"]);
  const forged = structuredClone(fixture.report);
  if (forged.improvements[0].rationale.verification !== "verified") throw new Error("fixture");
  forged.improvements[0].rationale.evidenceIds.push(extra.report.evidence[0].evidenceId);
  const result = await rpc.rpc("feature_one_finalize_report", { p_actor: user1, p_report: forged, p_request_id: requestId });
  assert.equal(result.error?.code, "23503");
  assert.equal(await count("readiness_reports"), 0);
  assert.equal(await count("analysis_run_evidence"), 0);
  await db.query("INSERT INTO capability_definitions VALUES ('synthetic', '1.0.0', 'security', 'quality', '{}')");
  const wrong = structuredClone(fixture.report); wrong.capabilityGroups[0].capabilities[0].capabilityId = "security";
  await assert.rejects(repository.finalizeReport(user1, wrong, requestId), /INVALID_MEMBERSHIP/);
  assert.equal(await count("capability_assessments"), 0);
}));
test("foreign evidence cannot join a run even for another analysis owned by the same user", () => isolated(async () => {
  const fixture = await prepare(); const other = await prepare(user1, "100", ["302"]);
  await rejectsSql("INSERT INTO analysis_run_evidence(run_id, evidence_id, snapshot_id) VALUES ($1, $2, $3)",
    [fixture.runId, other.bundles[0].evidence[0].evidenceId, other.bundles[0].snapshot.snapshotId], /foreign key constraint/);
  const forged = structuredClone(fixture.report); forged.evidence.push(other.report.evidence[0]);
  const result = await rpc.rpc("feature_one_finalize_report", { p_actor: user1, p_report: forged, p_request_id: requestId });
  assert.equal(result.error?.code, "23503");
  await rejectsSql(`INSERT INTO evidence_items(id,snapshot_id,locator_kind,file_locator_id,locator_id,locator_encrypted,fingerprint,fingerprint_key_version,detector_id,detector_version,observation)
    SELECT $1,$2,locator_kind,file_locator_id,locator_id,locator_encrypted,fingerprint,fingerprint_key_version,detector_id,detector_version,observation FROM evidence_items LIMIT 1`,
    [randomUUID(), randomUUID()], /foreign key constraint/);
}));
test("run creation rejects incompatible rubric, extractor and detector versions without consuming an attempt", () => isolated(async () => {
  const grant = await repository.bindVerifiedGrant(user1, grantFacts(), requestId); const bundle = snapshotBundle(grant.repositoryId);
  await repository.storeSnapshot(user1, grant.grantId, bundle, fixtureCrypto());
  const job = await repository.createJob(user1, { contractVersion: "1.0.0", repositoryIds: [grant.repositoryId], idempotencyKey: randomUUID() }, [grant.grantId], requestId);
  for (const key of ["extractorBundle", "detectorBundle"] as const) {
    const versions = structuredClone(bundle.versions); versions[key].version = "2.0.0";
    await assert.rejects(repository.createRun(user1, job, versions, [bundle.snapshot.snapshotId], requestId), /VERSION_MISMATCH/);
  }
  const versions = structuredClone(bundle.versions); versions.roleRubrics[0].version = "2.0.0";
  await assert.rejects(repository.createRun(user1, job, versions, [bundle.snapshot.snapshotId], requestId), /VERSION_MISMATCH/);
  assert.equal(await count("analysis_job_attempts"), 0);
}));
test("completed payloads and memberships are immutable, including to ordinary service-role operations", () => isolated(async () => {
  const fixture = await prepare(); await repository.finalizeReport(user1, fixture.report, requestId);
  await assert.rejects(repository.finalizeReport(user1, fixture.report, requestId), /ALREADY_FINALIZED/);
  await rejectsSql("UPDATE readiness_reports SET payload = '{}'", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("UPDATE analysis_runs SET versions = versions", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("UPDATE repository_snapshots SET commit_sha = repeat('b', 40)", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("UPDATE evidence_items SET observation = '{}'", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("DELETE FROM report_evidence_citations", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("DELETE FROM file_inventory", [], /IMMUTABLE_CONTENT/);
  await rejectsSql("UPDATE analysis_jobs SET status = 'running', finished_at = null", [], /INVALID_TRANSITION/);
  await rejectsSql("INSERT INTO analysis_run_evidence(run_id,evidence_id,snapshot_id) SELECT run_id,evidence_id,snapshot_id FROM analysis_run_evidence LIMIT 1", [], /IMMUTABLE_CONTENT/);
}));
test("revocation blocks new ingestion/runs/finalization, and retains owner access to completed results", () => isolated(async () => {
  const complete = await prepare(); await repository.finalizeReport(user1, complete.report, requestId);
  const pending = await prepare(user1, "100", ["302"]);
  await repository.revokeGrant(user1, pending.bindings[0].grantId, requestId);
  await assert.rejects(repository.finalizeReport(user1, pending.report, requestId), /ACCESS_REVOKED/);
  await assert.rejects(repository.storeSnapshot(user1, pending.bindings[0].grantId, pending.bundles[0], fixtureCrypto()), /ACCESS_REVOKED/);
  await assert.rejects(repository.createJob(user1, { ...pending.request, idempotencyKey: randomUUID() }, [pending.bindings[0].grantId], requestId), /ACCESS_REVOKED/);
  await repository.revokeGrant(user1, complete.bindings[0].grantId, requestId);
  assert.deepEqual(await repository.readReport(user1, complete.report.reportId), complete.report);
}));
test("new SHA or extraction policy creates a distinct immutable artifact", () => isolated(async () => {
  const grant = await repository.bindVerifiedGrant(user1, grantFacts(), requestId);
  const original = snapshotBundle(grant.repositoryId); const sha = snapshotBundle(grant.repositoryId); const policy = snapshotBundle(grant.repositoryId);
  sha.snapshot.commitSha = "b".repeat(40); sha.evidence[0].commitSha = sha.snapshot.commitSha;
  policy.snapshot.extractionPolicyVersion = "2.0.0";
  const ids = [];
  for (const bundle of [original, sha, policy]) ids.push(await repository.storeSnapshot(user1, grant.grantId, bundle, fixtureCrypto()));
  assert.equal(new Set(ids).size, 3);
  assert.equal(await repository.storeSnapshot(user1, grant.grantId, snapshotBundle(grant.repositoryId), fixtureCrypto()), ids[0]);
  // Even an administrative cleanup cannot cascade away a receipt between ingestion and run creation.
  await rejectsSql("DELETE FROM repository_snapshots WHERE id = $1", [ids[0]], /foreign key constraint/);
}));
test("exports include new owner data and exclude encrypted identifiers, fingerprints, credentials, and raw source", () => isolated(async () => {
  const fixture = await prepare(); await repository.finalizeReport(user1, fixture.report, requestId);
  const data = await repository.exportUserData(user1);
  assert.equal(data.reports.length, 1); assert.equal(data.snapshots.length, 2); assert.equal(data.files.length, 4);
  assert.equal(data.jobs.length, 1); assert.equal(data.accessGrants.length, 2); assert.equal(data.evidence.length, 2);
  const json = JSON.stringify(data);
  for (const forbidden of ["locator_encrypted", "branch_encrypted", "input_fingerprint", "fingerprint_key_version", "tests/synthetic.test.ts", "fixture-sensitive-branch", "github_token", "rawSource"]) assert.ok(!json.includes(forbidden), forbidden);
  const other = await repository.exportUserData(user2); assert.ok(Object.values(other).every(rows => rows.length === 0));
}));
test("analysis deletion removes owner access while shared canonical data survives a second legitimate receipt", () => isolated(async () => {
  const first = await prepare(user1, "100", ["300"]); await repository.finalizeReport(user1, first.report, requestId);
  const secondGrant = await repository.bindVerifiedGrant(user2, grantFacts("200"), requestId);
  assert.equal(await repository.storeSnapshot(user2, secondGrant.grantId, first.bundles[0], fixtureCrypto()), first.bundles[0].snapshot.snapshotId);
  const secondJob = await repository.createJob(user2, { ...first.request, idempotencyKey: randomUUID() }, [secondGrant.grantId], requestId);
  const { runId } = await repository.createRun(user2, secondJob, first.report.versions, [first.bundles[0].snapshot.snapshotId], requestId);
  const secondReport = multiRepositoryReport(user2, secondJob, runId, first.bundles); await repository.finalizeReport(user2, secondReport, requestId);
  await repository.deleteAnalysis(user1, first.jobId, requestId);
  assert.equal(await repository.readReport(user1, first.report.reportId), null);
  assert.equal(await count("repository_snapshots"), 1);
  assert.deepEqual(await repository.readReport(user2, secondReport.reportId), secondReport);
  await repository.deleteAnalysis(user2, secondJob, requestId);
  assert.equal(await count("repository_snapshots"), 0); assert.equal(await count("evidence_items"), 0);
}));
test("account deletion cascades pending/completed jobs and usage links, then prunes canonical data", () => isolated(async () => {
  const fixture = await prepare(); await repository.finalizeReport(user1, fixture.report, requestId);
  const queued = await repository.createJob(user1, { ...fixture.request, idempotencyKey: randomUUID() }, fixture.bindings.map(b => b.grantId), requestId);
  assert.ok(queued);
  await db.query(`INSERT INTO model_runs(attempt_id,job_id,user_id,purpose,provider,model,prompt_version,input_fingerprint,fingerprint_key_version,output_schema_version,validation_status)
    VALUES ($1,$2,$3,'readiness_synthesis','synthetic','fixture','1.0.0',$4,'1.0.0','1.0.0','valid')`, [fixture.attemptId, fixture.jobId, user1, `sha256:${"1".repeat(64)}`]);
  await db.query("DELETE FROM auth.users WHERE id = $1", [user1]);
  await db.query("SET CONSTRAINTS ALL IMMEDIATE");
  for (const table of ["analysis_jobs", "analysis_runs", "readiness_reports", "model_runs", "audit_events", "github_accounts", "repository_access_grants", "snapshot_receipts", "repository_snapshots", "file_inventory", "evidence_items"]) assert.equal(await count(table), 0, table);
}));
test("account deletion preserves another user's legitimate shared canonical observations", () => isolated(async () => {
  const first = await prepare(user1, "100", ["300"]); await repository.finalizeReport(user1, first.report, requestId);
  const grant = await repository.bindVerifiedGrant(user2, grantFacts("200"), requestId);
  await repository.storeSnapshot(user2, grant.grantId, first.bundles[0], fixtureCrypto());
  const job = await repository.createJob(user2, { ...first.request, idempotencyKey: randomUUID() }, [grant.grantId], requestId);
  const { runId } = await repository.createRun(user2, job, first.report.versions, [first.bundles[0].snapshot.snapshotId], requestId);
  const report = multiRepositoryReport(user2, job, runId, first.bundles); await repository.finalizeReport(user2, report, requestId);
  await db.query("DELETE FROM auth.users WHERE id = $1", [user1]); await db.query("SET CONSTRAINTS ALL IMMEDIATE");
  assert.equal(await count("repository_snapshots"), 1);
  assert.deepEqual(await repository.readReport(user2, report.reportId), report);
  assert.equal(await repository.readReport(user1, first.report.reportId), null);
  await db.query("DELETE FROM auth.users WHERE id = $1", [user2]); await db.query("SET CONSTRAINTS ALL IMMEDIATE");
  assert.equal(await count("repository_snapshots"), 0);
}));
test("retention prunes abandoned ingestion receipts and old safe audit data without deleting referenced snapshots", () => isolated(async () => {
  const referenced = await prepare(); await repository.finalizeReport(user1, referenced.report, requestId);
  const abandoned = await repository.bindVerifiedGrant(user1, grantFacts("100", "303"), requestId);
  const bundle = snapshotBundle(abandoned.repositoryId, "303");
  await repository.storeSnapshot(user1, abandoned.grantId, bundle, fixtureCrypto());
  await db.query("DELETE FROM snapshot_receipts WHERE snapshot_id = $1", [bundle.snapshot.snapshotId]);
  await db.query("INSERT INTO snapshot_receipts(user_id,snapshot_id,repository_id,grant_id,created_at) VALUES ($1,$2,$3,$4,now()-interval '25 hours')", [user1, bundle.snapshot.snapshotId, abandoned.repositoryId, abandoned.grantId]);
  await db.query("UPDATE audit_events SET created_at = now()-interval '91 days'");
  const result = await rpc.rpc("feature_one_prune_retention", {}); assert.equal(result.error, null);
  assert.equal(await count("repository_snapshots"), 2); assert.equal(await count("audit_events"), 0);
  assert.deepEqual(await repository.readReport(user1, referenced.report.reportId), referenced.report);
}));
test("suspended installations and revoked verified identities cannot authorize new jobs", () => isolated(async () => {
  const fixture = await prepare(user1, "100", ["300"]);
  await db.query("UPDATE github_installations SET status = 'suspended'");
  await assert.rejects(repository.createJob(user1, { ...fixture.request, idempotencyKey: randomUUID() }, [fixture.bindings[0].grantId], requestId), /ACCESS_REVOKED/);
  await db.query("UPDATE github_installations SET status = 'active'");
  await db.query("UPDATE github_accounts SET revoked_at = now()");
  await assert.rejects(repository.finalizeReport(user1, fixture.report, requestId), /ACCESS_REVOKED/);
}));
test("cancellation is terminal and canceled analysis content is deletable", () => isolated(async () => {
  const fixture = await prepare(); await repository.cancelJob(user1, fixture.jobId, requestId);
  await assert.rejects(repository.finalizeReport(user1, fixture.report, requestId), /ALREADY_FINALIZED/);
  await repository.cancelJob(user1, fixture.jobId, requestId);
  assert.equal((await db.query("SELECT status FROM analysis_jobs")).rows[0].status, "canceled");
  await repository.deleteAnalysis(user1, fixture.jobId, requestId);
  assert.equal(await count("repository_snapshots"), 0);
}));

async function seedVersions() {
  await db.query("INSERT INTO capability_definitions VALUES ('synthetic', '1.0.0', 'testing', 'quality', '{\"synthetic\":true}')");
  for (const role of ["backend", "frontend", "full_stack", "mobile", "ai_application"]) {
    await db.query("INSERT INTO role_templates(role_id,version,taxonomy_id,taxonomy_version,name) VALUES ($1, $2, 'synthetic', '1.0.0', 'Synthetic fixture')", [role, syntheticRubricVersion]);
    await db.query("INSERT INTO role_requirements(role_id,role_version,taxonomy_id,taxonomy_version,capability_id,weight,minimum_evidence,required) VALUES ($1, $2, 'synthetic', '1.0.0', 'testing', 1, 0.5, true)", [role, syntheticRubricVersion]);
  }
}

function nextRubricCatalog(): RubricCatalog {
  const next = structuredClone(initialRubricCatalog);
  next.releaseId = "readiness_1_0_1";
  next.taxonomy.version = "1.0.1";
  next.taxonomy.capabilities.forEach(capability => { capability.taxonomyVersion = "1.0.1"; });
  next.rubrics.forEach(rubric => {
    rubric.version = "1.0.1"; rubric.taxonomyVersion = "1.0.1";
    rubric.requirements.forEach(requirement => { requirement.version = "1.0.1"; });
  });
  next.rubrics[0].requirements[0].minimumEvidence = 0.6;
  return RubricCatalogSchema.parse(next);
}

test("production seeds match the validated manifests and repeated import is idempotent", () => isolated(async () => {
  const rubrics = new RubricRepository(rpc);
  assert.deepEqual(await rubrics.read(user1), initialRubricCatalog);
  assert.equal(await count("capability_definitions", "taxonomy_id = 'engineering_capabilities'"), 34);
  assert.equal(await count("role_templates", "definition IS NOT NULL"), 5);
  assert.equal(await count("role_requirements", "definition IS NOT NULL"), 50);
  const components = initialRubricCatalog.rubrics.flatMap(r => r.requirements).reduce((sum, r) => sum + r.capabilityIds.length, 0);
  assert.equal(await count("role_requirement_capabilities"), components);
  await db.query("SELECT feature_one_private.import_rubric_release($1)", [initialRubricCatalog]);
  await db.query("SELECT feature_one_private.import_rubric_release($1)", [initialRubricCatalog]);
  assert.equal(await count("feature_one_rubric_releases"), 1);
  assert.deepEqual(await rubrics.read(user2, initialRubricCatalog.releaseId), initialRubricCatalog);
}));

test("rubric discovery is service-only and all application roles are denied import, activation and direct registry access", () => isolated(async () => {
  for (const role of ["anon", "authenticated", "service_role"] as const) {
    for (const table of ["feature_one_rubric_releases", "feature_one_taxonomy_versions", "feature_one_active_rubrics", "role_requirement_capabilities"]) {
      await assert.rejects(asRole(role, user1, `SELECT * FROM ${table}`), /permission denied/);
      await assert.rejects(asRole(role, user1, `DELETE FROM ${table}`), /permission denied/);
    }
    await assert.rejects(asRole(role, user1, "SELECT feature_one_private.import_rubric_release($1)", [initialRubricCatalog]), /permission denied/);
    await assert.rejects(asRole(role, user1, "SELECT feature_one_private.activate_rubric_release('readiness_1_0_0')"), /permission denied/);
    if (role !== "service_role") await assert.rejects(asRole(role, user1, "SELECT feature_one_read_rubric_catalog($1, null)", [user1]), /permission denied/);
  }
  await assert.rejects(asRole("service_role", null, "SELECT feature_one_read_rubric_catalog(null, null)"), /NOT_AUTHORIZED/);
  await assert.rejects(asRole("service_role", null, "SELECT feature_one_read_rubric_catalog($1, null)", [randomUUID()]), /NOT_AUTHORIZED/);
  assert.equal(await new RubricRepository(rpc).read(user1, "missing_release"), null);
}));

test("published taxonomy, requirement policies, component membership and release manifests cannot be rewritten or extended", () => isolated(async () => {
  for (const sql of [
    "UPDATE capability_definitions SET definition = '{}' WHERE taxonomy_id = 'engineering_capabilities'",
    "DELETE FROM capability_definitions WHERE taxonomy_id = 'engineering_capabilities'",
    "INSERT INTO capability_definitions VALUES ('engineering_capabilities','1.0.0','new_key','testing','{}')",
    "DELETE FROM role_templates WHERE version = '1.0.0'",
    "DELETE FROM role_requirements WHERE role_version = '1.0.0'",
    "UPDATE role_requirements SET minimum_evidence = 0.4 WHERE role_version = '1.0.0'",
    "DELETE FROM role_requirement_capabilities",
    "UPDATE role_requirement_capabilities SET capability_id = 'testing_failures'",
    "UPDATE feature_one_rubric_releases SET manifest = '{}'",
    "DELETE FROM feature_one_rubric_releases",
    "DELETE FROM feature_one_taxonomy_versions",
  ]) await rejectsSql(sql, [], /IMMUTABLE/);
  const changed = structuredClone(initialRubricCatalog); changed.rubrics[0].name = "Changed meaning";
  await rejectsSql("SELECT feature_one_private.import_rubric_release($1)", [changed], /IMMUTABLE_VERSION/);
  changed.releaseId = "another_release";
  await rejectsSql("SELECT feature_one_private.import_rubric_release($1)", [changed], /IMMUTABLE_VERSION/);
}));

const invalidRubricImports: [string, (catalog: RubricCatalog) => void, RegExp][] = [
  ["duplicate capability", c => { c.taxonomy.capabilities.push(c.taxonomy.capabilities[0]); }, /INVALID_RUBRIC_MANIFEST/],
  ["duplicate requirement", c => { c.rubrics[0].requirements[1] = c.rubrics[0].requirements[0]; }, /INVALID_RUBRIC_MANIFEST/],
  ["missing component", c => { c.rubrics[0].requirements[0].capabilityIds.push("missing"); }, /INVALID_CAPABILITY_REFERENCE/],
  ["technology-only component", c => { c.rubrics[0].requirements[0].capabilityIds.push("framework_presence"); }, /INVALID_CAPABILITY_REFERENCE/],
  ["invalid total", c => { c.rubrics[0].requirements[0].weight = 0.3; }, /INVALID_RUBRIC_WEIGHTS/],
  ["zero total", c => { c.rubrics[0].requirements.forEach(r => { r.weight = 0; }); }, /INVALID_RUBRIC_WEIGHTS/],
  ["negative weight with preserved total", c => { c.rubrics[0].requirements[0].weight = -0.15; c.rubrics[0].requirements[1].weight = 0.45; }, /check constraint/],
  ["dependency-level threshold", c => { c.rubrics[0].requirements[0].minimumEvidence = 0.3; }, /INVALID_RUBRIC_POLICY/],
  ["unbounded threshold", c => { c.rubrics[0].requirements[0].minimumEvidence = 2; }, /INVALID_RUBRIC_POLICY/],
  ["major version jump", c => { c.taxonomy.version = "2.0.0"; }, /UNSUPPORTED_VERSION_TRANSITION/],
  ["skipped version", c => { c.taxonomy.version = "1.0.3"; }, /UNSUPPORTED_VERSION_TRANSITION/],
  ["changed taxonomy without version", c => { c.taxonomy.version = "1.0.0"; }, /IMMUTABLE_VERSION/],
];
for (const [name, mutate, expected] of invalidRubricImports) test(`rubric import rejects ${name} atomically`, () => isolated(async () => {
  const value = nextRubricCatalog(); mutate(value);
  await rejectsSql("SELECT feature_one_private.import_rubric_release($1)", [value], expected);
  assert.equal(await count("feature_one_rubric_releases"), 1);
  assert.equal(await count("feature_one_taxonomy_versions"), 1);
}));

test("new active versions and rollback preserve an existing report's original production taxonomy and rubric meaning", () => isolated(async () => {
  const binding = await repository.bindVerifiedGrant(user1, grantFacts("100", "304"), requestId);
  const bundle = snapshotBundle(binding.repositoryId, "304");
  bundle.versions.taxonomy = { id: initialRubricCatalog.taxonomy.id, version: initialRubricCatalog.taxonomy.version };
  bundle.versions.roleRubrics = initialRubricCatalog.rubrics.map(r => ({ roleId: r.roleId, version: r.version }));
  bundle.evidence[0].capabilityIds = ["testing_behavior"];
  await repository.storeSnapshot(user1, binding.grantId, bundle, fixtureCrypto());
  const jobId = await repository.createJob(user1, { contractVersion: "1.0.0", repositoryIds: [binding.repositoryId], idempotencyKey: randomUUID() }, [binding.grantId], requestId);
  const { runId } = await repository.createRun(user1, jobId, bundle.versions, [bundle.snapshot.snapshotId], requestId);
  const fixture = multiRepositoryReport(user1, jobId, runId, [bundle]);
  // Remap only synthetic capability keys to the published testing behavior; this is not detector output.
  const report = ReadinessReportResponseSchema.parse(JSON.parse(JSON.stringify(fixture), (key, value) => {
    if (key === "capabilityId" && value === "testing") return "testing_behavior";
    if (key === "capabilityIds") return value.map((id: string) => id === "testing" ? "testing_behavior" : id);
    if (key === "groupId" && value === "quality") return "testing";
    return value;
  }));
  await repository.finalizeReport(user1, report, requestId);
  const next = nextRubricCatalog();
  await db.query("SELECT feature_one_private.import_rubric_release($1)", [next]);
  await db.query("SELECT feature_one_private.activate_rubric_release($1)", [next.releaseId]);
  const discovery = new RubricRepository(rpc);
  assert.deepEqual(await discovery.read(user1), next);
  await db.query("SELECT feature_one_private.import_rubric_release($1)", [initialRubricCatalog]);
  assert.deepEqual(await discovery.read(user1), next, "repeated seed must not reset the active pointer");
  assert.deepEqual(await repository.readReport(user1, report.reportId), report);
  assert.deepEqual(await discovery.read(user1, initialRubricCatalog.releaseId), initialRubricCatalog);
  assert.equal((await db.query("SELECT minimum_evidence FROM role_requirements WHERE role_id = 'backend' AND role_version = '1.0.0' AND capability_id = 'api_design'")).rows[0].minimum_evidence, "0.55");
  await rejectsSql("SELECT feature_one_private.activate_rubric_release('absent')", [], /UNKNOWN_RUBRIC_RELEASE/);
  await db.query("SELECT feature_one_private.activate_rubric_release($1)", [initialRubricCatalog.releaseId]);
  assert.deepEqual(await discovery.read(user1), initialRubricCatalog);
  assert.deepEqual(await discovery.read(user1, next.releaseId), next);
  assert.deepEqual(await repository.readReport(user1, report.reportId), report);
}));

const githubRepository = new GitHubConnectionRepository(rpc);
const githubVault = new GitHubVault(testKey);
async function githubState(actor = user1, stage: 'authorize' | 'install' = 'authorize') {
  const hash = digest(randomSecret()); const binding = digest(randomSecret());
  const session = randomUUID(); await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)', [session, actor]);
  const payload = githubVault.seal({ verifier: 'synthetic-pkce-only' }, `state:${actor}:${hash}`);
  await githubRepository.startState(actor, hash, binding, stage, payload, new Date(Date.now() + 600000).toISOString(), session);
  return { hash, binding, payload, session };
}
async function githubLink(actor = user1, provider = '100') {
  const state = await githubState(actor);
  await githubRepository.consumeState(actor, state.hash, state.binding, 'authorize');
  const ciphertext = githubVault.seal({ token: 'synthetic-user-token' }, `user:${actor}:${provider}`);
  const account = await githubRepository.link(actor, provider, 'fixture-login', ciphertext, new Date(Date.now() + 28800000).toISOString(), state.hash);
  return { account, credential: await githubRepository.credential(actor, account) };
}
async function githubDiscovery(actor = user1, provider = '100') {
  const { account, credential } = await githubLink(actor, provider);
  const installation = await githubRepository.associate(actor, account, credential.revision, fixtureInstallation());
  const locatorEncrypted = githubVault.seal({ owner: 'fixture-org', name: 'private-name-sentinel' }, `repo:${actor}:${account}:${installation}:300`);
  const [repo] = await githubRepository.discover(actor, account, credential.revision, installation, [{ id: '300', providerOwnerId: '200', visibility: 'private', locatorEncrypted }]);
  return { account, credential, installation, repository: repo.repositoryId, locatorEncrypted };
}
test('GitHub state is bound to actor, session, stage, expiry and a single callback consumption', () => isolated(async () => {
  const state = await githubState();
  for (const [actor, binding, stage] of [[user2, state.binding, 'authorize'], [user1, digest('foreign-session'), 'authorize'], [user1, state.binding, 'install']] as const) {
    await assert.rejects(githubRepository.consumeState(actor, state.hash, binding, stage), /different session/);
  }
  assert.equal(await githubRepository.consumeState(user1, state.hash, state.binding, 'authorize'), state.payload);
  await assert.rejects(githubRepository.consumeState(user1, state.hash, state.binding, 'authorize'), /different session/);
  const expired = await githubState();
  await db.query('UPDATE feature_one_private.github_connection_states SET expires_at = now() - interval \'1 second\' WHERE state_hash = $1', [expired.hash]);
  await assert.rejects(githubRepository.consumeState(user1, expired.hash, expired.binding, 'authorize'), /different session/);
  await assert.rejects(githubRepository.startState(user1, digest('invalid'), digest('session'), 'authorize', state.payload, new Date(Date.now() + 3600000).toISOString(), state.session), /Invalid/);
}));
test('GitHub RPCs and credentials stay closed to browser roles and direct service table reads', () => isolated(async () => {
  const fixture = await githubDiscovery();
  for (const role of ['anon', 'authenticated', 'service_role'] as const) {
    for (const table of ['public.github_installation_connections', 'public.github_discovered_repositories', 'feature_one_private.github_user_credentials', 'feature_one_private.github_connection_states']) {
      await assert.rejects(asRole(role, user1, `SELECT * FROM ${table}`), /permission denied/);
    }
  }
  for (const role of ['anon', 'authenticated'] as const) {
    await assert.rejects(asRole(role, user1, 'SELECT feature_one_github_credential($1,$2)', [user1, fixture.account]), /permission denied/);
    await assert.rejects(asRole(role, user1, 'SELECT feature_one_github_unlink($1,$2)', [user1, fixture.account]), /permission denied/);
  }
  assert.deepEqual(await githubRepository.accounts(user2), []);
  await assert.rejects(githubRepository.credential(user2, fixture.account), /Reconnect/);
  await assert.rejects(githubRepository.connection(user2, fixture.account, fixture.installation), /not found/);
  await assert.rejects(githubRepository.repository(user2, fixture.account, fixture.installation, fixture.repository), /not found/);
}));
test('GitHub identity links preserve ownership across multiple identities, reconnects and legacy login writes', () => isolated(async () => {
  const first = await githubLink(); const repeat = await githubLink();
  assert.equal(first.account, repeat.account); assert.notEqual(first.credential.revision, repeat.credential.revision);
  assert.notEqual((await githubLink(user1, '101')).account, first.account);
  await assert.rejects(githubLink(user2, '100'), /cannot be linked/);
  await rejectsSql("INSERT INTO github_tokens(user_id,github_user_id,github_username,github_token) VALUES($1,100,'foreign','synthetic')", [user2], /IDENTITY_CONFLICT/);
  await db.query("INSERT INTO github_tokens(user_id,github_user_id,github_username,github_token) VALUES($1,999,'legacy','synthetic')", [user2]);
  await assert.rejects(githubLink(user1, '999'), /cannot be linked/);
  assert.equal((await githubRepository.accounts(user1)).length, 2);
}));
test('GitHub discovery has no attestation grant, retains canonical rows and exports only safe owner data', () => isolated(async () => {
  const first = await githubDiscovery(); const second = await githubDiscovery(user2, '101');
  assert.equal(first.repository, second.repository); assert.equal(first.installation, second.installation);
  assert.equal(await count('repository_access_grants'), 0);
  await asRole('service_role', null, 'SELECT feature_one_prune_retention()');
  assert.equal(await count('repositories'), 1); assert.equal(await count('github_installations'), 1);
  const data = await repository.exportUserData(user1);
  assert.equal(data.githubConnections.length, 1); assert.equal(data.discoveredRepositories.length, 1);
  assert.equal(data.installations.length, 1); assert.equal(data.repositories.length, 1);
  const legacy = (await asRole('service_role', null, 'SELECT feature_one_export($1) AS data', [user1])).rows[0].data;
  assert.equal('githubConnections' in legacy, false); // Older strict consumers keep their original shape.
  assert.equal('discoveredRepositories' in legacy, false);
  const serialized = JSON.stringify(data);
  for (const secret of ['synthetic-user-token', 'private-name-sentinel', 'credential_encrypted', 'locator_encrypted', first.credential.encrypted]) assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes(second.account));
  await db.query('DELETE FROM auth.users WHERE id=$1', [user1]); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.equal(await count('github_installation_connections'), 1); assert.equal(await count('repositories'), 1);
  await db.query('DELETE FROM auth.users WHERE id=$1', [user2]); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.equal(await count('repositories'), 0); assert.equal(await count('github_installations'), 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM feature_one_private.github_user_credentials')).rows[0].n, 0);
}));
test('GitHub unlink fences delayed callbacks, stale credentials and pending grants without reviving them on reconnect', () => isolated(async () => {
  const fixture = await githubDiscovery();
  const grant = await repository.bindVerifiedGrant(user1, { ...grantFacts(), providerOwnerId: '200' }, requestId);
  const state = await githubState(); await githubRepository.consumeState(user1, state.hash, state.binding, 'authorize');
  await githubRepository.unlink(user2, fixture.account); // Foreign unlink is an indistinguishable no-op.
  assert.equal((await githubRepository.credential(user1, fixture.account)).revision, fixture.credential.revision);
  await githubRepository.unlink(user1, fixture.account);
  await assert.rejects(githubRepository.link(user1, '100', 'late-callback', fixture.credential.encrypted, fixture.credential.expiresAt, state.hash), /different session/);
  await assert.rejects(githubRepository.associate(user1, fixture.account, fixture.credential.revision, fixtureInstallation()), /Reconnect/);
  assert.equal(await count('github_installation_connections'), 0);
  assert.equal((await db.query('SELECT revoked_at IS NOT NULL AS revoked FROM repository_access_grants WHERE id=$1', [grant.grantId])).rows[0].revoked, true);
  const fresh = await githubLink(); assert.equal(fresh.account, fixture.account);
  await assert.rejects(githubRepository.associate(user1, fixture.account, fixture.credential.revision, fixtureInstallation()), /Reconnect/);
  assert.equal((await db.query('SELECT revoked_at IS NOT NULL AS revoked FROM repository_access_grants WHERE id=$1', [grant.grantId])).rows[0].revoked, true);
}));
test('GitHub persistence rejects owner substitution and stale discovery publication', () => isolated(async () => {
  const fixture = await githubDiscovery();
  await assert.rejects(githubRepository.discover(user1, fixture.account, fixture.credential.revision, fixture.installation,
    [{ id: '301', providerOwnerId: '999', visibility: 'private', locatorEncrypted: fixture.locatorEncrypted }]), /access or ownership changed/);
  await githubLink();
  await assert.rejects(githubRepository.discover(user1, fixture.account, fixture.credential.revision, fixture.installation, []), /Reconnect/);
  assert.equal(await count('github_discovered_repositories'), 1);
}));
test('independent PostgreSQL connections cannot both consume an installation state', async () => {
  const actor = randomUUID(); const hash = digest(randomSecret()); const binding = digest(randomSecret());
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  const session = randomUUID(); await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)', [session, actor]);
  await db.query('SELECT feature_one_github_start_state($1,$2,$3,$4,$5,$6,$7)', [actor, hash, binding, 'install', githubVault.seal({}, 'test'), new Date(Date.now() + 600000).toISOString(), session]);
  const consume = async () => {
    const client = new pg.Client(config); await client.connect();
    try {
      await client.query('SET ROLE service_role');
      return await client.query('SELECT feature_one_github_consume_state($1,$2,$3,$4)', [actor, hash, binding, 'install']);
    } finally { await client.end(); }
  };
  try {
    const results = await Promise.allSettled([consume(), consume()]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && /INVALID_STATE/.test(result.reason.message)).length, 1);
  } finally { await db.query('DELETE FROM auth.users WHERE id=$1', [actor]); }
});

test('signed-out Supabase sessions invalidate both pending and consumed connection callbacks', () => isolated(async () => {
  const state = await githubState();
  assert.equal(await githubRepository.activeSession(user1, state.session), true);
  assert.equal(await githubRepository.activeSession(user2, state.session), false);
  await githubRepository.consumeState(user1, state.hash, state.binding, 'authorize');
  await db.query('DELETE FROM auth.sessions WHERE id=$1', [state.session]);
  assert.equal(await githubRepository.activeSession(user1, state.session), false);
  await assert.rejects(githubRepository.link(user1, '100', 'fixture', githubVault.seal({ token: 'synthetic' }, 'test'), new Date(Date.now() + 3600000).toISOString(), state.hash), /different session/);
  await assert.rejects(githubRepository.startState(user1, digest('after-logout'), state.binding, 'install', state.payload, new Date(Date.now() + 600000).toISOString(), state.session), /different session/);
}));
test('provider suspension, permissions and missing-installation status are persisted without granting scans', () => isolated(async () => {
  const fixture = await githubDiscovery();
  await githubRepository.associate(user1, fixture.account, fixture.credential.revision, { ...fixtureInstallation(), suspended_at: new Date().toISOString(), permissions: { metadata: 'read' } });
  const row = (await db.query('SELECT status,permissions FROM github_installations WHERE id=$1', [fixture.installation])).rows[0];
  assert.equal(row.status, 'suspended'); assert.deepEqual(row.permissions, { metadata: 'read' });
  await assert.rejects(githubRepository.discover(user1, fixture.account, fixture.credential.revision, fixture.installation, []), /not found/);
  await githubRepository.markMissing(user1, fixture.account, fixture.credential.revision, fixture.installation);
  assert.equal((await db.query('SELECT status FROM github_installations WHERE id=$1', [fixture.installation])).rows[0].status, 'deleted');
  assert.equal(await count('repository_access_grants'), 0);
}));


async function selectionFixture() {
  const discovery = await githubDiscovery();
  const provider = new SyntheticGitHubProvider();
  provider.users.set('synthetic-user-token', { id: '100', login: 'fixture-login' });
  provider.access.set('synthetic-user-token', new Map([['500', ['300', '301']]]));
  provider.repositories.get('300')!.name = 'private-name-sentinel';
  const github = new GitHubConnectionService(githubRepository, provider, githubVault,
    { appId: '42', clientId: 'test', slug: 'fixture', frontendOrigin: 'https://repofy.example' });
  const service = new RepositorySelectionService(rpc, github, githubVault, 5);
  const saved = await service.read(user1);
  const request = { expectedRevision: saved.revision, idempotencyKey: randomUUID(), repositories: [
    { repositoryId: discovery.repository, accountId: discovery.account, installationId: discovery.installation }],
    attestation: { version: '1.0.0', accepted: true } };
  return { discovery, provider, github, service, request };
}
async function webhook(event = 'installation_repositories', action = 'removed', delivery = randomUUID(), extra = {}) {
  const body = Buffer.from(JSON.stringify({ action, installation: { id: 500 }, repositories_removed: [{ id: 300 }], ...extra }));
  return new GitHubWebhookService(rpc, 'fixture-secret').receive(body,
    'sha256=' + createHmac('sha256', 'fixture-secret').update(body).digest('hex'), delivery, event);
}

test('selection persists encrypted display and server-owned attestation; replay preserves grants and audit count', () => isolated(async () => {
  const { service, request } = await selectionFixture();
  const saved = await service.save(user1, request, requestId);
  assert.equal(saved.repositories[0].fullName, 'fixture-org/private-name-sentinel');
  assert.equal(saved.repositories[0].status, 'active');
  assert.deepEqual(await service.read(user1), saved);
  assert.deepEqual(await service.save(user1, request, randomUUID()), saved);
  assert.equal(await count('repository_access_grants'), 1);
  assert.equal(await count('audit_events', "action = 'repository_selected'"), 1);
  const { rows: [grant] } = await db.query('SELECT * FROM repository_access_grants');
  assert.equal(grant.attestation_confirmed, true);
  assert.match(grant.statement_text, /authorized to submit/);
  assert.equal(grant.statement_version, '1.0.0');
  const exported = await repository.exportUserData(user1);
  assert.equal(exported.repositorySelections.length, 1);
  assert.ok(!JSON.stringify(exported).includes('private-name-sentinel'));
  assert.ok(!JSON.stringify(exported).includes('display_encrypted'));
  assert.deepEqual((await service.read(user2)).repositories, []);
}));

test('selection rejects tampering, missing consent, excess count, mixed and cross-user IDs without partial grants', () => isolated(async () => {
  const { service, request } = await selectionFixture();
  for (const input of [{ ...request, attestation: undefined }, { ...request, attestation: { version: '9.0.0', accepted: true } },
    { ...request, attestedAt: new Date().toISOString() }, { ...request, repositories: [...request.repositories, { ...request.repositories[0], repositoryId: randomUUID() }] },
    { ...request, repositories: Array.from({ length: 6 }, () => ({ ...request.repositories[0], repositoryId: randomUUID() })) }]) {
    await assert.rejects(service.save(user1, input, requestId));
  }
  await assert.rejects(service.save(user2, request, requestId));
  assert.equal(await count('repository_access_grants'), 0);
}));

test('selection rejects provider removal and archived/empty repositories', () => isolated(async () => {
  const { provider, service, request } = await selectionFixture();
  provider.repositories.get('300')!.archived = true;
  await assert.rejects(service.save(user1, request, requestId), /not archived/);
  provider.repositories.get('300')!.archived = false; provider.repositories.get('300')!.default_branch = null;
  await assert.rejects(service.save(user1, request, requestId), /default branch/);
  provider.repositories.get('300')!.default_branch = 'main'; provider.access.get('synthetic-user-token')!.set('500', []);
  await assert.rejects(service.save(user1, request, requestId));
  assert.equal(await count('repository_access_grants'), 0);
}));

test('selection update is atomic, optimistic and duplicate-key protected; removal is owner-scoped and idempotent', () => isolated(async () => {
  const { service, request } = await selectionFixture();
  const saved = await service.save(user1, request, requestId); const grant = saved.repositories[0];
  await assert.rejects(service.save(user1, { ...request, repositories: [] }, requestId), /saved selection changed/);
  await assert.rejects(service.save(user1, { ...request, idempotencyKey: randomUUID() }, requestId), /saved selection changed/);
  assert.deepEqual((await service.remove(user2, grant.grantId, requestId)).repositories, []);
  await service.checkGrant(user1, grant.grantId, grant.accessRevision);
  const empty = await service.remove(user1, grant.grantId, requestId);
  assert.deepEqual(empty.repositories, []);
  assert.deepEqual(await service.remove(user1, grant.grantId, requestId), empty);
  await assert.rejects(service.checkGrant(user1, grant.grantId, grant.accessRevision), /access changed/);
  assert.equal(await count('audit_events', "action = 'grant_revoked'"), 1);
}));

test('verified repository removal revokes grants/revisions, clears discoveries and duplicates have no repeated effects', () => isolated(async () => {
  const { service, request } = await selectionFixture();
  const saved = await service.save(user1, request, requestId); const grant = saved.repositories[0];
  const delivery = randomUUID();
  assert.equal((await webhook('installation_repositories', 'removed', delivery)).duplicate, false);
  const revoked = await service.read(user1);
  assert.equal(revoked.repositories[0].status, 'revoked');
  assert.notEqual(revoked.repositories[0].accessRevision, grant.accessRevision);
  assert.notEqual(revoked.revision, saved.revision);
  assert.equal(await count('github_discovered_repositories'), 0);
  await assert.rejects(service.checkGrant(user1, grant.grantId, grant.accessRevision), /access changed/);
  assert.equal((await webhook('installation_repositories', 'removed', delivery)).duplicate, true);
  assert.deepEqual(await service.read(user1), revoked);
  assert.equal(await count('audit_events', "action = 'grant_revoked'"), 1);
  await assert.rejects(webhook('installation_repositories', 'added', delivery), /could not be processed/);
  await service.remove(user1, grant.grantId, requestId);
  await service.remove(user1, grant.grantId, requestId);
  assert.equal(await count('audit_events', "action = 'repository_deselected'"), 1);
}));

test('revocation during provider verification prevents selection commit even when provider returns stale allowed access', () => isolated(async () => {
  const { provider, service, request } = await selectionFixture();
  const original = provider.getRepositoryInstallation.bind(provider);
  provider.getRepositoryInstallation = async (...args) => { const result = await original(...args); await webhook(); return result; };
  await assert.rejects(service.save(user1, request, requestId), /access changed/);
  assert.equal(await count('repository_access_grants'), 0);
}));

test('old additions and unsuspensions never reactivate revoked grants; new selection requires fresh provider verification', () => isolated(async () => {
  const { service, request, github, discovery } = await selectionFixture();
  const saved = await service.save(user1, request, requestId);
  await webhook('installation', 'suspend');
  await webhook('installation', 'unsuspend');
  await webhook('installation_repositories', 'added', randomUUID(), { repositories_removed: [] });
  assert.equal((await service.read(user1)).repositories[0].status, 'revoked');
  await rejectsSql('UPDATE repository_access_grants SET revoked_at = NULL WHERE id = $1', [saved.repositories[0].grantId], /ACCESS_REVOKED/);
  await github.repositories(user1, discovery.account, discovery.installation);
  const renewed = await service.save(user1, { ...request, idempotencyKey: randomUUID(), expectedRevision: (await service.read(user1)).revision }, requestId);
  assert.equal(renewed.repositories[0].status, 'active');
  assert.notEqual(renewed.repositories[0].grantId, saved.repositories[0].grantId);
  await assert.rejects(service.checkGrant(user1, saved.repositories[0].grantId, saved.repositories[0].accessRevision));
}));

for (const event of ['deleted', 'new_permissions_accepted']) test(`installation ${event} revokes all scoped grants`, () => isolated(async () => {
  const { service, request } = await selectionFixture(); await service.save(user1, request, requestId);
  await webhook('installation', event);
  assert.equal((await service.read(user1)).repositories[0].status, 'revoked');
}));
test('GitHub authorization revocation removes credentials/connections and blocks token use', () => isolated(async () => {
  const { service, request, discovery } = await selectionFixture(); await service.save(user1, request, requestId);
  await webhook('github_app_authorization', 'revoked', randomUUID(), { sender: { id: 100 } });
  assert.equal((await service.read(user1)).repositories[0].status, 'revoked');
  await assert.rejects(githubRepository.credential(user1, discovery.account), /Reconnect/);
  assert.equal(await count('github_installation_connections'), 0);
}));
test('selection security tables and RPCs are service-only; account deletion removes selection metadata', () => isolated(async () => {
  const { service, request } = await selectionFixture(); await service.save(user1, request, requestId);
  for (const role of ['anon', 'authenticated', 'service_role'] as const) {
    for (const table of ['public.repository_selections', 'feature_one_private.repository_selection_items', 'feature_one_private.repository_selection_requests', 'feature_one_private.github_webhook_receipts'])
      await assert.rejects(asRole(role, user1, `SELECT * FROM ${table}`), /permission denied/);
    if (role !== 'service_role') await assert.rejects(asRole(role, user1, 'SELECT feature_one_selection_read($1)', [user1]), /permission denied/);
  }
  await db.query('DELETE FROM auth.users WHERE id = $1', [user1]); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.equal(await count('repository_selections'), 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM feature_one_private.repository_selection_items')).rows[0].n, 0);
}));

test('repository access-change events preserve other selected repositories and require fresh private attestation', () => isolated(async () => {
  const { service, request, github, provider, discovery } = await selectionFixture();
  provider.repositories.get('300')!.private = false;
  provider.installations.get('500')!.account.type = 'User';
  await github.installations(user1, discovery.account);
  const listed = await github.repositories(user1, discovery.account, discovery.installation);
  const publicSave = await service.save(user1, { ...request, attestation: undefined }, requestId);
  const old = publicSave.repositories[0];
  const { rows: [oldGrant] } = await db.query('SELECT attestation_confirmed, statement_text FROM repository_access_grants WHERE id = $1', [old.grantId]);
  assert.equal(oldGrant.attestation_confirmed, false); assert.match(oldGrant.statement_text, /public personal/);
  provider.repositories.get('300')!.private = true;
  const update = { ...request, idempotencyKey: randomUUID(), expectedRevision: publicSave.revision,
    repositories: listed.repositories.map(({ repositoryId, accountId, installationId }) => ({ repositoryId, accountId, installationId })) };
  await assert.rejects(service.save(user1, { ...update, attestation: undefined }, requestId), /Confirm your authorization/);
  const saved = await service.save(user1, update, requestId);
  const upgraded = saved.repositories.find(item => item.repositoryId === old.repositoryId)!;
  assert.notEqual(upgraded.grantId, old.grantId);
  const other = saved.repositories.find(item => item.repositoryId !== old.repositoryId)!;
  await webhook('repository', 'privatized', randomUUID(), { repository: { id: 300 } });
  const current = await service.read(user1);
  assert.equal(current.repositories.find(item => item.grantId === upgraded.grantId)!.status, 'revoked');
  assert.equal(current.repositories.find(item => item.grantId === other.grantId)!.status, 'active');
  await service.checkGrant(user1, other.grantId, other.accessRevision);
}));

async function ingestionFixture() {
  const selected = await selectionFixture(); const saved = await selected.service.save(user1, selected.request, requestId);
  const choice = saved.repositories[0];
  const jobId = await repository.createJob(user1, { contractVersion: '1.0.0', repositoryIds: [choice.repositoryId], idempotencyKey: randomUUID() }, [choice.grantId], requestId);
  const request = { actor: user1, jobId, repositoryId: choice.repositoryId };
  const store = new IngestionRepository(rpc, fixtureCrypto()); const root = await mkdtemp(join(tmpdir(), 'repofy-ingestion-pg-'));
  const archive = archiveFixture([{ path: 'fixture-root/src/owner-only-file.ts', body: 'export const value = 42;' },
    { path: 'fixture-root/odd.secret-data', body: 'ghp_' + 'A7'.repeat(20) }]);
  const transport = new GitHubArchiveClient(async (url) => new URL(String(url)).hostname === 'api.github.com'
    ? new Response(null, { status: 302, headers: { location: 'https://codeload.github.com/fixture-org/private-name-sentinel/legacy.tar.gz/' + 'a'.repeat(40) } })
    : new Response(archive));
  // Match the verified synthetic provider coordinates, not any browser-supplied URL.
  const source = new GitHubSnapshotSource(selected.github, transport);
  const ingestion = new SnapshotIngestionService(store, source, fixtureCrypto(), new WorkspaceManager(root));
  return { ...selected, choice, request, store, root, source, ingestion };
}

test('ingestion requires confirmed consent on legacy private or organization grants', () => isolated(async () => {
  const binding = await repository.bindVerifiedGrant(user1,grantFacts(),requestId);
  const jobId = await repository.createJob(user1,{ contractVersion:'1.0.0',repositoryIds:[binding.repositoryId],idempotencyKey:randomUUID() },[binding.grantId],requestId);
  await assert.rejects(new IngestionRepository(rpc,fixtureCrypto()).access({ actor:user1,jobId,repositoryId:binding.repositoryId }),/ACCESS_REVOKED/);
}));

test('ingestion persists the authorized SHA before download and only encrypted scanned locators afterward', () => isolated(async () => {
  const f = await ingestionFixture();
  try {
    const pin = await f.ingestion.resolveSnapshot(f.request);
    assert.equal(pin.commitSha, 'a'.repeat(40));
    f.provider.resolveCommit = async () => 'b'.repeat(40);
    await f.ingestion.withSafeSnapshot(f.request, async context => {
      assert.equal(context.snapshot.commitSha, pin.commitSha); assert.equal((await context.files()).length, 1);
      assert.equal(context.summary.excluded.secret_or_sensitive_data, 1);
      assert.deepEqual(await readdir(f.root), []);
    });
    const rows = await db.query('SELECT to_jsonb(p) AS pin,to_jsonb(a) AS attempt,to_jsonb(f) AS file FROM feature_one_private.ingestion_pins p JOIN feature_one_private.ingestion_attempts a ON a.pin_id=p.id JOIN feature_one_private.ingestion_files f ON f.attempt_id=a.id');
    assert.equal(rows.rows[0].attempt.state, 'disposed');
    const serialized = JSON.stringify(rows.rows); assert.doesNotMatch(serialized, /owner-only-file|export const|ghp_|odd.secret-data/);
    assert.equal(fixtureCrypto().decryptLocator(rows.rows[0].file.locator_encrypted, { repositoryId: f.request.repositoryId, snapshotId: pin.pinId, locatorId: rows.rows[0].file.locator_id }).kind, 'file');
    const exported = await repository.exportUserData(user1);
    assert.equal(exported.ingestionSnapshots.length, 1); assert.equal(exported.ingestionFiles.length, 1);
    assert.doesNotMatch(JSON.stringify(exported.ingestionFiles), /locator_encrypted|fingerprint|content_hash|owner-only/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
}));

test('ingestion is owner/job/grant scoped and policy changes cannot replace a durable pin', () => isolated(async () => {
  const f = await ingestionFixture();
  try {
    const pin = await f.ingestion.resolveSnapshot(f.request);
    await assert.rejects(f.store.readPin({ ...f.request, actor: user2 }), /CANCELED/);
    await assert.rejects(f.store.readPin({ ...f.request, repositoryId: randomUUID() }), /ACCESS_REVOKED/);
    const policy = securityPolicy({ totalLines: 123 });
    await assert.rejects(f.store.pin(f.request, { ...pin, policy, policyHash: policyHash(policy) }), /POLICY_MISMATCH/);
    await rejectsSql("UPDATE feature_one_private.ingestion_pins SET commit_sha=$1 WHERE id=$2", ['b'.repeat(40),pin.pinId], /IMMUTABLE/);
    for (const role of ['anon','authenticated','service_role'] as const) {
      await assert.rejects(asRole(role, user2, 'SELECT * FROM feature_one_private.ingestion_pins'), /permission denied/);
      if (role !== 'service_role') await assert.rejects(asRole(role, user1, 'SELECT feature_one_ingestion_access($1,$2,$3)', [user1,f.request.jobId,f.request.repositoryId]), /permission denied/);
    }
  } finally { await rm(f.root, { recursive: true, force: true }); }
}));

test('expired leases, revocation, cancellation and deletion fence ingestion without preventing cleanup', () => isolated(async () => {
  const f = await ingestionFixture();
  try {
    const pin = await f.ingestion.resolveSnapshot(f.request); const attempt = randomUUID(); const token = await f.store.begin(user1,pin.pinId,attempt);
    await f.store.checkpoint(user1,attempt,token);
    assert.equal(await f.store.claimExpired(attempt),false);
    await db.query("UPDATE feature_one_private.ingestion_attempts SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[attempt]);
    assert.equal(await f.store.claimExpired(attempt),true);
    await assert.rejects(f.store.checkpoint(user1,attempt,token), /LEASE_LOST/);
    const next = randomUUID(); const nextToken = await f.store.begin(user1,pin.pinId,next);
    await webhook(); await assert.rejects(f.store.checkpoint(user1,next,nextToken), /ACCESS_REVOKED/);
    await f.store.dispose(user1,next,nextToken); assert.equal(await f.store.claimExpired(next),true);
    await repository.cancelJob(user1,f.request.jobId,requestId); await assert.rejects(f.store.readPin(f.request), /CANCELED/);
    await repository.deleteAnalysis(user1,f.request.jobId,requestId); assert.equal(await f.store.claimExpired(next),true);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM feature_one_private.ingestion_pins')).rows[0].n,0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
}));

test('canonical snapshots and runs cannot reuse a different security policy or legacy extraction', () => isolated(async () => {
  const binding = await repository.bindVerifiedGrant(user1,grantFacts(),requestId);
  const first = snapshotBundle(binding.repositoryId); first.snapshot.securityPolicyHash = policyHash(securityPolicy()) as never; first.versions.ingestionPolicyHash = first.snapshot.securityPolicyHash;
  const second = snapshotBundle(binding.repositoryId); second.snapshot.securityPolicyHash = policyHash(securityPolicy({ totalLines: 100 })) as never; second.versions.ingestionPolicyHash = second.snapshot.securityPolicyHash;
  const a = await repository.storeSnapshot(user1,binding.grantId,first,fixtureCrypto());
  const b = await repository.storeSnapshot(user1,binding.grantId,second,fixtureCrypto()); assert.notEqual(a,b);
  const job = await repository.createJob(user1,{ contractVersion:'1.0.0',repositoryIds:[binding.repositoryId],idempotencyKey:randomUUID() },[binding.grantId],requestId);
  await assert.rejects(repository.createRun(user1,job,first.versions,[b],requestId),/VERSION_MISMATCH/);
  const run = await repository.createRun(user1,job,first.versions,[a],requestId);
  const report = multiRepositoryReport(user1,job,run.runId,[first]);
  const changed = structuredClone(report); changed.snapshots[0].securityPolicyHash = second.snapshot.securityPolicyHash;
  await rejectsSql('SELECT feature_one_finalize_report($1,$2,$3)',[user1,changed,requestId],/VERSION_MISMATCH/);
  await repository.finalizeReport(user1,report,requestId);
}));

test('independent workers converge on the first SHA and expired cleanup fences a waiting worker', { timeout: 15000 }, async () => {
  const actor = randomUUID(); const store = new IngestionRepository(rpc, fixtureCrypto());
  const left = new pg.Client(config); const right = new pg.Client(config);
  await left.connect(); await right.connect();
  try {
    await db.query('BEGIN'); await db.query('INSERT INTO auth.users(id) VALUES($1)',[actor]);
    const binding = await repository.bindVerifiedGrant(actor,{ ...grantFacts('880','881'), providerInstallationId:'882',providerOwnerId:'880',ownerType:'User',visibility:'public' },randomUUID());
    const jobId = await repository.createJob(actor,{ contractVersion:'1.0.0',repositoryIds:[binding.repositoryId],idempotencyKey:randomUUID() },[binding.grantId],randomUUID());
    const request = { actor,jobId,repositoryId:binding.repositoryId }; const access = await store.access(request);
    const policy = securityPolicy();
    const proposal = (sha: string) => {
      const pinId = randomUUID(); return { ...access,pinId,jobId,repositoryId:binding.repositoryId,commitSha:sha,resolvedAt:new Date().toISOString(),policy,policyHash:policyHash(policy),
        branchEncrypted:fixtureCrypto().encryptBranch('main',{ repositoryId:binding.repositoryId,snapshotId:pinId,locatorId:pinId }) };
    };
    await db.query('COMMIT'); await left.query('SET ROLE service_role'); await right.query('SET ROLE service_role');
    await left.query('BEGIN');
    const sql = 'SELECT feature_one_ingestion_pin($1,$2,$3,$4) AS pin';
    const pinned = (await left.query(sql,[actor,jobId,binding.repositoryId,proposal('a'.repeat(40))])).rows[0].pin;
    const competing = right.query(sql,[actor,jobId,binding.repositoryId,proposal('b'.repeat(40))]);
    await left.query('COMMIT');
    const result = (await competing).rows[0].pin; assert.equal(result.pinId,pinned.pinId); assert.equal(result.commitSha,'a'.repeat(40));
    await db.query('BEGIN'); const attempt = randomUUID(); const token = await store.begin(actor,pinned.pinId,attempt);
    await db.query("UPDATE feature_one_private.ingestion_attempts SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[attempt]); await db.query('COMMIT');
    await left.query('BEGIN'); assert.equal((await left.query('SELECT feature_one_ingestion_claim_expired($1) AS claimed',[attempt])).rows[0].claimed,true);
    const denied = assert.rejects(right.query('SELECT feature_one_ingestion_checkpoint($1,$2,$3)',[actor,attempt,token]),/LEASE_LOST/);
    await left.query('COMMIT'); await denied;
  } finally {
    await db.query('ROLLBACK'); await left.query('ROLLBACK'); await right.query('ROLLBACK');
    await left.end(); await right.end();
    await db.query('DELETE FROM auth.users WHERE id=$1',[actor]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM feature_one_private.ingestion_pins WHERE user_id=$1',[actor])).rows[0].n,0);
  }
});

test('independent PostgreSQL deliveries serialize receipt/effects and a waiting save cannot cross revocation', { timeout: 15000 }, async () => {
  await db.query('BEGIN');
  const fixture = await selectionFixture();
  const saved = await fixture.service.save(user1, fixture.request, requestId);
  await db.query('COMMIT');
  const left = new pg.Client(config); const right = new pg.Client(config);
  await left.connect(); await right.connect();
  const args = [randomUUID(), digest('concurrent-delivery'), 'installation_repositories', 'removed', '500', ['300'], null];
  const sql = 'SELECT feature_one_github_webhook($1,$2,$3,$4,$5,$6,$7) AS duplicate';
  try {
    await left.query('BEGIN');
    const result = await left.query(sql, args); assert.equal(result.rows[0].duplicate, false);
    const duplicate = right.query(sql, args);
    // A save begun before the event is allowed to finish provider checks, but cannot
    // commit while the independent security transaction owns the epoch lock.
    await db.query('BEGIN');
    const pendingRead = fixture.service.read(user1);
    const stillSaved = await pendingRead;
    assert.equal(stillSaved.repositories[0].status, 'active', 'uncommitted effects are isolated');
    const verify = fixture.github.verifyRepository.bind(fixture.github);
    let verificationComplete!: () => void;
    const verified = new Promise<void>(resolve => { verificationComplete = resolve; });
    fixture.github.verifyRepository = async (...parameters) => { const value = await verify(...parameters); verificationComplete(); return value; };
    const saving = fixture.service.save(user1, { ...fixture.request, expectedRevision: saved.revision, idempotencyKey: randomUUID() }, requestId);
    const rejected = assert.rejects(saving, /access changed/);
    await verified;
    await left.query('COMMIT');
    assert.equal((await duplicate).rows[0].duplicate, true);
    await rejected;
    assert.equal((await fixture.service.read(user1)).repositories[0].status, 'revoked');
    assert.equal(await count('audit_events', "action = 'grant_revoked' AND actor_id = $1", [user1]), 1);
    await db.query('ROLLBACK');
  } finally {
    await db.query('ROLLBACK'); await left.query('ROLLBACK');
    await left.end(); await right.end();
  }
});

// Run 07 cases use independent committed connections and separate claim processes.
import { registerJobTests } from "./jobs.cases";
registerJobTests(db, config);
import { registerExtractionTests } from "./extraction.cases";
registerExtractionTests(db, config);
import { registerImplementationTests } from "./implementation.cases";
registerImplementationTests(db, config);
import { registerCoverageTests } from "./coverage.cases";
registerCoverageTests(db, config);

import { registerAggregationTests } from "./aggregation.cases";
registerAggregationTests(db, config);
import { registerNarrativeTests } from "./narrative.cases";
registerNarrativeTests(db, config);
import { registerReadinessTests } from "./readiness.cases";
registerReadinessTests(db, config);
import { registerRescanTests } from "./rescans.cases";
registerRescanTests(db, config);
import { registerFeedbackProvenanceTests } from "./feedback-provenance.cases";
registerFeedbackProvenanceTests(db, config);
import { registerAnalyzerVersionTests } from "./analyzer-version.cases";
registerAnalyzerVersionTests(db);
