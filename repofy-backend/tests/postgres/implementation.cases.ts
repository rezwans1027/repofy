import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jobsRpc } from './jobs.cases';
import { seedAnalysisFixture } from '../helpers/job-fixtures';
import { archiveFixture } from '../helpers/ingestion-fixtures';
import { implementationRepository } from '../helpers/implementation-fixtures';
import { structuralSecurityPolicy, policyHash } from '../../src/domain/ingestion/policy';
import { SnapshotIngestionService, type SafeSnapshotContext } from '../../src/domain/ingestion/service';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { implementationProfile } from '../../src/domain/detectors/registry';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { extractSnapshot } from '../../src/domain/extraction/pipeline';
import { EvidenceRepository, type FeatureOneRpcClient } from '../../src/domain/analysis/persistence';
import { JobRepository } from '../../src/domain/jobs/repository';

export function registerImplementationTests(db:pg.Client,config:pg.ClientConfig){
  async function fixture(use:(state:any)=>Promise<void>){
    const a=new pg.Client(config),b=new pg.Client(config);await a.connect();await b.connect();
    const f=await seedAnalysisFixture(db,jobsRpc(a));const root=await mkdtemp(join(tmpdir(),'repofy-pg-detectors-'));let context:SafeSnapshotContext|undefined;
    try{
      const profile=implementationProfile();const security=structuralSecurityPolicy();f.policy.security=security;
      Object.assign(f.policy.versions,{extractorBundle:profile.extractorBundle,detectorBundle:profile.detectorBundle,coverageManifest:profile.coverageManifest,ingestionPolicyHash:policyHash(security),
        taxonomy:{id:initialRubricCatalog.taxonomy.id,version:initialRubricCatalog.taxonomy.version},roleRubrics:initialRubricCatalog.rubrics.map(r=>({roleId:r.roleId,version:r.version}))});
      const job=await f.jobs.start(f.actor,f.body,f.policy,5,randomUUID());const claim=await f.jobs.claim();assert.equal(claim!.jobId,job.jobId);
      const ingestion=new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim!),f.crypto),{
        async resolve(_r,access){return{providerRepositoryId:access.providerRepositoryId,repositoryVisibility:access.repositoryVisibility,branch:'main',commitSha:'a'.repeat(40)};},
        async download(_r,_p,path,signal,checkpoint){await checkpoint();signal.throwIfAborted();await writeFile(path,archiveFixture(Object.entries(implementationRepository()).map(([name,body])=>({path:`fixture-root/${name}`,body}))),{flag:'wx',mode:0o600});},
      },f.crypto,new WorkspaceManager(root),security);
      const request={actor:f.actor,jobId:job.jobId,repositoryId:f.bindings[0].repositoryId};const pin=await ingestion.resolveSnapshot(request);
      context=await ingestion.prepareSafeSnapshot(request);
      const {bundle}=await extractSnapshot(context,{pin,profile,versions:f.policy.versions,crypto:f.crypto,options:claim!.request.includeMetadata,signal:new AbortController().signal});
      await use({f,job,claim,bundle,other:new JobRepository(jobsRpc(b)),rpc:jobsRpc(a)});
    }finally{await context?.dispose();await db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);await a.end();await b.end();await rm(root,{recursive:true,force:true});}
  }
  test('implementation evidence and capability memberships persist once under concurrent fenced writes',()=>fixture(async({f,claim,bundle,other})=>{
    const ids=await Promise.all([f.jobs.storeSnapshot(claim,bundle,f.crypto),other.storeSnapshot(claim,bundle,f.crypto)]);assert.equal(ids[0],ids[1]);
    const count=await db.query("SELECT count(*)::int n FROM public.evidence_items WHERE snapshot_id=$1 AND detector_id LIKE 'tsjs.%'",[ids[0]]);
    assert.equal(count.rows[0].n,bundle.evidence.filter((e:any)=>e.implementation).length);
    assert.doesNotMatch(JSON.stringify(await f.evidence.exportUserData(f.actor)),/function read|SELECT id|content_fingerprint|\/route\.ts/);
    await assert.rejects(db.query("UPDATE feature_one_private.implementation_detectors SET maximum_strength=0.6"),/IMMUTABLE_CONTENT/);
  }));
  test('raw SQL rejects foreign semantic references, inflated claims and fabricated coverage with full rollback',()=>fixture(async({f,bundle,rpc})=>{
    let submitted:any;const capture:FeatureOneRpcClient={async rpc(_name,args){submitted=structuredClone(args);return{data:bundle.snapshot.snapshotId,error:null};}};
    await new EvidenceRepository(capture).storeSnapshot(f.actor,f.bindings[0].grantId,bundle,f.crypto);
    const assertion=(b:any)=>b.p_bundle.evidence.find((e:any)=>e.observation.implementation?.kind==='asserted_call').observation;
    for(const [change,code] of [
      [(b:any)=>assertion(b).implementation.relations[0].fileId=randomUUID(),'FOREIGN_EVIDENCE'],
      [(b:any)=>assertion(b).strength=0.9,'UNSUPPORTED_CLAIM'],
      [(b:any)=>assertion(b).capabilityIds=['security_authorization'],'UNSUPPORTED_CLAIM'],
      [(b:any)=>b.p_bundle.coverage.implementation.detectors[0].observations++,'INCOMPLETE_ANALYSIS'],
      [(b:any)=>delete b.p_bundle.coverage.implementation,'UNSUPPORTED_CLAIM'],
      [(b:any)=>assertion(b).implementation.span.lines.end=999999,'FOREIGN_EVIDENCE'],
    ] as const){const bad=structuredClone(submitted);change(bad);const result=await rpc.rpc('feature_one_store_snapshot',bad);assert.equal(result.error?.message,code);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.repository_snapshots WHERE id=$1',[bundle.snapshot.snapshotId])).rows[0].n,0);}
    assert.equal((await rpc.rpc('feature_one_store_snapshot',submitted)).error,null);
  }));
  test('implementation extraction cannot cross cancellation or owner authorization boundaries',()=>fixture(async({f,job,claim,bundle})=>{
    await f.jobs.cancel(f.actor,job.jobId,randomUUID());await assert.rejects(f.jobs.storeSnapshot(claim,bundle,f.crypto),/LEASE_LOST/);
    await assert.rejects(f.evidence.storeSnapshot(randomUUID(),f.bindings[0].grantId,bundle,f.crypto));
    assert.equal((await f.evidence.exportUserData(randomUUID())).evidence.length,0);
  }));
}
