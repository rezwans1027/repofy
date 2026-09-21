import { beforeAll,afterAll,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { narrativeJobFixture,syntheticGateway } from '../helpers/narrative-fixtures';
import { NarrativeService } from '../../src/domain/synthesis/service';
import { SynthesisError } from '../../src/domain/synthesis/policy';
let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async()=>{db=await selectionDatabase();await seedJobRubrics(db.db);},20000);
afterAll(async()=>{await db?.db.close();});
it('publishes validated selected-cluster support atomically and reads it with the provider unavailable',async()=>{
  const f=await narrativeJobFixture(db.db,db.rpc), gateway={generate:vi.fn(syntheticGateway.generate)}, service=new NarrativeService(f.f.jobs,gateway);
  try{
    const report=await service.synthesize(f.context);await service.validate(report,f.context);
    await f.f.jobs.synthesis(f.claim,f.hash,report);await f.f.jobs.stage(f.claim,'validating');
    expect((await db.rpc.rpc('feature_one_job_complete',f.f.jobs.args(f.claim))).error).toBeNull();
    gateway.generate.mockRejectedValue(new Error('provider unavailable'));
    expect(await f.f.evidence.readReport(f.f.actor,report.reportId)).toEqual(report);
    expect(await f.f.evidence.readReport(randomUUID(),report.reportId)).toBeNull();
    expect(gateway.generate).toHaveBeenCalledTimes(1);
    const rows=(await db.db.query<any>('SELECT * FROM public.model_runs WHERE job_id=$1',[f.claim.jobId])).rows;
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({validation_status:'valid',request_state:'succeeded',input_tokens:1000,output_tokens:1000});
    expect(Number(rows[0].estimated_cost)).toBe(.002);expect(rows[0].allowed_evidence_ids.length).toBeGreaterThan(0);
    await expect(db.db.query("UPDATE public.model_runs SET model='changed' WHERE job_id=$1",[f.claim.jobId])).rejects.toThrow('IMMUTABLE_CONTENT');
    const exported=await f.f.evidence.exportUserData(f.f.actor);expect(JSON.stringify(exported)).toContain('bounded_narrative_1.0.0');
    await f.f.jobs.delete(f.f.actor,f.claim.jobId,randomUUID());
    expect((await db.db.query('SELECT * FROM public.model_runs WHERE job_id=$1',[f.claim.jobId])).rows).toHaveLength(0);
    expect((await db.db.query('SELECT * FROM feature_one_private.model_budget_charges WHERE id=$1',[rows[0].id])).rows).toHaveLength(1);
  }finally{await f.cleanup();}
});
it('quarantines invalid content as metadata only and never stages or publishes it',async()=>{
  const f=await narrativeJobFixture(db.db,db.rpc);
  try{
    const service=new NarrativeService(f.f.jobs,{async generate(input,signal){const output=await syntheticGateway.generate(input,signal);(output.selection as any).explanations[0].text='SECRET_PRIVATE_NAME: handled a million users';return output;}});
    await expect(service.synthesize(f.context)).rejects.toMatchObject({validationCode:'invalid_schema'});
    expect((await db.db.query('SELECT draft FROM feature_one_private.analysis_synthesis WHERE job_id=$1',[f.claim.jobId])).rows[0]).toEqual({draft:null});
    const rows=(await db.db.query('SELECT * FROM public.model_runs WHERE job_id=$1',[f.claim.jobId])).rows;
    expect(rows[0]).toMatchObject({validation_status:'invalid',validation_code:'invalid_schema'});expect(JSON.stringify(rows)).not.toContain('SECRET');
    expect(await f.f.jobs.synthesis(f.claim,f.hash)).toEqual({state:'uncertain'});
  }finally{await f.cleanup();}
});
it('retries explicit 429 only, recording both calls and never exceeding the per-job call budget',async()=>{
  const f=await narrativeJobFixture(db.db,db.rpc);const generate=vi.fn().mockRejectedValueOnce(new SynthesisError('provider_rate_limit')).mockImplementation(syntheticGateway.generate);
  try{
    const service=new NarrativeService(f.f.jobs,{generate});await service.synthesize(f.context);expect(generate).toHaveBeenCalledTimes(2);
    expect((await db.db.query('SELECT request_state FROM public.model_runs WHERE job_id=$1 ORDER BY created_at',[f.claim.jobId])).rows.map((r:any)=>r.request_state)).toEqual(['failed','succeeded']);
    await expect(service.synthesize(f.context)).rejects.toThrow();expect(generate).toHaveBeenCalledTimes(2);
  }finally{await f.cleanup();}
});
it('holds uncertain costs and prevents repeated timeout or crash calls for the same job',async()=>{
  const f=await narrativeJobFixture(db.db,db.rpc),generate=vi.fn().mockRejectedValue(new SynthesisError('outcome_unknown'));
  try{
    const service=new NarrativeService(f.f.jobs,{generate});await expect(service.synthesize(f.context)).rejects.toMatchObject({code:'MODEL_OUTCOME_UNKNOWN'});
    await expect(service.synthesize(f.context)).rejects.toMatchObject({code:'MODEL_OUTCOME_UNKNOWN'});expect(generate).toHaveBeenCalledTimes(1);
    const row=(await db.db.query<any>('SELECT estimated_cost,request_state FROM public.model_runs WHERE job_id=$1',[f.claim.jobId])).rows[0];expect(Number(row.estimated_cost)).toBe(.05);expect(row.request_state).toBe('unknown');
  }finally{await f.cleanup();}
});
it('blocks budget exhaustion before a request and fences altered drafts or revoked work',async()=>{
  const f=await narrativeJobFixture(db.db,db.rpc),generate=vi.fn(syntheticGateway.generate);const ids=Array.from({length:250},()=>randomUUID());
  try{
    await db.db.query('INSERT INTO feature_one_private.model_budget_charges(id,amount) SELECT unnest($1::uuid[]),0.04',[ids]);
    const service=new NarrativeService(f.f.jobs,{generate});await expect(service.synthesize(f.context)).rejects.toMatchObject({code:'PROVIDER_FAILURE'});expect(generate).not.toHaveBeenCalled();
    await db.db.query('DELETE FROM feature_one_private.model_budget_charges WHERE id=ANY($1)',[ids]);
    const report=await service.synthesize(f.context);const bad=structuredClone(report);bad.claims[0].text='Invented production success';
    await expect(f.f.jobs.synthesis(f.claim,f.hash,bad)).rejects.toThrow();await expect(service.validate(bad,f.context)).rejects.toThrow();
    await f.f.jobs.cancel(f.f.actor,f.claim.jobId,randomUUID());await expect(service.validate(report,f.context)).rejects.toMatchObject({code:'LEASE_LOST'});
    expect((await db.db.query('SELECT * FROM public.readiness_reports WHERE job_id=$1',[f.claim.jobId])).rows).toHaveLength(0);
  }finally{await db.db.query('DELETE FROM feature_one_private.model_budget_charges WHERE id=ANY($1)',[ids]);await f.cleanup();}
});
