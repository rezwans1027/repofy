import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { jobsRpc } from './jobs.cases';
import { rescanFixture } from '../helpers/rescan-fixture';
import { RescanService } from '../../src/domain/rescans/service';

export function registerRescanTests(db: pg.Client, config: pg.ClientConfig) {
  for (const missing of [false, true]) test(`external imports preserve comparison scope; missing local import: ${missing}`, async () => {
    const query = "import {Pool} from 'pg'; const pool=new Pool(); export async function read(id){return await pool.query('SELECT id FROM records WHERE id=$1',[id]);}";
    const f = await rescanFixture(db, jobsRpc(db), 1, { 'query.ts': query + (missing ? "\nimport {value} from './missing';" : '') });
    try {
      f.commits.set(f.bindings[0].repositoryId, 'b'.repeat(40));
      const result = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), f.policy, 5);
      assert.equal(result.state, 'queued'); if (result.state !== 'queued') throw new Error();
      await f.worker.once();
      const done = await f.jobs.read(f.actor, result.job.jobId); assert.equal(done.status, 'completed'); if (done.status !== 'completed') throw new Error();
      assert.equal(f.baseline.report.coverage[0].implementation?.unresolvedImports, missing ? 1 : 0);
      const diff = await f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: done.report.reportId });
      assert.equal(diff.comparability, missing ? 'limited' : 'comparable');
      assert.equal(diff.causes.includes('scope_incomplete'), missing);
      assert.equal(diff.causes.includes('scope_changed'), false);
      assert.equal(diff.counts.gained + diff.counts.lost, 0);
      assert.ok(diff.counts.unchanged > 0);
    } finally { await f.cleanup(); }
  });
  test('concurrent rescan admission pins one SHA set, one job and one reservation under independent service connections', async () => {
    const a = new pg.Client(config), b = new pg.Client(config); await a.connect(); await b.connect();
    const f = await rescanFixture(db, jobsRpc(a));
    try {
      f.commits.set(f.bindings[0].repositoryId, 'b'.repeat(40));
      const other = new RescanService(jobsRpc(b), f.reader, f.source, () => f.crypto), request = f.request();
      const [one, two] = await Promise.all([f.service.start(f.actor, f.baseline.report.reportId, request, f.policy, 5), other.start(f.actor, f.baseline.report.reportId, request, f.policy, 5)]);
      assert.deepEqual(one, two); assert.equal(one.state, 'queued'); if (one.state !== 'queued') throw new Error();
      assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.report_rescans WHERE user_id=$1', [f.actor])).rows[0].n, 1);
      assert.equal((await db.query("SELECT count(*)::int n FROM feature_one_private.analysis_ledger WHERE job_id=$1 AND kind='reserve'", [one.job.jobId])).rows[0].n, 1);
      assert.equal((await db.query('SELECT commit_sha FROM feature_one_private.ingestion_pins WHERE job_id=$1', [one.job.jobId])).rows[0].commit_sha, 'b'.repeat(40));
      for (const role of ['anon','authenticated']) {
        await db.query('BEGIN'); await db.query(`SET LOCAL ROLE ${role}`);
        await assert.rejects(db.query('SELECT public.feature_one_focus($1,$2)', [f.actor, f.baseline.report.reportId]), /permission denied/); await db.query('ROLLBACK');
        await db.query('BEGIN'); await db.query(`SET LOCAL ROLE ${role}`);
        await assert.rejects(db.query('SELECT public.feature_one_comparison_input($1,$2,$2)', [f.actor, f.baseline.report.reportId]), /permission denied/); await db.query('ROLLBACK');
      }
      await f.worker.once(); const done = await f.jobs.read(f.actor, one.job.jobId); assert.equal(done.status, 'completed');
      assert.equal((await db.query("SELECT count(*)::int n FROM audit_events WHERE job_id=$1 AND action='rescan_completed'", [one.job.jobId])).rows[0].n, 1);
      const exported = await f.evidence.exportUserData(f.actor); assert.equal(exported.reportRescans.length, 1); assert.doesNotMatch(JSON.stringify(exported.reportRescans), /request_hash|request_key/);
    } finally { await db.query('ROLLBACK'); await f.cleanup(); await a.end(); await b.end(); }
  });
  test('revocation between a reuse probe and attachment fences the cache hit', async () => {
    const a = new pg.Client(config); await a.connect(); const f = await rescanFixture(db, jobsRpc(db));
    try {
      const changed = structuredClone(f.policy); changed.versions.roleRubrics[0].version = '2.0.0';
      const result = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), changed, 5); assert.equal(result.state, 'queued');
      const claim = (await f.jobs.claim())!; assert.ok(await f.jobs.reuseSnapshot(claim, f.bindings[0].repositoryId));
      const revoke = await jobsRpc(a).rpc('feature_one_revoke_grant', { p_actor: f.actor, p_grant: f.bindings[0].grantId, p_request_id: randomUUID() }); assert.equal(revoke.error, null);
      await assert.rejects(f.jobs.reuseSnapshot(claim, f.bindings[0].repositoryId, true));
      assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=$1', [claim.jobId])).rows[0].n, 0);
    } finally { await f.cleanup(); await a.end(); }
  });
  test('deleting the baseline during a queued rescan preserves authorized work but never reconstructs its old report', async () => {
    const f = await rescanFixture(db, jobsRpc(db));
    try {
      f.commits.set(f.bindings[0].repositoryId, 'c'.repeat(40));
      const result = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), f.policy, 5); if (result.state !== 'queued') throw new Error();
      await f.reader.remove(f.actor, f.baseline.report.reportId, randomUUID()); await f.worker.once();
      const done = await f.jobs.read(f.actor, result.job.jobId); assert.equal(done.status, 'completed'); if (done.status !== 'completed') throw new Error();
      assert.equal((await f.service.history(f.actor, done.report.reportId, {})).parent.state, 'unavailable');
      await assert.rejects(f.service.compare(f.actor, f.baseline.report.reportId, { targetReportId: done.report.reportId }), { code: 'NOT_FOUND' });
      await db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]);
      for (const table of ['report_preferences','report_rescans']) assert.equal((await db.query(`SELECT count(*)::int n FROM feature_one_private.${table} WHERE user_id=$1`, [f.actor])).rows[0].n, 0);
    } finally { await f.cleanup(); }
  });
}
