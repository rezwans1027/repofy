import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { rescanFixture } from '../helpers/rescan-fixture';
import { FindingFeedbackService } from '../../src/domain/feedback/service';
import { createFindingFeedbackRoutes } from '../../src/routes/finding-feedback.routes';
import { csrfProtection } from '../../src/middleware/csrf';
import { getSupabaseAdmin } from '../../src/config/supabase';
import { env } from '../../src/config/env';
vi.mock('../../src/config/supabase', () => ({ getSupabaseAdmin: vi.fn() }));
let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async () => { db = await selectionDatabase(); await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });
const body = (revision = 0) => ({ classification: 'inaccurate', comment: 'PRIVATE_COMMENT_SENTINEL: please check this observation.', expectedRevision: revision, idempotencyKey: randomUUID() });
it('persists every choice against its exact finding, replays once, edits with a revision fence, and never rewrites the report', async () => {
  const f = await rescanFixture(db.db, db.rpc), service = new FindingFeedbackService(db.rpc), report = f.baseline.report, before = JSON.stringify(report), counters = { ...f.counters };
  try {
    const refs = [{ kind: 'capability', id: report.capabilityGroups[0].capabilities[0].capabilityId }, { kind: 'claim', id: report.claims[0].claimId }, { kind: 'evidence', id: report.evidence[0].evidenceId }, { kind: 'improvement', id: report.improvements[0].improvementId }];
    for (const [index, classification] of ['accurate','inaccurate','unclear','irrelevant'].entries()) {
      const input = { ...body(), classification }, one = await service.feedback(f.actor, report.reportId, refs[index], input);
      expect(one!.classification).toBe(classification); expect(await service.feedback(f.actor, report.reportId, refs[index], input)).toEqual(one);
    }
    const input = { ...body(1), classification: 'unclear' }; const edit = await service.feedback(f.actor, report.reportId, refs[0], input); expect(edit!.revision).toBe(2);
    await expect(service.feedback(f.actor, report.reportId, refs[0], { ...input, comment: 'changed' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(service.feedback(f.actor, report.reportId, refs[0], body())).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(JSON.stringify((await f.reader.view(f.actor, report.reportId)).report)).toBe(before); expect(f.counters).toEqual(counters);
    const exported = await f.evidence.exportUserData(f.actor); expect(exported.findingFeedback).toHaveLength(4); expect(exported.findingFeedbackHistory).toHaveLength(5);
    expect(JSON.stringify(exported.findingFeedbackHistory)).not.toContain('PRIVATE_COMMENT_SENTINEL');
  } finally { await f.cleanup(); }
});
it('rejects foreign owners, finding references, unsafe/control text and overlong comments', async () => {
  const f = await rescanFixture(db.db, db.rpc), service = new FindingFeedbackService(db.rpc), report = f.baseline.report, ref = { kind: 'evidence', id: report.evidence[0].evidenceId };
  try {
    await expect(service.feedback(randomUUID(), report.reportId, ref, body())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const id of [randomUUID(), 'private-path']) await expect(service.feedback(f.actor, report.reportId, { ...ref, id }, body())).rejects.toThrow();
    for (const comment of ['a'.repeat(1001), 'hidden\u202evalue', 'password=highlysecretvalue', 'person@example.com']) await expect(service.feedback(f.actor, report.reportId, ref, { ...body(), comment })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect((await f.evidence.exportUserData(f.actor)).findingFeedback).toEqual([]);
  } finally { await f.cleanup(); }
});
it('uses an explicit reviewer grant and a generalized queue, fences stale review and reopens edited feedback', async () => {
  const f = await rescanFixture(db.db, db.rpc), service = new FindingFeedbackService(db.rpc), report = f.baseline.report, ref = { kind: 'evidence', id: report.evidence[0].evidenceId };
  try {
    const feedback = (await service.feedback(f.actor, report.reportId, ref, body()))!;
    await expect(service.queue(f.actor, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await db.db.query('INSERT INTO feature_one_private.finding_reviewers VALUES($1,true)', [f.actor]);
    expect((await db.rpc.rpc('feature_one_finding_review', { p_reviewer: f.actor, p_query: {} })).error).toBeNull();
    const queue = await service.queue(f.actor, {}); expect(queue.items).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toMatch(/PRIVATE_COMMENT|"(?:comment|reportId|findingId|repository|source|email)":/);
    const change = { expectedRevision: 1, expectedReviewRevision: 0, disposition: 'confirmed_issue', note: 'reproduced_synthetic', benchmarkCase: 'run15.fork', idempotencyKey: randomUUID() };
    const review = await service.review(f.actor, feedback.id, change); expect(review.disposition).toBe('confirmed_issue'); expect(await service.review(f.actor, feedback.id, change)).toEqual(review);
    const edit = await service.feedback(f.actor, report.reportId, ref, { ...body(1), classification: 'accurate' }); expect(edit!.disposition).toBe('open');
    await expect(service.review(f.actor, feedback.id, { ...change, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await f.evidence.exportUserData(f.actor)).findingReviews).toHaveLength(1);
    await f.reader.remove(f.actor, report.reportId, randomUUID()); expect((await service.queue(f.actor, {})).items).toEqual([]);
    await expect(service.feedback(f.actor, report.reportId, ref)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  } finally { await f.cleanup(); }
});
it('prunes comment/review history at 180 days while old idempotency keys cannot recreate it', async () => {
  const f = await rescanFixture(db.db, db.rpc), service = new FindingFeedbackService(db.rpc), report = f.baseline.report, ref = { kind: 'evidence', id: report.evidence[0].evidenceId }, input = body();
  try {
    const feedback = (await service.feedback(f.actor, report.reportId, ref, input))!;
    await db.db.query("UPDATE feature_one_private.finding_feedback SET updated_at=now()-interval '181 days' WHERE id=$1", [feedback.id]);
    expect((await db.rpc.rpc('feature_one_feedback_prune', {})).data).toBe(1);
    expect(await service.feedback(f.actor, report.reportId, ref)).toBeNull(); await expect(service.feedback(f.actor, report.reportId, ref, input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await f.evidence.exportUserData(f.actor)).findingFeedbackHistory).toEqual([]);
  } finally { await f.cleanup(); }
});
it('requires real session plus admin secret plus reviewer grant, CSRF, and allows owner reads with feedback disabled', async () => {
  const f = await rescanFixture(db.db, db.rpc), session = randomUUID(), service = new FindingFeedbackService(db.rpc);
  const token = `header.${Buffer.from(JSON.stringify({ sub: f.actor, session_id: session })).toString('base64url')}.fixture`;
  try {
    await db.db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, f.actor]);
    vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc: db.rpc.rpc, auth: { getUser: async () => ({ data: { user: { id: f.actor } }, error: null }) } } as never);
    let enabled = true; const app = express(); app.use(cookieParser(), express.json(), csrfProtection); app.use((_req,res,next) => { res.locals.apiVersion='v1'; res.locals.requestId=randomUUID(); next(); });
    app.use('/api/v1', createFindingFeedbackRoutes((_req,res,next) => enabled ? next() : void res.status(503).json({ success:false }), () => enabled, () => service));
    const url = `/api/v1/readiness-reports/${f.baseline.report.reportId}/findings/evidence/${f.baseline.report.evidence[0].evidenceId}/feedback`, queue = '/api/v1/finding-feedback/review';
    expect((await request(app).get(url)).status).toBe(401); expect((await request(app).post(url).set('Cookie', `access_token=${token}`).send(body())).status).toBe(403);
    expect((await request(app).get(queue).set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get(queue).set('x-admin-key', env.adminSecret!)).status).toBe(401);
    expect((await request(app).get(queue).set('x-admin-key', env.adminSecret!).set('Authorization', `Bearer ${token}`)).status).toBe(403);
    await db.db.query('INSERT INTO feature_one_private.finding_reviewers VALUES($1,true)', [f.actor]);
    const allowed = await request(app).get(queue).set('x-admin-key', env.adminSecret!).set('Authorization', `Bearer ${token}`); expect(allowed.status).toBe(200); expect(allowed.headers['cache-control']).toBe('private, no-store');
    enabled = false; expect((await request(app).get(url).set('Authorization', `Bearer ${token}`)).body.data.writable).toBe(false);
    expect((await request(app).post(url).set('Authorization', `Bearer ${token}`).send(body())).status).toBe(503);
  } finally { await f.cleanup(); }
});
