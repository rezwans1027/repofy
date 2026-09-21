import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selectionDatabase } from '../helpers/selection-db';
import { seedAnalysisFixture, seedJobRubrics } from '../helpers/job-fixtures';
import { multiRepositoryReport } from '../helpers/evidence-fixtures';
import { archiveFixture } from '../helpers/ingestion-fixtures';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { AnalysisWorker, type AnalysisHandlers } from '../../src/domain/jobs/worker';
import { IngestionError } from '../../src/domain/ingestion/errors';
import { JobError, jobError } from '../../src/domain/jobs/policy';
import { maintenance, schedule } from '../../src/domain/jobs/scheduler';
import { JobRepository, type Claim } from '../../src/domain/jobs/repository';

let db:Awaited<ReturnType<typeof selectionDatabase>>;let f:Awaited<ReturnType<typeof seedAnalysisFixture>>;let root:string;
let handlers:AnalysisHandlers;let sources:number;let captures:unknown[];
function ingest(c:Claim){return new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(c),f.crypto),{
  async resolve(_r,a){return{providerRepositoryId:a.providerRepositoryId,repositoryVisibility:a.repositoryVisibility,branch:f.bundles[0].snapshot.branch,commitSha:f.bundles[0].snapshot.commitSha};},
  async download(_r,_p,path,signal,checkpoint){await checkpoint();signal.throwIfAborted();sources++;await writeFile(path,archiveFixture(),{flag:'wx',mode:0o600});},
},f.crypto,new WorkspaceManager(root),f.policy.security);}
const worker=()=>new AnalysisWorker(f.jobs,handlers,ingest,()=>f.crypto);
const start=()=>f.jobs.start(f.actor,f.body,f.policy,5,randomUUID());
beforeAll(async()=>{db=await selectionDatabase();await seedJobRubrics(db.db);root=await mkdtemp(join(tmpdir(),'repofy-worker-'));},20000);
beforeEach(async()=>{
  if(f)await db.db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);
  f=await seedAnalysisFixture(db.db,db.rpc);sources=0;captures=[];
  handlers={policy:f.policy,extract:vi.fn(async safe=>{captures.push(await safe.files());return f.bundles[0];}),
    aggregate:vi.fn(async ctx=>{await ctx.checkpoint();}),synthesize:vi.fn(async ctx=>multiRepositoryReport(f.actor,ctx.claim.jobId,ctx.runId,f.bundles)),validate:vi.fn(async()=>{})};
});
afterAll(async()=>{await db?.db.close();await rm(root,{recursive:true,force:true});});
it('completes only through all real state transitions, stores encrypted outputs and retains owner export',async()=>{
  const j=await start();expect(await worker().once()).toBe(true);expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('completed');
  expect(handlers.synthesize).toHaveBeenCalledTimes(1);expect(handlers.validate).toHaveBeenCalledTimes(1);expect(captures).toHaveLength(1);expect(await readdir(root)).toEqual([]);
  const data=await f.evidence.exportUserData(f.actor);expect(data.analysisLedger).toHaveLength(2);expect(data.analysisDrafts).toHaveLength(1);
  expect(JSON.stringify(data)).not.toMatch(/lease_token|input_hash|branch_encrypted|export const answer/);
});
it('persists a model draft before validation failure and retries without source or model work',async()=>{
  const j=await start();vi.mocked(handlers.validate).mockRejectedValueOnce(new JobError('DATABASE_FAILURE'));
  await worker().once();expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('queued');await f.jobs.retry(f.actor,j.jobId);
  await worker().once();expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('completed');expect(sources).toBe(1);expect(handlers.synthesize).toHaveBeenCalledTimes(1);
});
it('refuses to regenerate when a process loses the model result before persisting its draft',async()=>{
  const j=await start();vi.mocked(handlers.synthesize).mockRejectedValueOnce(new JobError('DATABASE_FAILURE'));
  await worker().once();await f.jobs.retry(f.actor,j.jobId);await worker().once();
  expect(await f.jobs.read(f.actor,j.jobId)).toMatchObject({status:'failed',failureCode:'MODEL_OUTCOME_UNKNOWN',retryable:false});expect(handlers.synthesize).toHaveBeenCalledTimes(1);
});
it('a lost completion acknowledgement leaves the saved report completed and settled',async()=>{
  const j=await start();const real=f.jobs.complete.bind(f.jobs);vi.spyOn(f.jobs,'complete').mockImplementation(async c=>{await real(c);throw new JobError('DATABASE_FAILURE');});
  await worker().once();expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('completed');expect(await worker().once()).toBe(false);
});
it('missing handlers and version mismatch fail explicitly before fetching source',async()=>{
  const j=await start();await new AnalysisWorker(f.jobs,null,ingest,()=>f.crypto).once();expect(await f.jobs.read(f.actor,j.jobId)).toMatchObject({status:'failed',failureCode:'FEATURE_NOT_IMPLEMENTED'});expect(sources).toBe(0);
});
it('cancellation during a handler cleans files and prevents publication',async()=>{
  const j=await start();vi.mocked(handlers.extract).mockImplementationOnce(async()=>{await f.jobs.cancel(f.actor,j.jobId,randomUUID());return f.bundles[0];});
  await worker().once();expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('canceled');expect(handlers.synthesize).not.toHaveBeenCalled();expect(await readdir(root)).toEqual([]);
});
it('unknown errors store a fixed code without raw source or provider strings',async()=>{
  const j=await start();vi.mocked(handlers.extract).mockRejectedValueOnce(new Error('raw-private-source-sentinel'));await worker().once();
  const result=await f.jobs.read(f.actor,j.jobId);expect(result).toMatchObject({status:'failed',failureCode:'ANALYSIS_VALIDATION_FAILED'});expect(JSON.stringify(result)).not.toContain('sentinel');
  expect(jobError({code:'PROVIDER_FAILURE'}).code).toBe('ANALYSIS_VALIDATION_FAILED');
});
it('shutdown before claim does not consume work and a queue outage cannot produce a report',async()=>{
  const j=await start();const signal=AbortSignal.abort();expect(await worker().once(signal)).toBe(false);expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('queued');
  const unavailable=new JobRepository({rpc:async()=>{throw Error('private-sentinel');}});
  await expect(new AnalysisWorker(unavailable,handlers,ingest,()=>f.crypto).once()).rejects.toMatchObject({code:'DATABASE_FAILURE'});
});
it('maintenance refunds expired work and runs filesystem cleanup despite a database outage',async()=>{
  const j=await start();await db.db.query("UPDATE feature_one_private.analysis_execution SET deadline=clock_timestamp()-interval '1 second' WHERE job_id=$1",[j.jobId]);
  const workspace=new WorkspaceManager(root);expect((await maintenance(f.jobs,workspace,db.rpc)).failed).toBe(0);expect((await f.jobs.read(f.actor,j.jobId)).status).toBe('expired');
  await workspace.create(randomUUID(),j.jobId);const future=new WorkspaceManager(root,()=>Date.now()+31*60*1000);
  const down={rpc:async()=>{throw Error('db down');}};expect((await maintenance(new JobRepository(down),future,down)).failed).toBe(3);expect(await readdir(root)).toEqual([]);
});
it('the maintenance schedule runs immediately, survives errors, and stops cleanly',async()=>{
  const signal=new AbortController();let count=0;const failed=vi.fn();await schedule(async()=>{count++;if(count===1)throw Error();signal.abort();},1,signal.signal,failed);
  expect(count).toBe(2);expect(failed).toHaveBeenCalledOnce();
});

it.each([['ARCHIVE_LIMIT','REPOSITORY_TOO_LARGE'],['ARCHIVE_INVALID','UNSUPPORTED_ARCHIVE'],['SCANNER_FAILURE','SECRET_SCAN_BLOCKED_CONTENT']] as const)('terminates unsafe ingestion %s with actionable safe code %s',async(input,code)=>{
  const j=await start();vi.mocked(handlers.extract).mockRejectedValueOnce(new IngestionError(input));await worker().once();expect(await f.jobs.read(f.actor,j.jobId)).toMatchObject({status:'failed',failureCode:code,retryable:false});
});

it('rejects extraction output that changes the pinned branch before writing reusable evidence',async()=>{
  const j=await start();const wrong=structuredClone(f.bundles[0]);wrong.snapshot.branch='moved-branch';vi.mocked(handlers.extract).mockResolvedValueOnce(wrong);
  await worker().once();expect(await f.jobs.read(f.actor,j.jobId)).toMatchObject({status:'failed',failureCode:'ANALYSIS_VALIDATION_FAILED'});expect(handlers.synthesize).not.toHaveBeenCalled();
  expect((await db.db.query('SELECT count(*)::int n FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=$1',[j.jobId])).rows[0].n).toBe(0);
});

it('rejects persisted snapshot options that differ from the logical request without retrying validation',async()=>{
  const j=await start();const wrong=structuredClone(f.bundles[0]);wrong.inventorySummary.metadata.commits=true;vi.mocked(handlers.extract).mockResolvedValueOnce(wrong);
  await worker().once();expect(await f.jobs.read(f.actor,j.jobId)).toMatchObject({status:'failed',failureCode:'ANALYSIS_VALIDATION_FAILED',retryable:false});
});
