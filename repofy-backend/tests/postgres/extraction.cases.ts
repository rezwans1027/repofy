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
import fixtures from '../fixtures/evidence/repositories.json';
import { structuralSecurityPolicy, policyHash } from '../../src/domain/ingestion/policy';
import { SnapshotIngestionService, type SafeSnapshotContext } from '../../src/domain/ingestion/service';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { extractionProfile } from '../../src/domain/extraction/policy';
import { extractSnapshot } from '../../src/domain/extraction/pipeline';
import { EvidenceRepository, type FeatureOneRpcClient } from '../../src/domain/analysis/persistence';
import { JobRepository } from '../../src/domain/jobs/repository';
import { emptyMetadata, providerDetail } from '../../src/domain/extraction/metadata';

export function registerExtractionTests(db:pg.Client,config:pg.ClientConfig){
  async function fixture(use:(state:any)=>Promise<void>){
    const a=new pg.Client(config),b=new pg.Client(config);await a.connect();await b.connect();
    const f=await seedAnalysisFixture(db,jobsRpc(a));const root=await mkdtemp(join(tmpdir(),'repofy-pg-extraction-'));let context:SafeSnapshotContext|undefined;
    try{
      const profile=extractionProfile();const security=structuralSecurityPolicy();f.policy.security=security;
      f.policy.versions={...f.policy.versions,extractorBundle:profile.extractorBundle,detectorBundle:profile.detectorBundle,coverageManifest:profile.coverageManifest,ingestionPolicyHash:policyHash(security)};
      const job=await f.jobs.start(f.actor,f.body,f.policy,5,randomUUID());const claim=await f.jobs.claim();assert.equal(claim!.jobId,job.jobId);
      const ingestion=new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim!),f.crypto),{
        async resolve(_r,access){return{providerRepositoryId:access.providerRepositoryId,repositoryVisibility:access.repositoryVisibility,branch:'main',commitSha:'a'.repeat(40)};},
        async download(_r,_p,path,signal,checkpoint){await checkpoint();signal.throwIfAborted();await writeFile(path,archiveFixture(Object.entries(fixtures.monorepo).map(([name,body])=>({path:`fixture-root/${name}`,body}))),{flag:'wx',mode:0o600});},
      },f.crypto,new WorkspaceManager(root),security);
      const request={actor:f.actor,jobId:job.jobId,repositoryId:f.bindings[0].repositoryId};const pin=await ingestion.resolveSnapshot(request);
      context=await ingestion.prepareSafeSnapshot(request);const input={pin,versions:f.policy.versions,crypto:f.crypto,options:claim!.request.includeMetadata,signal:new AbortController().signal};
      const {bundle}=await extractSnapshot(context,input);
      await use({f,job,claim,pin,context,input,bundle,other:new JobRepository(jobsRpc(b)),rpc:jobsRpc(a)});
    }finally{await context?.dispose();await db.query('DELETE FROM auth.users WHERE id=$1',[f.actor]);await a.end();await b.end();await rm(root,{recursive:true,force:true});}
  }
  test('structural observations persist once across concurrent job-stage writes with aggregate exclusions',()=>fixture(async({f,claim,bundle,other})=>{
    const ids=await Promise.all([f.jobs.storeSnapshot(claim,bundle,f.crypto),other.storeSnapshot(claim,bundle,f.crypto)]);assert.equal(ids[0],ids[1]);
    const rows=await db.query('SELECT inventory_summary FROM public.repository_snapshots WHERE id=$1',[ids[0]]);
    assert.equal(rows.rows[0].inventory_summary.totalFiles,19);assert.equal(rows.rows[0].inventory_summary.excludedFiles,5);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.file_inventory WHERE snapshot_id=$1',[ids[0]])).rows[0].n,14);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.evidence_items WHERE snapshot_id=$1 AND content_fingerprint IS NOT NULL',[ids[0]])).rows[0].n,12);
    const exported=JSON.stringify(await f.evidence.exportUserData(f.actor));assert.doesNotMatch(exported,/PRIVATE_PROSE_SENTINEL|TEST_ONLY_PRIVATE_DATA|artifact_key|content_fingerprint|packages\/api/);
  }));
  test('metadata permissions and SHA results produce distinct immutable canonical artifacts',()=>fixture(async({f,context,input,bundle})=>{
    const initial=await f.evidence.storeSnapshot(f.actor,f.bindings[0].grantId,bundle,f.crypto);
    const options={commits:false,pullRequests:false,ci:true};const metadata=emptyMetadata(input.pin.repositoryId,input.pin.commitSha,options);
    metadata.groups[2].coverage.state='permission_denied';
    const denied=(await extractSnapshot(context,{...input,options,metadata})).bundle;
    const second=await f.evidence.storeSnapshot(f.actor,f.bindings[0].grantId,denied,f.crypto);assert.notEqual(second,initial);
    metadata.groups[2]={coverage:{source:'checks',state:'available',records:1,exactCommitRecords:0,retrievedAt:'2026-09-20T00:00:00Z'},records:[{objectId:'checks_20',
      detail:providerDetail('check',{retrievedAt:'2026-09-20T00:00:00Z',subjectSha:'b'.repeat(40),relationship:'repository_context',result:'success',authorMatch:'unavailable',authorType:'unknown'})}]};
    const contextual=(await extractSnapshot(context,{...input,options,metadata})).bundle;
    const third=await f.evidence.storeSnapshot(f.actor,f.bindings[0].grantId,contextual,f.crypto);assert.notEqual(third,second);
    const row=await db.query("SELECT observation FROM public.evidence_items WHERE snapshot_id=$1 AND observation->>'sourceType'='ci' AND locator_kind='provider_metadata'",[third]);
    assert.equal(row.rows[0].observation.structural.claimBoundary,'historical_context');
    assert.equal(await f.evidence.storeSnapshot(f.actor,f.bindings[0].grantId,contextual,f.crypto),third);
    await assert.rejects(db.query("UPDATE public.evidence_items SET observation='{}' WHERE snapshot_id=$1",[third]),/IMMUTABLE_CONTENT/);
  }));
  test('SQL rejects forged exclusion denominators and exact-commit metadata before sealing',()=>fixture(async({f,context,input,bundle,rpc})=>{
    let submitted:any;const capture:FeatureOneRpcClient={async rpc(_name,args){submitted=structuredClone(args);return{data:bundle.snapshot.snapshotId,error:null};}};
    await new EvidenceRepository(capture).storeSnapshot(f.actor,f.bindings[0].grantId,bundle,f.crypto);
    submitted.p_bundle.inventorySummary.structural.exclusions.binary++;
    let result=await rpc.rpc('feature_one_store_snapshot',submitted);assert.equal(result.error?.message,'INCOMPLETE_ANALYSIS');
    assert.equal((await db.query('SELECT count(*)::int n FROM public.repository_snapshots WHERE id=$1',[bundle.snapshot.snapshotId])).rows[0].n,0);
    const options={commits:false,pullRequests:false,ci:true};const metadata=emptyMetadata(input.pin.repositoryId,input.pin.commitSha,options);
    metadata.groups[2]={coverage:{source:'checks',state:'available',records:1,exactCommitRecords:1,retrievedAt:'2026-09-20T00:00:00Z'},records:[{objectId:'checks_1',
      detail:providerDetail('check',{retrievedAt:'2026-09-20T00:00:00Z',subjectSha:input.pin.commitSha,relationship:'exact_commit',result:'success',authorMatch:'unavailable',authorType:'unknown'})}]};
    const withMetadata=(await extractSnapshot(context,{...input,options,metadata})).bundle;
    await new EvidenceRepository(capture).storeSnapshot(f.actor,f.bindings[0].grantId,withMetadata,f.crypto);
    submitted.p_bundle.evidence.find((e:any)=>e.locatorKind==='provider_metadata').observation.structural.provider.subjectSha='b'.repeat(40);
    result=await rpc.rpc('feature_one_store_snapshot',submitted);assert.equal(result.error?.message,'FOREIGN_EVIDENCE');
  }));
  test('new extraction output remains fenced after cancellation and invisible to unrelated owners',()=>fixture(async({f,job,claim,bundle})=>{
    await f.jobs.cancel(f.actor,job.jobId,randomUUID());await assert.rejects(f.jobs.storeSnapshot(claim,bundle,f.crypto),/LEASE_LOST/);
    await assert.rejects(f.evidence.storeSnapshot(randomUUID(),f.bindings[0].grantId,bundle,f.crypto));
    const exported=await f.evidence.exportUserData(randomUUID());assert.equal(exported.evidence.length,0);assert.equal(exported.files.length,0);
  }));
}
