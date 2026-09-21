import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selectionDatabase } from '../helpers/selection-db';
import { seedAnalysisFixture, seedJobRubrics } from '../helpers/job-fixtures';
import { archiveFixture } from '../helpers/ingestion-fixtures';
import { implementationRepository } from '../helpers/implementation-fixtures';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { structuralSecurityPolicy, policyHash } from '../../src/domain/ingestion/policy';
import { AnalysisWorker, type AnalysisHandlers } from '../../src/domain/jobs/worker';
import { JobError } from '../../src/domain/jobs/policy';
import { createImplementationExtraction } from '../../src/domain/extraction/pipeline';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { DETECTORS } from '../../src/domain/detectors/registry';

let db:Awaited<ReturnType<typeof selectionDatabase>>;let root:string;
beforeAll(async()=>{db=await selectionDatabase();await seedJobRubrics(db.db);root=await mkdtemp(join(tmpdir(),'repofy-implementation-worker-'));},20000);
afterAll(async()=>{await db?.db.close();if(root)await rm(root,{recursive:true,force:true});});
it('persists the real TS/JS handler under worker fences and taxonomy membership without enabling synthesis',async()=>{
  const f=await seedAnalysisFixture(db.db,db.rpc);const extraction=createImplementationExtraction(f.crypto);const security=structuralSecurityPolicy();
  Object.assign(f.policy.versions,{extractorBundle:extraction.profile.extractorBundle,detectorBundle:extraction.profile.detectorBundle,coverageManifest:extraction.profile.coverageManifest,
    taxonomy:{id:initialRubricCatalog.taxonomy.id,version:initialRubricCatalog.taxonomy.version},roleRubrics:initialRubricCatalog.rubrics.map(r=>({roleId:r.roleId,version:r.version})),ingestionPolicyHash:policyHash(security)});
  f.policy.security=security;let aggregated=false;
  const handlers:AnalysisHandlers={policy:f.policy,extract:extraction.extract,async aggregate(ctx){await ctx.checkpoint();aggregated=true;throw new JobError('FEATURE_NOT_IMPLEMENTED');},
    async synthesize(){throw new Error('Downstream stage must not run');},async validate(){throw new Error('Downstream stage must not run');}};
  const worker=new AnalysisWorker(f.jobs,handlers,claim=>new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim),f.crypto),{
    async resolve(_r,access){return{providerRepositoryId:access.providerRepositoryId,repositoryVisibility:access.repositoryVisibility,branch:'main',commitSha:'a'.repeat(40)};},
    async download(_r,_pin,path,signal,checkpoint){await checkpoint();signal.throwIfAborted();await writeFile(path,archiveFixture(Object.entries(implementationRepository()).map(([name,body])=>({path:`fixture-root/${name}`,body}))),{mode:0o600,flag:'wx'});},
  },f.crypto,new WorkspaceManager(root),security),()=>f.crypto);
  try{
    const job=await f.jobs.start(f.actor,f.body,f.policy,5,randomUUID());await worker.once();expect(aggregated).toBe(true);
    const rows=await db.db.query<{id:string,coverage:any}>('SELECT id,coverage FROM public.repository_snapshots WHERE repository_id=$1',[f.bindings[0].repositoryId]);expect(rows.rows).toHaveLength(1);
    const sid=rows.rows[0].id;expect(rows.rows[0].coverage.implementation).toMatchObject({analyzedFiles:32,eligibleFiles:32});
    const stored=await db.db.query<{observation:any}>('SELECT observation FROM public.evidence_items WHERE snapshot_id=$1 AND detector_id LIKE $2',[sid,'tsjs.%']);
    expect(new Set(stored.rows.map(r=>r.observation.implementation.kind))).toEqual(new Set(DETECTORS.map(d=>d.kind)));
    expect((await db.db.query('SELECT * FROM public.capability_evidence ce JOIN public.evidence_items e ON e.id=ce.evidence_id WHERE e.snapshot_id=$1',[sid])).rows.length).toBeGreaterThan(16);
    const registry=await db.db.query<{kind:string,capabilities:string[],maximum_strength:string}>('SELECT kind,capabilities,maximum_strength FROM feature_one_private.implementation_detectors');
    for(const definition of DETECTORS){const row=registry.rows.find(r=>r.kind===definition.kind)!;expect(row.capabilities).toEqual(definition.capabilityIds);expect(Number(row.maximum_strength)).toBe(definition.strength);}
    const exported=JSON.stringify(await f.evidence.exportUserData(f.actor));expect(exported).not.toMatch(/function read|SELECT id|content_fingerprint|\/route\.ts|locator_encrypted/);
    await expect(db.db.query("UPDATE feature_one_private.implementation_detectors SET maximum_strength=0.6 WHERE kind='asserted_call'")).rejects.toThrow('IMMUTABLE_CONTENT');
    await f.jobs.delete(f.actor,job.jobId,randomUUID());expect((await db.db.query('SELECT id FROM public.repository_snapshots WHERE id=$1',[sid])).rows).toHaveLength(0);
  }finally{await db.db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);}
},20000);
