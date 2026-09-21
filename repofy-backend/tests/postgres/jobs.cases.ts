import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedAnalysisFixture } from "../helpers/job-fixtures";
import { multiRepositoryReport } from "../helpers/evidence-fixtures";
import type { FeatureOneRpcClient } from "../../src/domain/analysis/persistence";
import { JobRepository, type Claim } from "../../src/domain/jobs/repository";
import { IngestionRepository } from "../../src/domain/ingestion/repository";
import { SnapshotIngestionService } from "../../src/domain/ingestion/service";
import { WorkspaceManager } from "../../src/domain/ingestion/workspace";
import { AnalysisWorker, type AnalysisHandlers } from "../../src/domain/jobs/worker";
import { archiveFixture } from "../helpers/ingestion-fixtures";
import { canonicalAnalysisRequest } from "../../src/domain/analysis/request";
import { JobError } from "../../src/domain/jobs/policy";

// Every RPC uses its own transaction and the production service_role privileges.
export function jobsRpc(client: pg.Client): FeatureOneRpcClient {
  return { async rpc(name, args) {
    if (!/^feature_one_[a-z0-9_]+$/.test(name) || Object.keys(args).some(k => !/^p_[a-z_]+$/.test(k))) throw new Error('Invalid RPC');
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE service_role');
      const keys = Object.keys(args);
      const result = await client.query(`SELECT public.${name}(${keys.map((key, i) => `${key}=>$${i + 1}`).join(',')}) data`,
        keys.map(k => ['p_files','p_items','p_resolutions'].includes(k) ? JSON.stringify(args[k]) : args[k]));
      await client.query('COMMIT'); return { data: result.rows[0].data, error: null };
    } catch (error) { await client.query('ROLLBACK'); return { data: null, error: { message: (error as Error).message } }; }
  } };
}
export function registerJobTests(db: pg.Client, config: pg.ClientConfig) {
  async function scoped(fn: (f: Awaited<ReturnType<typeof seedAnalysisFixture>>, other: JobRepository) => Promise<void>, count = 1) {
    const a = new pg.Client(config); const b = new pg.Client(config); await a.connect(); await b.connect();
    const f = await seedAnalysisFixture(db, jobsRpc(a), count);
    try { await fn(f, new JobRepository(jobsRpc(b))); }
    finally { await db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]); await a.end(); await b.end(); }
  }
  const expire = (job: string) => db.query("UPDATE feature_one_private.analysis_execution SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1", [job]);
  const due = (job: string) => db.query("UPDATE feature_one_private.analysis_execution SET available_at=clock_timestamp()-interval '1 second' WHERE job_id=$1", [job]);
  async function start(f: Awaited<ReturnType<typeof seedAnalysisFixture>>) { return f.jobs.start(f.actor, f.body, f.policy, 5, randomUUID()); }
  function ingestion(f: Awaited<ReturnType<typeof seedAnalysisFixture>>, claim: Claim, root: string, counter = { resolves: 0, downloads: [] as string[] }) {
    return new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim), f.crypto), {
      async resolve(request, access) { counter.resolves++; return { providerRepositoryId: access.providerRepositoryId, repositoryVisibility: access.repositoryVisibility,
        branch: 'fixture-sensitive-branch', commitSha: f.bundles.find(b => b.snapshot.repositoryId === request.repositoryId)!.snapshot.commitSha }; },
      async download(_request, pin, destination, signal, checkpoint) { await checkpoint(); signal.throwIfAborted(); counter.downloads.push(pin.commitSha); await writeFile(destination, archiveFixture(), { flag: 'wx', mode: 0o600 }); },
    }, f.crypto, new WorkspaceManager(root), f.policy.security);
  }
  async function prepare(f: Awaited<ReturnType<typeof seedAnalysisFixture>>, c: Claim) {
    const root = await mkdtemp(join(tmpdir(), 'repofy-jobs-'));
    try {
      const safe = ingestion(f,c,root); const snapshots=[];
      for (const bundle of f.bundles) { await safe.resolveSnapshot({ actor:f.actor,jobId:c.jobId,repositoryId:bundle.snapshot.repositoryId }); snapshots.push(await f.jobs.storeSnapshot(c,bundle,f.crypto)); }
      const run = await f.jobs.run(c,snapshots);
      return multiRepositoryReport(f.actor,c.jobId,run.runId,f.bundles);
    } finally { await rm(root,{recursive:true,force:true}); }
  }
  test('durable start races across connections: one reservation, stable normalized identity, changed-key conflict', () => scoped(async (f, other) => {
    f.policy.billing='test_units_v1'; await db.query('INSERT INTO feature_one_private.analysis_wallets VALUES($1,2)',[f.actor]);
    const [one,two] = await Promise.all([start(f),other.start(f.actor,{...f.body,repositoryIds:[...f.body.repositoryIds].reverse()},f.policy,5,randomUUID())]);
    assert.equal(one.jobId,two.jobId);
    assert.equal((await db.query('SELECT units FROM feature_one_private.analysis_wallets WHERE user_id=$1',[f.actor])).rows[0].units,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_ledger WHERE job_id=$1',[one.jobId])).rows[0].n,1);
    await assert.rejects(other.start(f.actor,{...f.body,includeMetadata:{ci:true}},f.policy,5,randomUUID()),{code:'IDEMPOTENCY_CONFLICT'});
    await assert.rejects(other.read(randomUUID(),one.jobId),{code:'NOT_FOUND'});
    assert.equal((await other.list(f.actor)).length,1);
  },2));
  test('cross-process claim, SIGKILL, expired lease fencing, bounded recovery and unchanged pinned SHA', () => scoped(async f => {
    const job=await start(f);
    const childClaim = () => new Promise<Claim|null>((resolve,reject) => {
      const child=fork('tests/helpers/job-process.ts',['--hold-for-kill'],{execArgv:['--import','tsx'],env:{...process.env,REPOFY_PG_TEST_CONFIG:JSON.stringify(config)},stdio:['ignore','ignore','pipe','ipc']});
      let value: Claim|null=null; let received=false;
      const watchdog = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Child claim deadline')); }, 10000);
      child.stderr.resume();
      child.on('message',m=>{value=(m as {claim:Claim|null}).claim;received=true;if(value)child.kill('SIGKILL');});
      child.on('error', error => { clearTimeout(watchdog); reject(error); });
      child.on('exit',(code,signal)=>{clearTimeout(watchdog);received && (value ? signal==='SIGKILL' : code===0) ? resolve(value) : reject(new Error('Child claim failed'));});
    });
    const claims=await Promise.all([childClaim(),childClaim()]); assert.equal(claims.filter(Boolean).length,1); const stale=claims.find(Boolean)!;
    const root=await mkdtemp(join(tmpdir(),'repofy-jobs-')); const counters={resolves:0,downloads:[] as string[]};
    try {
      const oldIngestion=ingestion(f,stale,root,counters); const req={actor:f.actor,jobId:job.jobId,repositoryId:f.body.repositoryIds[0]};
      const pin=await oldIngestion.resolveSnapshot(req);
      await expire(job.jobId);
      await assert.rejects(f.jobs.stage(stale,'validating'),{code:'LEASE_LOST'});
      await f.jobs.maintain(); await due(job.jobId);
      const next=(await f.jobs.claim())!; assert.notEqual(next.token,stale.token); assert.notEqual(next.attemptId,stale.attemptId);
      assert.equal((await f.jobs.read(f.actor,job.jobId)).attempt?.number,2);
      const snapshot=await ingestion(f,next,root,counters).prepareSafeSnapshot(req); await snapshot.dispose();
      assert.equal(counters.resolves,1); assert.deepEqual(counters.downloads,[pin.commitSha]);
      await assert.rejects(oldIngestion.resolveSnapshot(req),{code:'LEASE_LOST'});
      await assert.rejects(f.jobs.complete(stale),{code:'LEASE_LOST'});
      await assert.rejects(f.jobs.fail(stale,'PROVIDER_FAILURE'),{code:'LEASE_LOST'});
      assert.equal((await readdir(root)).length,0);
    } finally { await rm(root,{recursive:true,force:true}); }
  }));
  test('draft recovery after model completion and atomic report/charge commit with duplicate completion', () => scoped(async (f,other) => {
    f.policy.billing='test_units_v1'; await db.query('INSERT INTO feature_one_private.analysis_wallets VALUES($1,1)',[f.actor]);
    const job=await start(f); const claim=(await f.jobs.claim())!; const draft=await prepare(f,claim); const hash='sha256:'+'b'.repeat(64);
    assert.equal((await f.jobs.synthesis(claim,hash)).state,'reserved');
    await f.jobs.synthesis(claim,hash,draft); // Process dies here, before final commit.
    await expire(job.jobId); await f.jobs.maintain(); await due(job.jobId); const next=(await other.claim())!;
    assert.deepEqual(await other.synthesis(next,hash),{state:'ready',draft});
    await other.stage(next,'validating');
    await assert.rejects(f.evidence.finalizeReport(f.actor,draft,randomUUID()),/LEASE_LOST/);
    const disconnected = new pg.Client(config); await disconnected.connect();
    await disconnected.query('BEGIN'); await disconnected.query('SET LOCAL ROLE service_role');
    await disconnected.query('SELECT feature_one_job_complete($1,$2)',[next.jobId,next.token]);
    await disconnected.end(); // Lose the connection before COMMIT: report and settlement both roll back.
    assert.equal((await other.read(f.actor,job.jobId)).status,'running');
    assert.equal((await db.query('SELECT state FROM feature_one_private.analysis_settlements WHERE job_id=$1',[job.jobId])).rows[0].state,'reserved');
    const outcomes=await Promise.allSettled([f.jobs.complete(next),other.complete(next)]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    const result=await f.jobs.read(f.actor,job.jobId); assert.equal(result.status,'completed');
    assert.deepEqual(await f.evidence.readReport(f.actor,draft.reportId),draft);
    // Lost HTTP acknowledgement resolves through status; no second report/debit/settle.
    await assert.rejects(other.complete(next),{code:'LEASE_LOST'}); await other.maintain();
    const effects=await db.query('SELECT kind,count(*)::int n FROM feature_one_private.analysis_ledger WHERE job_id=$1 GROUP BY kind ORDER BY kind',[job.jobId]);
    assert.deepEqual(effects.rows,[{kind:'reserve',n:1},{kind:'settle',n:1}]);
    assert.equal((await db.query('SELECT units FROM feature_one_private.analysis_wallets WHERE user_id=$1',[f.actor])).rows[0].units,0);
  }));
  test('ambiguous model outcome is retained across restart and never automatically regenerated', () => scoped(async f => {
    const job=await start(f); const c=(await f.jobs.claim())!; await prepare(f,c); const hash='sha256:'+'c'.repeat(64);
    await f.jobs.synthesis(c,hash); await expire(job.jobId); await f.jobs.maintain(); await due(job.jobId); const next=(await f.jobs.claim())!;
    assert.equal((await f.jobs.synthesis(next,hash)).state,'uncertain');
    await f.jobs.fail(next,'MODEL_OUTCOME_UNKNOWN'); await assert.rejects(f.jobs.retry(f.actor,job.jobId),{code:'RETRY_NOT_ALLOWED'});
    assert.equal((await f.jobs.read(f.actor,job.jobId)).status,'failed');
    assert.equal((await db.query('SELECT state FROM feature_one_private.analysis_settlements WHERE job_id=$1',[job.jobId])).rows[0].state,'refunded');
  }));
  test('cancel refunds once, fences source/completion, and delete tombstones delayed request replay', () => scoped(async f => {
    f.policy.billing='test_units_v1'; await db.query('INSERT INTO feature_one_private.analysis_wallets VALUES($1,1)',[f.actor]);
    const job=await start(f); const c=(await f.jobs.claim())!;
    await f.jobs.cancel(f.actor,job.jobId,randomUUID()); await f.jobs.cancel(f.actor,job.jobId,randomUUID()); await f.jobs.maintain();
    assert.equal((await db.query('SELECT units FROM feature_one_private.analysis_wallets WHERE user_id=$1',[f.actor])).rows[0].units,1);
    await assert.rejects(f.jobs.heartbeat(c),{code:'LEASE_LOST'}); await assert.rejects(f.jobs.complete(c),{code:'LEASE_LOST'});
    await assert.rejects(f.jobs.retry(f.actor,job.jobId),{code:'RETRY_NOT_ALLOWED'});
    await f.jobs.delete(f.actor,job.jobId,randomUUID()); await assert.rejects(start(f),{code:'NOT_FOUND'});
    await assert.rejects(f.jobs.read(f.actor,job.jobId),{code:'NOT_FOUND'});
  }));
  test('one revoked repository fails the entire selection and prevents reused output access', () => scoped(async f => {
    const job=await start(f); const c=(await f.jobs.claim())!; await prepare(f,c);
    await f.evidence.revokeGrant(f.actor,f.bindings[1].grantId,randomUUID());
    await assert.rejects(f.jobs.snapshot(c,f.body.repositoryIds[0]),{code:'REPOSITORY_ACCESS_REVOKED'});
    await f.jobs.maintain(); const result=await f.jobs.read(f.actor,job.jobId);
    assert.equal(result.status,'failed'); if(result.status==='failed') assert.equal(result.failureCode,'REPOSITORY_ACCESS_REVOKED');
    assert.equal((await db.query('SELECT count(*)::int n FROM readiness_reports WHERE job_id=$1',[job.jobId])).rows[0].n,0);
  },2));
  test('account deletion removes execution, pins, drafts, and tombstones without stale resurrection', () => scoped(async f => {
    const job=await start(f); const c=(await f.jobs.claim())!; await prepare(f,c);
    await db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);
    await assert.rejects(f.jobs.heartbeat(c),{code:'LEASE_LOST'}); assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_execution WHERE job_id=$1',[job.jobId])).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_requests WHERE user_id=$1',[f.actor])).rows[0].n,0);
  }));
  test('transient retries terminate within three attempts; queue expiration settles without a worker', () => scoped(async f => {
    const job=await start(f);
    for(let n=1;n<=3;n++){const c=(await f.jobs.claim())!;await f.jobs.fail(c,'PROVIDER_FAILURE');if(n<3) await f.jobs.retry(f.actor,job.jobId);}
    assert.equal((await f.jobs.read(f.actor,job.jobId)).status,'failed'); assert.equal(await f.jobs.claim(),null);
    f.body.idempotencyKey=randomUUID(); const other=await start(f);
    await db.query("UPDATE feature_one_private.analysis_execution SET deadline=clock_timestamp()-interval '1 second' WHERE job_id=$1",[other.jobId]);
    await f.jobs.maintain(); assert.equal((await f.jobs.read(f.actor,other.jobId)).status,'expired');
  }));
  test('real worker uses safe ingestion, survives lost files, and resumes a durable draft without a second synthesis', () => scoped(async f => {
    const job=await start(f); const root=await mkdtemp(join(tmpdir(),'repofy-jobs-')); let synthesis=0;let fail=true;
    const counters={resolves:0,downloads:[] as string[]};
    const handlers:AnalysisHandlers={policy:f.policy,async extract(snapshot){assert.ok((await snapshot.files()).length);return f.bundles[0];},
      async aggregate(ctx){await ctx.checkpoint();},async synthesize(ctx){synthesis++;return multiRepositoryReport(f.actor,job.jobId,ctx.runId,f.bundles);},
      async validate(){if(fail){fail=false;throw new JobError('DATABASE_FAILURE');}}};
    try {
      const worker=new AnalysisWorker(f.jobs,handlers,c=>ingestion(f,c,root,counters),()=>f.crypto);
      assert.equal(await worker.once(),true); assert.equal((await f.jobs.read(f.actor,job.jobId)).status,'queued');
      await rm(root,{recursive:true,force:true}); // Forced volume loss between attempts.
      await f.jobs.retry(f.actor,job.jobId); assert.equal(await worker.once(),true);
      assert.equal((await f.jobs.read(f.actor,job.jobId)).status,'completed');assert.equal(synthesis,1);assert.equal(counters.resolves,1);assert.equal(counters.downloads.length,1);
    } finally {await rm(root,{recursive:true,force:true});}
  }));
  test('connection loss around reservation leaves no orphan debit, and crashed reserved work refunds within budget', () => scoped(async f => {
    f.policy.billing='test_units_v1'; await db.query('INSERT INTO feature_one_private.analysis_wallets VALUES($1,1)',[f.actor]);
    const c=new pg.Client(config);await c.connect();await c.query('BEGIN');await c.query('SET LOCAL ROLE service_role');
    const canonical=canonicalAnalysisRequest(f.body);
    await c.query('SELECT feature_one_job_start($1,$2,$3,$4,5,$5)',[f.actor,canonical.request,canonical.requestHash,f.policy,randomUUID()]);
    await c.end(); // Connection loss before the reservation transaction commits.
    assert.equal((await db.query('SELECT units FROM feature_one_private.analysis_wallets WHERE user_id=$1',[f.actor])).rows[0].units,1);
    assert.equal((await f.jobs.list(f.actor)).length,0);
    const job=await start(f); // Committed reservation survives an API process disappearing.
    for(let n=1;n<=3;n++){assert.ok(await f.jobs.claim());await expire(job.jobId);await f.jobs.maintain();if(n<3)await due(job.jobId);}
    assert.equal((await f.jobs.read(f.actor,job.jobId)).status,'failed');
    assert.equal((await db.query('SELECT units FROM feature_one_private.analysis_wallets WHERE user_id=$1',[f.actor])).rows[0].units,1);
    assert.deepEqual((await db.query('SELECT kind FROM feature_one_private.analysis_ledger WHERE job_id=$1 ORDER BY kind',[job.jobId])).rows,[{kind:'refund'},{kind:'reserve'}]);
  }));
  test('queue, draft and billing RPCs/tables retain their service-only boundary',async()=>{
    for(const name of ['analysis_execution','analysis_requests','analysis_wallets','analysis_settlements','analysis_ledger','analysis_snapshot_outputs','analysis_synthesis']) {
      for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,\'SELECT\') exposed',[role,`feature_one_private.${name}`])).rows[0].exposed,false);
    }
    for(const role of ['anon','authenticated'])assert.equal((await db.query('SELECT has_function_privilege($1,\'public.feature_one_job_claim()\',\'EXECUTE\') exposed',[role])).rows[0].exposed,false);
  });

}
