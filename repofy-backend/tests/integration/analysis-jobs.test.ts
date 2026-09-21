import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { selectionDatabase } from "../helpers/selection-db";
import { seedAnalysisFixture } from "../helpers/job-fixtures";
import { createAnalysisRoutes } from "../../src/routes/analysis.routes";
import { getSupabaseAdmin } from "../../src/config/supabase";
import { requestId } from "../../src/middleware/requestId";
import { csrfProtection } from "../../src/middleware/csrf";
import { JobRepository } from "../../src/domain/jobs/repository";
vi.mock('../../src/config/supabase', () => ({ getSupabaseAdmin: vi.fn() }));
let database: Awaited<ReturnType<typeof selectionDatabase>>;
let fixture: Awaited<ReturnType<typeof seedAnalysisFixture>>;
const session=randomUUID(); let enabled=true; let entitled=true;
const jwt=()=>`header.${Buffer.from(JSON.stringify({sub:fixture.actor,session_id:session})).toString('base64url')}.fixture`;
function app() {
  const app=express();app.use(requestId,cookieParser(),express.json(),csrfProtection);
  app.use((_req,res,next)=>{res.locals.apiVersion='v1';res.locals.requestId=randomUUID();next();});
  app.use('/api/v1',createAnalysisRoutes((_req,res,next)=>enabled?next():void res.status(503).json({code:'FEATURE_DISABLED'}),{
    jobs:()=>fixture.jobs,available:()=>entitled,policy:()=>fixture.policy,maxRepositories:5,
  }));return app;
}
beforeAll(async()=>{database=await selectionDatabase();},20000);
beforeEach(async()=>{
  if(fixture)await database.db.query('DELETE FROM auth.users WHERE id=$1',[fixture.actor]);
  fixture=await seedAnalysisFixture(database.db,database.rpc); enabled=true;entitled=true;
  await database.db.query('INSERT INTO auth.sessions VALUES($1,$2)',[session,fixture.actor]);
  vi.mocked(getSupabaseAdmin).mockReturnValue({rpc:database.rpc.rpc,auth:{getUser:vi.fn(async()=>({data:{user:{id:fixture.actor}},error:null}))}} as never);
});
afterAll(async()=>{await database?.db.close();});
const start=()=>request(app()).post('/api/v1/analyses').set('Authorization',`Bearer ${jwt()}`).send(fixture.body);
it('authenticates every owner operation and retains CSRF before analysis writes',async()=>{
  for(const path of ['/analyses','/analyses/availability',`/analyses/${randomUUID()}`])expect((await request(app()).get(`/api/v1${path}`)).status).toBe(401);
  expect((await request(app()).post('/api/v1/analyses').set('Cookie',`access_token=${jwt()}`).send(fixture.body)).status).toBe(403);
  expect((await request(app()).post('/api/v1/analyses').set('Cookie',`access_token=${jwt()}`).set('X-Requested-With','XMLHttpRequest').set('Origin','https://evil.example').send(fixture.body)).status).toBe(403);
});
it('creates a queued resource and deduplicates a delayed replay without losing display order',async()=>{
  const one=await start();expect(one.status).toBe(202);expect(one.body.data.status).toBe('queued');expect(one.body.data.progress.kind).toBe('indeterminate');
  const two=await start();expect(two.body.data.jobId).toBe(one.body.data.jobId);
  const conflict=await request(app()).post('/api/v1/analyses').set('Authorization',`Bearer ${jwt()}`).send({...fixture.body,includeMetadata:{commits:true}});
  expect(conflict.status).toBe(409);expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
});
it('gates new work but keeps list/status/cancel/delete available after flags are disabled',async()=>{
  const created=await start();const id=created.body.data.jobId;enabled=false;
  expect((await start()).status).toBe(503);
  const get=(path:string)=>request(app()).get(`/api/v1${path}`).set('Authorization',`Bearer ${jwt()}`);
  expect((await get('/analyses')).body.data).toHaveLength(1);expect((await get(`/analyses/${id}`)).status).toBe(200);
  const canceled=await request(app()).post(`/api/v1/analyses/${id}/cancel`).set('Authorization',`Bearer ${jwt()}`);expect(canceled.body.data.status).toBe('canceled');
  expect((await request(app()).post(`/api/v1/analyses/${id}/retry`).set('Authorization',`Bearer ${jwt()}`)).body.code).toBe('RETRY_NOT_ALLOWED');
  expect((await request(app()).delete(`/api/v1/analyses/${id}`).set('Authorization',`Bearer ${jwt()}`)).body.data.deleted).toBe(true);
  expect((await get(`/analyses/${id}`)).status).toBe(404);
});
it('denies unentitled users, forged repositories and unsupported input without creating jobs',async()=>{
  entitled=false;expect((await start()).body.code).toBe('FEATURE_NOT_IMPLEMENTED');entitled=true;
  fixture.body.repositoryIds=[randomUUID()];expect((await start()).body.code).toBe('REPOSITORY_ACCESS_REVOKED');
  fixture.body.repositoryIds=[];expect((await start()).body.code).toBe('INVALID_REQUEST');
  expect(await fixture.jobs.list(fixture.actor)).toEqual([]);
});
it('enforces consent again at intake after a public repository becomes private',async()=>{
  await database.db.query("UPDATE public.repositories SET visibility='private' WHERE id=$1",[fixture.bindings[0].repositoryId]);
  const result=await start();expect(result.body.code).toBe('CONSENT_REQUIRED');expect(await fixture.jobs.list(fixture.actor)).toEqual([]);
});
it('returns only fixed errors for a queue outage and never reports a successful enqueue',async()=>{
  fixture.jobs=new JobRepository({rpc:async()=>{throw new Error('raw-source-provider-token-sentinel');}});
  const result=await start();expect(result.status).toBe(503);expect(result.body.code).toBe('DATABASE_FAILURE');expect(JSON.stringify(result.body)).not.toContain('sentinel');
});
it('checks the current Supabase session on replay rather than trusting a previous login',async()=>{
  const one=await start();expect(one.status).toBe(202);
  await database.db.query('DELETE FROM auth.sessions WHERE id=$1',[session]);expect((await start()).status).toBe(401);
  await database.db.query('INSERT INTO auth.sessions VALUES($1,$2)',[session,fixture.actor]);expect((await start()).body.data.jobId).toBe(one.body.data.jobId);
});

it('rejects target role versions outside the frozen execution policy',async()=>{
  const result=await request(app()).post('/api/v1/analyses').set('Authorization',`Bearer ${jwt()}`).send({...fixture.body,targetRoleTemplate:{roleId:'backend',version:'9.0.0'}});
  expect(result.body.code).toBe('INVALID_REQUEST');expect(await fixture.jobs.list(fixture.actor)).toEqual([]);
});
