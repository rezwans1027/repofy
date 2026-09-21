import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { narrativeJobFixture, syntheticGateway } from '../helpers/narrative-fixtures';
import { NarrativeService } from '../../src/domain/synthesis/service';
import { ReadinessReader } from '../../src/domain/readiness/reader';
import { createReadinessRoutes } from '../../src/routes/readiness.routes';
import { getSupabaseAdmin } from '../../src/config/supabase';
import { csrfProtection } from '../../src/middleware/csrf';
vi.mock('../../src/config/supabase', () => ({ getSupabaseAdmin: vi.fn() }));
let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async () => { db = await selectionDatabase(); await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });
async function saved() {
  const f = await narrativeJobFixture(db.db, db.rpc);
  const service = new NarrativeService(f.f.jobs, syntheticGateway);
  const report = await service.synthesize(f.context); await service.validate(report, f.context);
  await f.f.jobs.synthesis(f.claim, f.hash, report); await f.f.jobs.stage(f.claim, 'validating'); await f.f.jobs.complete(f.claim);
  const verifyRepository = vi.fn(async () => ({ item: { id: f.bundle.snapshot.providerRepositoryId, owner: { login: 'fixture' }, name: 'project', private: false } } as never));
  const reader = new ReadinessReader(db.rpc, () => f.f.crypto, { verifyRepository });
  return { ...f, report, reader, verifyRepository, actor: f.f.actor };
}
it('reads frozen math, all role definitions and source-free projections without a provider, including rollback', async () => {
  const f = await saved();
  try {
    f.verifyRepository.mockRejectedValue(new Error('PRIVATE_SOURCE_SENTINEL'));
    const view = await f.reader.view(f.actor, f.report.reportId);
    expect(view.aggregation!.roles).toHaveLength(5); expect(view.roleDefinitions).toHaveLength(5); expect(view.categories).toHaveLength(14);
    expect(view.report.roles).toEqual(f.report.roles); expect(view.report.snapshots[0].repositoryLabel).toBe('Repository 1');
    expect(view.report.evidence.every(e => !e.location)).toBe(true);
    expect((await f.reader.history(f.actor, { limit: 1 })).items[0].reportId).toBe(f.report.reportId);
    expect(f.verifyRepository).not.toHaveBeenCalled();
    expect(JSON.stringify(view)).not.toMatch(/PRIVATE_SOURCE_SENTINEL|locatorEncrypted|grantId|retry\.ts|function retry/);
    const exported = await f.f.evidence.exportUserData(f.actor); expect(exported.reports).toHaveLength(1); expect(exported.aggregations).toHaveLength(1);
  } finally { await f.cleanup(); }
});
it('rejects cross-owner reports, improvements, evidence IDs and pagination cursors before revealing contents', async () => {
  const f = await saved();
  try {
    for (const read of [() => f.reader.view(randomUUID(), f.report.reportId), () => f.reader.evidence(randomUUID(), f.report.reportId, {}),
      () => f.reader.evidence(f.actor, f.report.reportId, { evidenceId: randomUUID() }),
      () => f.reader.evidence(f.actor, f.report.reportId, { afterEvidenceId: randomUUID() }),
      () => f.reader.history(f.actor, { afterReportId: randomUUID() }),
      () => f.reader.improvement(f.actor, f.report.reportId, randomUUID()),
      () => f.reader.location(randomUUID(), f.report.reportId, f.report.evidence[0].evidenceId)]) await expect(read()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await f.reader.history(randomUUID(), {})).items).toEqual([]);
    for (const query of [{ limit: 101 }, { requirementId: 'api_design' }, { source: 'PRIVATE_SOURCE_SENTINEL' }]) await expect(f.reader.evidence(f.actor, f.report.reportId, query)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(f.verifyRepository).not.toHaveBeenCalled();
  } finally { await f.cleanup(); }
});
it('pages evidence by report membership and filters by repository, category, capability and role requirement', async () => {
  const f = await saved();
  try {
    const view = await f.reader.view(f.actor, f.report.reportId), cap = view.aggregation!.capabilities.find(c => c.state === 'assessed' && view.aggregation!.roles.some(r => r.requirements.some(q => q.capabilityIds.includes(c.capabilityId))))!;
    const first = await f.reader.evidence(f.actor, f.report.reportId, { limit: 1 }); expect(first.items).toHaveLength(1); expect(first.nextEvidenceId).not.toBeNull();
    const next = await f.reader.evidence(f.actor, f.report.reportId, { limit: 1, afterEvidenceId: first.nextEvidenceId! }); expect(next.items[0].evidence.evidenceId).not.toBe(first.items[0].evidence.evidenceId);
    for (const query of [{ repositoryId: view.report.snapshots[0].repositoryId }, { categoryId: cap.categoryId }, { capabilityId: cap.capabilityId }]) {
      const page = await f.reader.evidence(f.actor, f.report.reportId, query); expect(page.items.length).toBeGreaterThan(0);
    }
    for (const claim of f.report.claims) if (claim.verification === 'verified') for (const id of claim.evidenceIds) expect((await f.reader.evidence(f.actor, f.report.reportId, { evidenceId: id })).items[0].evidence.evidenceId).toBe(id);
    const role = view.aggregation!.roles.find(r => r.requirements.some(q => q.capabilityIds.includes(cap.capabilityId)))!;
    const req = role.requirements.find(q => q.capabilityIds.includes(cap.capabilityId))!;
    const page = await f.reader.evidence(f.actor, f.report.reportId, { roleId: role.template.roleId, requirementId: req.requirementId }); expect(page.items.length).toBeGreaterThan(0);
    expect((await f.reader.evidence(f.actor, f.report.reportId, { capabilityId: 'no_such_capability' })).items).toEqual([]);
  } finally { await f.cleanup(); }
});
it('constructs only exact-commit public links and hides links for current private visibility', async () => {
  const f = await saved();
  try {
    const id = f.report.evidence[0].evidenceId;
    const publicLocation = await f.reader.location(f.actor, f.report.reportId, id); expect(publicLocation.state).toBe('available');
    if (publicLocation.state === 'available') expect(publicLocation.url).toContain(`/blob/${f.bundle.snapshot.commitSha}/`);
    await db.db.query("UPDATE public.repositories SET visibility='private' WHERE id=$1", [f.bundle.snapshot.repositoryId]);
    const view = await f.reader.view(f.actor, f.report.reportId); expect(view.report.snapshots[0].repositoryVisibility).toBe('private'); expect(view.report.evidence[0].repositoryVisibility).toBe('private');
    const location = await f.reader.location(f.actor, f.report.reportId, id); expect(location).toMatchObject({ state: 'available', visibility: 'private' }); expect(location).not.toHaveProperty('url');
    expect((await f.f.evidence.readReport(f.actor, f.report.reportId))!.snapshots[0].repositoryVisibility).toBe('public');
  } finally { await f.cleanup(); }
});
it('fences revoked locations before and after provider verification, while retaining bounded report reads', async () => {
  const f = await saved();
  try {
    const providerResult = await f.verifyRepository(); f.verifyRepository.mockClear();
    f.verifyRepository.mockImplementationOnce(async () => { await f.f.evidence.revokeGrant(f.actor, f.f.bindings[0].grantId, randomUUID()); return providerResult; });
    const id = f.report.evidence[0].evidenceId;
    expect(await f.reader.location(f.actor, f.report.reportId, id)).toEqual({ state: 'access_revoked', evidenceId: id });
    f.verifyRepository.mockClear(); expect((await f.reader.location(f.actor, f.report.reportId, id)).state).toBe('access_revoked'); expect(f.verifyRepository).not.toHaveBeenCalled();
    const view = await f.reader.view(f.actor, f.report.reportId); expect(view.repositories[0].access).toBe('revoked'); expect(view.report.snapshots[0].repositoryVisibility).toBe('private');
    expect((await f.reader.evidence(f.actor, f.report.reportId, {})).items[0].access).toBe('revoked');
  } finally { await f.cleanup(); }
});
it('records closed events only and removes reports, evidence membership, export data and active work on deletion', async () => {
  const f = await saved();
  try {
    await f.reader.event(f.actor, f.report.reportId, { event: 'report_viewed' }, randomUUID());
    await f.reader.event(f.actor, f.report.reportId, { event: 'improvement_opened', objectId: f.report.improvements[0].improvementId }, randomUUID());
    await expect(f.reader.event(f.actor, f.report.reportId, { event: 'improvement_opened', objectId: randomUUID() }, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.reader.event(f.actor, f.report.reportId, { event: 'report_viewed', text: 'PRIVATE_SOURCE_SENTINEL' }, randomUUID())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    const events = (await db.db.query('SELECT safe_metadata FROM audit_events WHERE job_id=$1 AND action LIKE $2', [f.claim.jobId, '%opened'])).rows; expect(events).toEqual([{ safe_metadata: {} }]);
    await f.reader.remove(f.actor, f.report.reportId, randomUUID());
    await expect(f.reader.view(f.actor, f.report.reportId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.f.jobs.complete(f.claim)).rejects.toThrow();
    expect((await f.f.evidence.exportUserData(f.actor)).reports).toEqual([]);
  } finally { await f.cleanup(); }
});
it('enforces real session auth, CSRF, safe errors and no-store headers at the HTTP boundary', async () => {
  const f = await saved(); const session = randomUUID(); const token = `header.${Buffer.from(JSON.stringify({ sub: f.actor, session_id: session })).toString('base64url')}.fixture`;
  try {
    await db.db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, f.actor]);
    vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc: db.rpc.rpc, auth: { getUser: async () => ({ data: { user: { id: f.actor } }, error: null }) } } as never);
    const app = express(); app.use(cookieParser(), express.json(), csrfProtection); app.use((_req, res, next) => { res.locals.apiVersion = 'v1'; res.locals.requestId = randomUUID(); next(); }); app.use('/api/v1', createReadinessRoutes(() => f.reader));
    const url = `/api/v1/readiness-reports/${f.report.reportId}`;
    expect((await request(app).get(url)).status).toBe(401);
    const get = (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`);
    const result = await get(`${url}/view`); expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('private, no-store');
    expect((await get(`${url}/evidence?limit=1000`)).status).toBe(400); expect((await get(`${url}/evidence?limit[x]=2`)).status).toBe(400);
    expect((await get(`${url}/improvements/${f.report.improvements[0].improvementId}`)).status).toBe(200);
    expect((await request(app).delete(url).set('Cookie', `access_token=${token}`)).status).toBe(403);
    await db.db.query('DELETE FROM auth.sessions WHERE id=$1', [session]); expect((await get(`${url}/view`)).status).toBe(401);
  } finally { await f.cleanup(); }
});
