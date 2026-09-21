import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { rescanFixture } from '../helpers/rescan-fixture';
import { narrativeExecutionPolicy } from '../../src/domain/synthesis/composition';
import { GitHubAppError } from '../../src/domain/github-app/errors';
let db: Awaited<ReturnType<typeof selectionDatabase>>;
const rpcErrors: string[] = [];
beforeAll(async () => { db = await selectionDatabase(); const rpc = db.rpc.rpc; db.rpc.rpc = async (name, args) => { const result = await rpc(name, args); if (result.error) rpcErrors.push(`${name}: ${result.error.message}`); return result; }; await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });
it('explicit reanalysis freezes new provenance, reuses source, preserves old measurements and versions, and publishes bounded explanations', async () => {
  const f = await rescanFixture(db.db, db.rpc), policy = narrativeExecutionPolicy(true), before = JSON.stringify(f.baseline.report);
  try {
    const started = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), policy, 5); if (started.state !== 'queued') throw new Error();
    const provider = { async verifyRepository() { return { item: { id: f.bundles[0].snapshot.providerRepositoryId, private: false, archived: false, fork: true, template_repository: { id: '800' }, name: 'PRIVATE_REPOSITORY_SENTINEL' } } as never; } };
    await f.workerFor(policy, provider).once(); const job = await f.jobs.read(f.actor, started.job.jobId);
    expect(job.status, JSON.stringify({ status: job.status, rpcErrors })).toBe('completed'); if (job.status !== 'completed') throw new Error('Expected completed analysis');
    const target = await f.reader.view(f.actor, job.report.reportId);
    expect(target.report.versions.aggregationPolicy.version).toBe('1.1.0'); expect(target.aggregation!.provenance!.snapshots[0].signals).toContain('provider_fork');
    expect(target.aggregation!.provenance!.snapshots[0].signals).toContain('provider_template_origin'); expect(target.aggregation!.provenance!.snapshots[0].contribution.confidence).toBeNull();
    expect(target.report.roles).toEqual(f.baseline.report.roles); expect(target.report.claims[0].text).toContain('Contribution confidence remains unknown');
    expect(f.counters.downloads).toBe(1); expect(JSON.stringify((await f.reader.view(f.actor, f.baseline.report.reportId)).report)).toBe(before);
    const diff = await f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: target.report.reportId }); expect(diff.causes).toContain('aggregation_changed'); expect(diff.capabilities.every(c => c.strengthDelta === null || c.strengthDelta === 0)).toBe(true);
    expect(JSON.stringify(target.aggregation!.provenance)).not.toMatch(/PRIVATE_REPOSITORY|accountId|installationId|template_repository/);
    expect((await f.evidence.exportUserData(f.actor)).provenance).toHaveLength(1);
    await f.reader.remove(f.actor, target.report.reportId, randomUUID()); expect((await f.evidence.exportUserData(f.actor)).provenance).toEqual([]);
  } finally { await f.cleanup(); }
});
it('unavailable context remains unknown and revocation during provider verification blocks publication', async () => {
  const f = await rescanFixture(db.db, db.rpc), policy = narrativeExecutionPolicy(true);
  try {
    const first = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), policy, 5); if (first.state !== 'queued') throw new Error();
    await f.workerFor(policy).once(); const completed = await f.jobs.read(f.actor, first.job.jobId); expect(completed.status).toBe('completed');
    const started = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), policy, 5); if (started.state !== 'queued') throw new Error();
    const provider = { async verifyRepository() { await f.evidence.revokeGrant(f.actor, f.bindings[0].grantId, randomUUID()); throw new Error('PRIVATE_ERROR_SENTINEL'); } };
    await f.workerFor(policy, provider).once(); const job = await f.jobs.read(f.actor, started.job.jobId); expect(job.status).toBe('failed');
    expect(JSON.stringify(job)).not.toContain('PRIVATE_ERROR_SENTINEL');
    expect((await db.db.query('SELECT count(*)::int n FROM feature_one_private.analysis_provenance WHERE job_id=$1', [started.job.jobId])).rows[0].n).toBe(0);
  } finally { await f.cleanup(); }
});
it.each(['provider_outage', 'database_failure', 'access_changed', 'insufficient_permissions', 'pending_approval'] as const)('handles %s without inventing provenance or hiding authorization/storage failure', async failure => {
  const f = await rescanFixture(db.db, db.rpc), policy = narrativeExecutionPolicy(true);
  try {
    const started = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), policy, 5); if (started.state !== 'queued') throw new Error();
    const provider = { async verifyRepository() { throw failure === 'provider_outage' ? new Error('PRIVATE_PROVIDER_SENTINEL') : new GitHubAppError(failure); } };
    await f.workerFor(policy, provider).once(); const job = await f.jobs.read(f.actor, started.job.jobId);
    expect(job.status).toBe(failure === 'provider_outage' ? 'completed' : failure === 'database_failure' ? 'queued' : 'failed');
    if (job.status === 'completed') {
      const context = (await f.reader.view(f.actor, job.report.reportId)).aggregation!.provenance!.snapshots[0];
      expect(context.provider).toMatchObject({ state: 'unavailable', fork: null, templateOrigin: 'unknown' }); expect(context.contribution.confidenceModifier).toBeNull();
    }
    expect(JSON.stringify(job)).not.toContain('PRIVATE_PROVIDER_SENTINEL');
  } finally { await f.cleanup(); }
});
