import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { rescanFixture } from '../helpers/rescan-fixture';
import { RescanService } from '../../src/domain/rescans/service';
import { aggregationFiles } from '../helpers/aggregation-fixtures';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createRescanRoutes } from '../../src/routes/rescans.routes';
import { csrfProtection } from '../../src/middleware/csrf';
import { getSupabaseAdmin } from '../../src/config/supabase';
vi.mock('../../src/config/supabase', () => ({ getSupabaseAdmin: vi.fn() }));
let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async () => { db = await selectionDatabase(); await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });

it('enforces session auth, CSRF, admission allowlisting, disabled flags and bounded queries at HTTP boundaries', async () => {
  const f = await rescanFixture(db.db, db.rpc), session = randomUUID();
  const token = `header.${Buffer.from(JSON.stringify({ sub: f.actor, session_id: session })).toString('base64url')}.fixture`;
  try {
    await db.db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, f.actor]);
    vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc: db.rpc.rpc, auth: { getUser: async () => ({ data: { user: { id: f.actor } }, error: null }) } } as never);
    let enabled = true, available = true;
    const app = express(); app.use(cookieParser(), express.json(), csrfProtection); app.use((_req, res, next) => { res.locals.apiVersion = 'v1'; res.locals.requestId = randomUUID(); next(); });
    app.use('/api/v1', createRescanRoutes((_req, res, next) => { if (enabled) next(); else res.status(503).json({ success: false }); }, { service: () => f.service, available: () => available, policy: () => f.policy, maxRepositories: 5 }));
    const base = `/api/v1/readiness-reports/${f.baseline.report.reportId}`, get = (path: string) => request(app).get(base + path).set('Authorization', `Bearer ${token}`);
    expect((await request(app).get(base + '/focus')).status).toBe(401);
    const focus = await get('/focus'); expect(focus.status).toBe(200); expect(focus.headers['cache-control']).toBe('private, no-store');
    expect((await request(app).put(base + '/focus').set('Cookie', `access_token=${token}`).send({ role: null })).status).toBe(403);
    expect((await request(app).post(base + '/rescans').set('Cookie', `access_token=${token}`).send(f.request())).status).toBe(403);
    expect((await get('/rescans?limit[x]=2')).status).toBe(400); expect((await get('/comparisons?targetReportId=' + f.baseline.report.reportId + '&limit=999')).status).toBe(400);
    available = false; const before = { ...f.counters };
    expect((await request(app).post(base + '/rescans').set('Authorization', `Bearer ${token}`).send(f.request())).status).toBe(503); expect(f.counters).toEqual(before);
    enabled = false; expect((await get('/comparisons?targetReportId=' + f.baseline.report.reportId)).status).toBe(503);
    expect((await get('/focus')).status).toBe(200); expect((await get('/rescans')).status).toBe(200);
    await db.db.query('DELETE FROM auth.sessions WHERE id=$1', [session]); expect((await get('/focus')).status).toBe(401);
  } finally { await f.cleanup(); }
});

it('persists versioned role focus separately, validates membership and leaves reports and billing unchanged', async () => {
  const f = await rescanFixture(db.db, db.rpc);
  try {
    const before = JSON.stringify(f.baseline.report), calls = { ...f.counters };
    const role = f.baseline.report.roles.find(r => r.template.roleId === 'mobile')!.template;
    const focus = await f.service.focus(f.actor, f.baseline.report.reportId, { role });
    expect(focus.roleOrder[0]).toBe('mobile'); expect((await f.service.focus(f.actor, f.baseline.report.reportId)).role).toEqual(role);
    expect(JSON.stringify((await f.reader.view(f.actor, f.baseline.report.reportId)).report)).toBe(before); expect(f.counters).toEqual(calls);
    await expect(f.service.focus(randomUUID(), f.baseline.report.reportId, { role })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.focus(f.actor, f.baseline.report.reportId, { role: { ...role, version: '99.0.0' } })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    const exported = await f.evidence.exportUserData(f.actor); expect(exported.reportPreferences).toHaveLength(1);
  } finally { await f.cleanup(); }
});
it('returns unchanged without another download, extraction, model call or reservation, and replays exactly once', async () => {
  const f = await rescanFixture(db.db, db.rpc);
  try {
    const request = f.request(), before = { ...f.counters };
    const result = await f.service.start(f.actor, f.baseline.report.reportId, request, f.policy, 5);
    expect(result).toEqual({ state: 'unchanged', reportId: f.baseline.report.reportId, charge: 'none' });
    expect(f.counters).toEqual({ ...before, resolves: before.resolves + 1 });
    const resolve = vi.spyOn(f.source, 'resolve'); expect(await f.service.start(f.actor, f.baseline.report.reportId, request, f.policy, 5)).toEqual(result); expect(resolve).not.toHaveBeenCalled();
    expect((await f.jobs.list(f.actor))).toHaveLength(1); expect((await f.service.history(f.actor, f.baseline.report.reportId, {})).items).toHaveLength(1);
    expect((await f.evidence.exportUserData(f.actor)).analysisLedger).toHaveLength(2);
    await expect(f.service.start(f.actor, f.baseline.report.reportId, { ...request, includeMetadata: { ci: true } }, f.policy, 5)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  } finally { await f.cleanup(); }
});
it('new test commit creates immutable lineage, reuses the other repository and records separate strength/confidence deltas', async () => {
  const f = await rescanFixture(db.db, db.rpc, 2);
  try {
    const before = JSON.stringify(f.baseline.report), repo = f.bindings[0].repositoryId;
    f.commits.set(repo, 'b'.repeat(40)); f.files.set(repo, { ...aggregationFiles });
    const request = f.request(), result = await f.service.start(f.actor, f.baseline.report.reportId, request, f.policy, 5);
    expect(result.state).toBe('queued'); if (result.state !== 'queued') throw new Error();
    expect((await f.service.start(f.actor, f.baseline.report.reportId, request, f.policy, 5))).toEqual(result);
    await f.worker.once(); const job = await f.jobs.read(f.actor, result.job.jobId); expect(job.status).toBe('completed'); if (job.status !== 'completed') throw new Error(JSON.stringify(job));
    expect(f.counters.downloads).toBe(3); expect(f.counters.extracts).toBe(3); expect(f.counters.models).toBe(2);
    const target = await f.reader.view(f.actor, job.report.reportId);
    expect(target.report.snapshots.find(s => s.repositoryId !== repo)!.snapshotId).toBe(f.baseline.report.snapshots.find(s => s.repositoryId !== repo)!.snapshotId);
    expect(JSON.stringify((await f.reader.view(f.actor, f.baseline.report.reportId)).report)).toBe(before);
    const diff = await f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: job.report.reportId });
    expect(diff.counts.gained).toBeGreaterThan(0); expect(diff.causes).toContain('commit_changed');
    expect(diff.capabilities.some(c => c.strengthDelta! > 0)).toBe(true);
    expect(diff.capabilities.find(c => c.capabilityId === 'failure_handling')?.confidenceDelta ?? 0).toBeLessThanOrEqual(.1);
    expect(JSON.stringify(diff)).not.toMatch(/fingerprint|contentKey|pathKey|retry\.ts|locatorEncrypted/);
    expect((await f.service.history(f.actor, job.report.reportId, {})).parent).toEqual({ state: 'available', reportId: f.baseline.report.reportId });
    await f.reader.remove(f.actor, f.baseline.report.reportId, randomUUID());
    expect((await f.service.history(f.actor, job.report.reportId, {})).parent.state).toBe('unavailable');
    await expect(f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: job.report.reportId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await f.reader.view(f.actor, job.report.reportId)).report.reportId).toBe(job.report.reportId);
  } finally { await f.cleanup(); }
});
it('rejects foreign baselines, target reports, selections and grant changes during preflight', async () => {
  const a = await rescanFixture(db.db, db.rpc), b = await rescanFixture(db.db, db.rpc);
  try {
    await expect(a.service.start(a.actor, b.baseline.report.reportId, a.request(), a.policy, 5)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(a.service.compare(a.actor, a.baseline.report.reportId, { targetReportId: b.baseline.report.reportId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(a.service.start(a.actor, a.baseline.report.reportId, b.request(), a.policy, 5)).rejects.toMatchObject({ code: 'REPOSITORY_ACCESS_REVOKED' });
    const source = { resolve: async (...args: Parameters<typeof a.source.resolve>) => { const result = await a.source.resolve(...args); await a.evidence.revokeGrant(a.actor, a.bindings[0].grantId, randomUUID()); return result; } };
    const racing = new RescanService(db.rpc, a.reader, source, () => a.crypto);
    await expect(racing.start(a.actor, a.baseline.report.reportId, a.request(), a.policy, 5)).rejects.toMatchObject({ code: 'REPOSITORY_ACCESS_REVOKED' });
    expect((await a.jobs.list(a.actor))).toHaveLength(1); expect((await a.service.history(a.actor, a.baseline.report.reportId, {})).items).toEqual([]);
  } finally { await a.cleanup(); await b.cleanup(); }
});
it('removing a selected repository qualifies evidence losses and reuses the still-authorized snapshot', async () => {
  const f = await rescanFixture(db.db, db.rpc, 2);
  try {
    const started = await f.service.start(f.actor, f.baseline.report.reportId, { ...f.request(), repositoryIds: [f.bindings[0].repositoryId] }, f.policy, 5);
    if (started.state !== 'queued') throw new Error(); await f.worker.once();
    const job = await f.jobs.read(f.actor, started.job.jobId); if (job.status !== 'completed') throw new Error(JSON.stringify(job));
    const diff = await f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: job.report.reportId, change: 'lost' });
    expect(diff.causes).toContain('repository_removed'); expect(diff.comparability).toBe('limited'); expect(diff.counts.lost).toBeGreaterThan(0);
    expect(diff.evidence.every(e => e.interpretation === 'limited_by_scope_or_versions')).toBe(true);
    expect(f.counters.downloads).toBe(2); expect(f.counters.extracts).toBe(2); expect(f.counters.models).toBe(2);
  } finally { await f.cleanup(); }
});
it.each(['rename', 'moved module', 'deleted implementation', 'dependency only', 'excluded path', 'no content change'] as const)('compares a real two-commit history: %s', async scenario => {
  const f = await rescanFixture(db.db, db.rpc);
  try {
    const repo = f.bindings[0].repositoryId, files = f.files.get(repo)!;
    f.commits.set(repo, 'c'.repeat(40));
    if (scenario === 'rename' || scenario === 'moved module') { files[scenario === 'rename' ? 'renamed.ts' : 'nested/retry.ts'] = files['retry.ts']; delete files['retry.ts']; }
    if (scenario === 'moved module') { files['nested/service.ts'] = files['service.ts']; delete files['service.ts']; }
    if (scenario === 'deleted implementation') delete files['retry.ts'];
    if (scenario === 'dependency only') files['package.json'] = '{"dependencies":{"express":"4.21.2","react":"19.0.0"},"devDependencies":{"vitest":"4.0.0"}}';
    if (scenario === 'excluded path') files['.repofyignore'] = 'retry.ts\n';
    const started = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), f.policy, 5); if (started.state !== 'queued') throw new Error();
    await f.worker.once(); const job = await f.jobs.read(f.actor, started.job.jobId); if (job.status !== 'completed') throw new Error(JSON.stringify(job));
    const diff = await f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: job.report.reportId, limit: 100 });
    if (scenario === 'rename' || scenario === 'moved module') { expect(diff.counts.relocated).toBeGreaterThan(0); expect(diff.counts.lost).toBe(0); expect(diff.counts.gained).toBe(0); }
    if (scenario === 'deleted implementation') { expect(diff.counts.lost).toBeGreaterThan(0); expect(diff.capabilities.find(c => c.capabilityId === 'performance_resources')!.strengthDelta).toBeLessThan(0); }
    if (scenario === 'dependency only') { expect(diff.counts.changed).toBeGreaterThan(0); expect(diff.capabilities.find(c => c.capabilityId === 'performance_resources')!.strengthDelta).toBe(0); }
    if (scenario === 'excluded path') { expect(diff.causes).toContain('scope_changed'); expect(diff.comparability).toBe('limited'); expect(diff.evidence.filter(e => e.change === 'lost').every(e => e.interpretation === 'limited_by_scope_or_versions')).toBe(true); }
    if (scenario === 'no content change') { expect(diff.counts.unchanged).toBeGreaterThan(0); for (const key of ['gained','lost','changed','relocated','uncertain'] as const) expect(diff.counts[key]).toBe(0); }
  } finally { await f.cleanup(); }
});
it('scope/metadata and source-policy changes invalidate reuse; a role-only policy change can reuse source', async () => {
  const f = await rescanFixture(db.db, db.rpc);
  try {
    const changedRole = structuredClone(f.policy); changedRole.versions.roleRubrics[0].version = '2.0.0';
    const start = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), changedRole, 5); if (start.state !== 'queued') throw new Error();
    const claim = (await f.jobs.claim())!;
    expect(await f.jobs.reuseSnapshot(claim, f.bindings[0].repositoryId)).toBe(f.baseline.report.snapshots[0].snapshotId);
    await f.jobs.cancel(f.actor, claim.jobId, randomUUID());
    const metadata = await f.service.start(f.actor, f.baseline.report.reportId, { ...f.request(), includeMetadata: { ci: true } }, f.policy, 5); if (metadata.state !== 'queued') throw new Error();
    const metaClaim = (await f.jobs.claim())!; expect(await f.jobs.reuseSnapshot(metaClaim, f.bindings[0].repositoryId)).toBeNull();
    await f.jobs.cancel(f.actor, metaClaim.jobId, randomUUID());
    const { policyHash } = await import('../../src/domain/ingestion/policy');
    const security = structuredClone(f.policy); security.security.limits.eligibleFiles--; security.versions.ingestionPolicyHash = policyHash(security.security) as never;
    const changed = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), security, 5); if (changed.state !== 'queued') throw new Error();
    expect(await f.jobs.reuseSnapshot((await f.jobs.claim())!, f.bindings[0].repositoryId)).toBeNull();
  } finally { await f.cleanup(); }
});
