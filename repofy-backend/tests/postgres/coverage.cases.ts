import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { jobsRpc } from './jobs.cases';
import { coverageJobFixture } from '../helpers/coverage-job-fixture';
import { languageMatrix, pythonSource, javaSource, pom } from '../fixtures/evidence/language-coverage';
import { EvidenceRepository, type FeatureOneRpcClient } from '../../src/domain/analysis/persistence';
import { JobRepository } from '../../src/domain/jobs/repository';

export function registerCoverageTests(db: pg.Client, config: pg.ClientConfig) {
  test('coverage snapshot is canonical under concurrent worker writes and owner-only progress reads', async () => {
    const a = new pg.Client(config), b = new pg.Client(config); await a.connect(); await b.connect();
    const fixture = await coverageJobFixture(db, jobsRpc(a), { 'app.py': pythonSource, 'Calculator.java': javaSource, 'pom.xml': pom });
    const { f, claim, job, bundle } = fixture;
    try {
      const other = new JobRepository(jobsRpc(b)); const ids = await Promise.all([f.jobs.storeSnapshot(claim, bundle, f.crypto), other.storeSnapshot(claim, bundle, f.crypto)]);
      assert.equal(ids[0], ids[1]); assert.deepEqual((await f.jobs.read(f.actor, job.jobId)).coverage, [bundle.coverage]);
      await assert.rejects(other.read(randomUUID(), job.jobId), /NOT_FOUND/);
      await assert.rejects(db.query("UPDATE feature_one_private.analyzer_coverage_manifests SET declaration='{}'"), /IMMUTABLE_CONTENT/);
      await db.query('SET ROLE authenticated');
      try { await assert.rejects(db.query('SELECT * FROM feature_one_private.analyzer_coverage_manifests'), /permission denied/); }
      finally { await db.query('RESET ROLE'); }
    } finally { await fixture.cleanup(); await a.end(); await b.end(); }
  });
  test('coverage cannot cross cancellation and raw SQL cannot inflate assessability or hide omitted files', async () => {
    const fixture = await coverageJobFixture(db, jobsRpc(db), { 'app.py': pythonSource, 'bad.py': 'def bad(:' });
    const { f, claim, job, bundle } = fixture;
    try {
      let captured: any; const capture: FeatureOneRpcClient = { async rpc(_name, args) { captured = structuredClone(args); return { data: bundle.snapshot.snapshotId, error: null }; } };
      await new EvidenceRepository(capture).storeSnapshot(f.actor, f.bindings[0].grantId, bundle, f.crypto);
      for (const mutate of [
        (b: any) => b.coverage.assessment.counts.totalFiles--,
        (b: any) => b.coverage.assessment.capabilities.find((c: any) => c.capabilityId === 'mobile_lifecycle').state = 'assessable',
        (b: any) => b.coverage.assessment.declaration.selection.maxImplementationFiles++,
        (b: any) => b.coverage.assessment.reasons.push('private exception detail'),
      ]) {
        const bad = structuredClone(captured); mutate(bad.p_bundle); const result = await jobsRpc(db).rpc('feature_one_store_snapshot', bad);
        assert.equal(result.error?.message, 'INCOMPLETE_ANALYSIS');
        assert.equal((await db.query('SELECT count(*)::int n FROM public.repository_snapshots WHERE id=$1', [bundle.snapshot.snapshotId])).rows[0].n, 0);
      }
      await f.jobs.cancel(f.actor, job.jobId, randomUUID()); await assert.rejects(f.jobs.storeSnapshot(claim, bundle, f.crypto), /LEASE_LOST/);
    } finally { await fixture.cleanup(); }
  });
  test('mixed unsupported source retains independent schema and CI scope in PostgreSQL', async () => {
    const fixture = await coverageJobFixture(db, jobsRpc(db), languageMatrix.find(c => c.name === 'mixed')!.files);
    try { const { f, claim, bundle } = fixture; await f.jobs.storeSnapshot(claim, bundle, f.crypto);
      const scope = (await f.jobs.read(f.actor, claim.jobId)).coverage![0].assessment!;
      assert.equal(scope.capabilities.find(c => c.capabilityId === 'data_modeling')!.observations, 1);
      assert.equal(scope.capabilities.find(c => c.capabilityId === 'delivery_automation')!.observations, 1);
      assert.equal(scope.capabilities.find(c => c.capabilityId === 'mobile_lifecycle')!.state, 'not_assessable');
    } finally { await fixture.cleanup(); }
  });
}
