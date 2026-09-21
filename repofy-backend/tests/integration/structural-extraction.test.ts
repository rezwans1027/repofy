import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selectionDatabase } from '../helpers/selection-db';
import { seedAnalysisFixture, seedJobRubrics } from '../helpers/job-fixtures';
import { archiveFixture } from '../helpers/ingestion-fixtures';
import fixtures from '../fixtures/evidence/repositories.json';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { structuralSecurityPolicy, policyHash } from '../../src/domain/ingestion/policy';
import { AnalysisWorker, type AnalysisHandlers } from '../../src/domain/jobs/worker';
import { JobError } from '../../src/domain/jobs/policy';
import { createStructuralExtraction } from '../../src/domain/extraction/pipeline';
import { type Claim } from '../../src/domain/jobs/repository';

let db:Awaited<ReturnType<typeof selectionDatabase>>;let root:string;
beforeAll(async()=>{db=await selectionDatabase();await seedJobRubrics(db.db);root=await mkdtemp(join(tmpdir(),'repofy-structural-worker-'));},20000);
afterAll(async()=>{await db?.db.close();if(root)await rm(root,{recursive:true,force:true});});
it('runs the real Run 08 handler under job fences and reuses persisted extraction on retry',async()=>{
  const f=await seedAnalysisFixture(db.db,db.rpc);const extraction=createStructuralExtraction(f.crypto);const security=structuralSecurityPolicy();
  Object.assign(f.policy.versions,extraction.profile);delete (f.policy.versions as any).disabled;
  f.policy.security=security;f.policy.versions.ingestionPolicyHash=policyHash(security);
  let downloads=0;let aggregations=0;
  const ingest=(claim:Claim)=>new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim),f.crypto),{
    async resolve(_request,access){return{providerRepositoryId:access.providerRepositoryId,repositoryVisibility:access.repositoryVisibility,branch:'main',commitSha:'a'.repeat(40)};},
    async download(_request,_pin,path,signal,checkpoint){await checkpoint();signal.throwIfAborted();downloads++;
      await writeFile(path,archiveFixture(Object.entries(fixtures.monorepo).map(([name,body])=>({path:`fixture-root/${name}`,body}))),{mode:0o600,flag:'wx'});},
  },f.crypto,new WorkspaceManager(root),security);
  const extract=vi.fn(extraction.extract); const handlers:AnalysisHandlers={policy:f.policy,extract,
    async aggregate(ctx){await ctx.checkpoint();aggregations++;throw new JobError(aggregations===1?'DATABASE_FAILURE':'FEATURE_NOT_IMPLEMENTED');},
    async synthesize(){throw new Error('Downstream stage must not run');},async validate(){throw new Error('Downstream stage must not run');}};
  const worker=new AnalysisWorker(f.jobs,handlers,ingest,()=>f.crypto);
  try{
    const job=await f.jobs.start(f.actor,f.body,f.policy,5,randomUUID());await worker.once();
    expect(await f.jobs.read(f.actor,job.jobId)).toEqual(expect.objectContaining({status:'queued'}));
    const outputs=await db.db.query<{snapshot_id:string}>('SELECT snapshot_id FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=$1',[job.jobId]);
    expect(outputs.rows).toHaveLength(1);const sid=outputs.rows[0].snapshot_id;
    const snapshot=await db.db.query<{inventory_summary:any}>('SELECT inventory_summary FROM public.repository_snapshots WHERE id=$1',[sid]);
    expect(snapshot.rows[0].inventory_summary).toMatchObject({totalFiles:19,eligibleFiles:14,excludedFiles:5,analyzedFiles:12});
    const evidence=await db.db.query<{observation:any,locator_encrypted:string,content_fingerprint:string}>('SELECT observation,locator_encrypted,content_fingerprint FROM public.evidence_items WHERE snapshot_id=$1',[sid]);
    expect(evidence.rows).toHaveLength(12);expect(evidence.rows.every(e=>/^sha256:[a-f0-9]{64}$/.test(e.content_fingerprint))).toBe(true);
    expect(JSON.stringify(evidence.rows)).not.toMatch(/PRIVATE_PROSE_SENTINEL|TEST_ONLY_PRIVATE_DATA|packages\/api|makeConfiguration/);
    const exported=JSON.stringify(await f.evidence.exportUserData(f.actor));expect(exported).not.toMatch(/artifact_key|content_fingerprint|PRIVATE_PROSE_SENTINEL|TEST_ONLY_PRIVATE_DATA/);
    await f.jobs.retry(f.actor,job.jobId);await worker.once();
    expect(downloads).toBe(1);expect(extract).toHaveBeenCalledTimes(1);expect(aggregations).toBe(2);
    expect(await f.jobs.read(f.actor,job.jobId)).toMatchObject({status:'failed'});
    expect((await db.db.query('SELECT id FROM public.evidence_items WHERE snapshot_id=$1',[sid])).rows).toHaveLength(12);
    await f.jobs.delete(f.actor,job.jobId,randomUUID());
    expect((await db.db.query('SELECT id FROM public.repository_snapshots WHERE id=$1',[sid])).rows).toHaveLength(0);
  }finally{await db.db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);}
},20000);
