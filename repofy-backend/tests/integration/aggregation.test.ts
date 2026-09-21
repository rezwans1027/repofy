import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { selectionDatabase } from '../helpers/selection-db';
import { seedJobRubrics } from '../helpers/job-fixtures';
import { coverageJobFixture } from '../helpers/coverage-job-fixture';
import { aggregationPolicy, aggregationFiles } from '../helpers/aggregation-fixtures';
import { aggregateEvidence } from '../../src/domain/aggregation/engine';
import { AggregationRepository } from '../../src/domain/aggregation/repository';
import { AGGREGATION_POLICY } from '../../src/domain/aggregation/policy';
import type { StageContext } from '../../src/domain/jobs/worker';

let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async () => { db = await selectionDatabase(); await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });
async function fixture(files = aggregationFiles) {
  const f = await coverageJobFixture(db.db, db.rpc, files, aggregationPolicy);
  const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto);
  const { runId } = await f.f.jobs.run(f.claim, [sid]);
  const context: StageContext = { claim: f.claim, runId, snapshotIds: [sid], signal: new AbortController().signal, checkpoint: () => f.f.jobs.heartbeat(f.claim) };
  await f.f.jobs.stage(f.claim, 'aggregating');
  return { ...f, runId, context, repository: new AggregationRepository(f.f.jobs) };
}
it('persists reproducible calculations through the fenced worker stage, queries owner evidence and exports/deletes it', async () => {
  const f = await fixture();
  try {
    expect(await f.repository.read(f.f.actor, f.runId)).toBeNull();
    await f.repository.aggregate(f.context); await f.repository.aggregate(f.context);
    const result = (await f.repository.read(f.f.actor, f.runId))!;
    expect(result.capabilities.find(c => c.capabilityId === 'performance_resources')!.strength).toBe(.65);
    expect(result.roles).toHaveLength(5);
    expect(await f.repository.read(randomUUID(), f.runId)).toBeNull();
    await expect(f.repository.evidence(randomUUID(), f.runId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const page1 = await f.repository.evidence(f.f.actor, f.runId, { limit: 1 });
    const page2 = await f.repository.evidence(f.f.actor, f.runId, { limit: 100, afterEvidenceId: page1.nextEvidenceId! });
    expect(page1.items).toHaveLength(1); expect(page2.items.some(i => i.evidence.evidenceId === page1.items[0].evidence.evidenceId)).toBe(false);
    expect(page2.nextEvidenceId).toBeNull();
    const grouped = await f.repository.evidence(f.f.actor, f.runId, { categoryId: 'reliability', roleId: 'backend', requirementId: 'performance_resources', repositoryId: f.bundle.snapshot.repositoryId });
    expect(grouped.items).toHaveLength(2); expect(grouped.items.every(i => i.capabilityIds.includes('performance_resources'))).toBe(true);
    expect(JSON.stringify(grouped)).not.toMatch(/contentFingerprint|fingerprint|retry\.ts|export async|locator_encrypted/);
    expect((await f.f.evidence.exportUserData(f.f.actor)).aggregations).toEqual([result]);
    expect((await db.db.query<{ definition: unknown }>('SELECT definition FROM feature_one_private.aggregation_policies')).rows[0].definition).toEqual(AGGREGATION_POLICY);
    await expect(db.db.query("UPDATE feature_one_private.analysis_aggregations SET payload='{}'")).rejects.toThrow('IMMUTABLE_CONTENT');
    await f.f.jobs.cancel(f.f.actor, f.job.jobId, randomUUID()); await f.f.jobs.delete(f.f.actor, f.job.jobId, randomUUID());
    expect(await f.repository.read(f.f.actor, f.runId)).toBeNull();
    expect((await db.db.query('SELECT * FROM feature_one_private.aggregation_support WHERE run_id=$1', [f.runId])).rows).toHaveLength(0);
  } finally { await f.cleanup(); }
});
it('rejects cross-run evidence, version tampering, inflated traces and bypassed role minima with atomic rollback', async () => {
  const f = await fixture();
  try {
    const args = { p_job: f.claim.jobId, p_token: f.claim.token, p_run: f.runId };
    const input = await f.f.jobs.call('aggregation_input', args); const result = aggregateEvidence(input);
    for (const mutate of [
      (x: any) => x.versions.aggregationPolicy.version = '1.0.1',
      (x: any) => x.runId = randomUUID(),
      (x: any) => x.snapshotIds[0] = randomUUID(),
      (x: any) => x.capabilities.find((c: any) => c.state === 'assessed').support[0].evidenceId = randomUUID(),
      (x: any) => x.capabilities.find((c: any) => c.state === 'assessed').trace.clusters[0].strength = .99,
      (x: any) => x.capabilities[0].trace.coverage[0].fraction = .9,
      (x: any) => { const q = x.roles[0].requirements.find((q: any) => q.state !== 'satisfied'); q.state = 'satisfied'; q.strength = 1; q.satisfaction = 1; q.weightedContribution = q.weight; },
      (x: any) => x.roles[0].denominator = .05,
    ]) {
      const bad = structuredClone(result); mutate(bad);
      const response = await db.rpc.rpc('feature_one_job_aggregation_store', { ...args, p_result: bad });
      expect(response.error, JSON.stringify(bad.validation)).not.toBeNull();
      expect(await f.repository.read(f.f.actor, f.runId)).toBeNull();
      expect((await db.db.query('SELECT * FROM feature_one_private.aggregation_support WHERE run_id=$1', [f.runId])).rows).toHaveLength(0);
    }
    await f.repository.aggregate(f.context);
    const changed = structuredClone(result); changed.inputHash = 'sha256:' + 'a'.repeat(64);
    expect((await db.rpc.rpc('feature_one_job_aggregation_store', { ...args, p_result: changed })).error?.message).toBe('IDEMPOTENCY_CONFLICT');
  } finally { await f.cleanup(); }
});
it('fences canceled and expired attempts, rejects foreign run context, and preserves unknown-only outputs', async () => {
  const f = await fixture({ 'app.swift': 'struct App {}' } as typeof aggregationFiles);
  try {
    await expect(f.repository.aggregate({ ...f.context, snapshotIds: [randomUUID()] })).rejects.toMatchObject({ code: 'ANALYSIS_VALIDATION_FAILED' });
    await f.repository.aggregate(f.context); const result = (await f.repository.read(f.f.actor, f.runId))!;
    expect(result.roles.every(r => r.state === 'unknown' && r.coverage === null)).toBe(true);
    await f.f.jobs.cancel(f.f.actor, f.job.jobId, randomUUID());
    await expect(f.repository.aggregate(f.context)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  } finally { await f.cleanup(); }
});
