import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { jobsRpc } from './jobs.cases';
import { narrativeJobFixture, syntheticGateway } from '../helpers/narrative-fixtures';
import { NarrativeService } from '../../src/domain/synthesis/service';
import { ReadinessReader } from '../../src/domain/readiness/reader';

export function registerReadinessTests(db: pg.Client, config: pg.ClientConfig) {
  async function saved() {
    const f = await narrativeJobFixture(db, jobsRpc(db)); const service = new NarrativeService(f.f.jobs, syntheticGateway);
    const report = await service.synthesize(f.context); await f.f.jobs.synthesis(f.claim, f.hash, report); await f.f.jobs.stage(f.claim, 'validating'); await f.f.jobs.complete(f.claim);
    const reader = new ReadinessReader(jobsRpc(db), () => f.f.crypto, { async verifyRepository() { throw new Error('Provider unavailable'); } });
    return { ...f, report, reader };
  }
  test('owner readers work with service-role privileges; browser roles cannot choose RPC actors', async () => {
    const f = await saved();
    try {
      assert.equal((await f.reader.view(f.f.actor, f.report.reportId)).report.reportId, f.report.reportId);
      assert.ok((await f.reader.evidence(f.f.actor, f.report.reportId, {})).items.length);
      await assert.rejects(f.reader.view(randomUUID(), f.report.reportId), { code: 'NOT_FOUND' });
      await f.reader.event(f.f.actor, f.report.reportId, { event: 'improvement_opened', objectId: f.report.improvements[0].improvementId }, randomUUID());
      for (const role of ['anon', 'authenticated']) {
        await db.query('BEGIN'); await db.query(`SET LOCAL ROLE ${role}`);
        await assert.rejects(db.query('SELECT public.feature_one_report_view($1,$2)', [f.f.actor, f.report.reportId]), /permission denied/); await db.query('ROLLBACK');
      }
      assert.equal((await f.reader.improvement(f.f.actor, f.report.reportId, f.report.improvements[0].improvementId)).proofStatus, 'proposed_not_observed');
    } finally { await db.query('ROLLBACK'); await f.cleanup(); }
  });
  test('foreign report evidence cannot cross an actual run boundary and cursor pages remain bounded', async () => {
    const a = await saved(), b = await saved();
    try {
      await assert.rejects(a.reader.evidence(a.f.actor, a.report.reportId, { evidenceId: b.report.evidence[0].evidenceId }), { code: 'NOT_FOUND' });
      await assert.rejects(a.reader.location(a.f.actor, a.report.reportId, b.report.evidence[0].evidenceId), { code: 'NOT_FOUND' });
      await assert.rejects(a.reader.history(a.f.actor, { afterReportId: b.report.reportId }), { code: 'NOT_FOUND' });
      const one = await a.reader.evidence(a.f.actor, a.report.reportId, { limit: 1 });
      const two = await a.reader.evidence(a.f.actor, a.report.reportId, { afterEvidenceId: one.nextEvidenceId!, limit: 1 });
      assert.notEqual(one.items[0].evidence.evidenceId, two.items[0].evidence.evidenceId);
      await db.query('DELETE FROM auth.users WHERE id=$1', [a.f.actor]);
      await assert.rejects(a.reader.view(a.f.actor, a.report.reportId), { code: 'NOT_FOUND' });
      assert.equal((await b.reader.view(b.f.actor, b.report.reportId)).report.reportId, b.report.reportId);
    } finally { await a.cleanup(); await b.cleanup(); }
  });
  test('snapshot observations omitted from representative citations remain inspectable without changing report math', async () => {
    const f = await saved();
    try {
      const observation = f.bundle.evidence.find(e => !f.report.evidence.some(c => c.evidenceId === e.evidenceId));
      assert.ok(observation, 'fixture must contain an uncited observation');
      const page = await f.reader.evidence(f.f.actor, f.report.reportId, { evidenceId: observation.evidenceId });
      assert.equal(page.items[0].evidence.snapshotId, f.bundle.snapshot.snapshotId);
      assert.equal(page.items[0].evidence.evidenceId, observation.evidenceId);
      const locator = await jobsRpc(db).rpc('feature_one_report_locator', { p_actor: f.f.actor, p_report: f.report.reportId, p_evidence: observation.evidenceId });
      assert.equal(locator.error, null);
      await f.reader.event(f.f.actor, f.report.reportId, { event: 'evidence_opened', objectId: observation.evidenceId }, randomUUID());
      assert.deepEqual((await f.reader.view(f.f.actor, f.report.reportId)).report.roles, f.report.roles);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.analysis_run_evidence WHERE run_id=$1 AND evidence_id=$2', [f.context.runId, observation.evidenceId])).rows[0].n, 0);
    } finally { await f.cleanup(); }
  });
  test('deletion on an independent connection fences an active validator and removes exported drafts', async () => {
    const f = await narrativeJobFixture(db, jobsRpc(db)), other = new pg.Client(config); await other.connect();
    try {
      const service = new NarrativeService(f.f.jobs, syntheticGateway); const report = await service.synthesize(f.context);
      await f.f.jobs.synthesis(f.claim, f.hash, report); await f.f.jobs.stage(f.claim, 'validating');
      const result = await jobsRpc(other).rpc('feature_one_delete_analysis', { p_actor: f.f.actor, p_job: f.claim.jobId, p_request_id: randomUUID() }); assert.equal(result.error, null);
      await assert.rejects(f.f.jobs.complete(f.claim)); await assert.rejects(f.f.jobs.heartbeat(f.claim));
      const exported = await f.f.evidence.exportUserData(f.f.actor); assert.deepEqual(exported.reports, []); assert.deepEqual(exported.analysisDrafts, []); assert.deepEqual(exported.evidence, []);
    } finally { await other.end(); await f.cleanup(); }
  });
}
