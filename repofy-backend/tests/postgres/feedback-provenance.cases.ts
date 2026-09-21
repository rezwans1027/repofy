import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { jobsRpc } from './jobs.cases';
import { rescanFixture } from '../helpers/rescan-fixture';
import { FindingFeedbackService } from '../../src/domain/feedback/service';
import { narrativeExecutionPolicy } from '../../src/domain/synthesis/composition';
import { emptyMetadata, providerDetail } from '../../src/domain/extraction/metadata';

export function registerFeedbackProvenanceTests(db: pg.Client, config: pg.ClientConfig) {
  test('terminal job timestamps remain ordered when clock expressions differ, and terminal jobs remain immutable', async () => {
    const f = await rescanFixture(db, jobsRpc(db));
    try {
      const job = await f.jobs.start(f.actor, { ...f.body, idempotencyKey: randomUUID() }, f.policy, 5, randomUUID());
      await db.query("UPDATE public.analysis_jobs SET status='expired',updated_at=created_at,finished_at=created_at+interval '1 second' WHERE id=$1", [job.jobId]);
      const done = await f.jobs.read(f.actor, job.jobId); assert.equal(done.status, 'expired');
      assert.equal(done.updatedAt, (done as { finishedAt: string }).finishedAt);
      await assert.rejects(db.query("UPDATE public.analysis_jobs SET updated_at=clock_timestamp() WHERE id=$1", [job.jobId]), /INVALID_TRANSITION/);
    } finally { await f.cleanup(); }
  });
  test('concurrent finding feedback creates one revision; competing edits are fenced; reviewer access and account deletion remain private', async () => {
    const a = new pg.Client(config), b = new pg.Client(config); await a.connect(); await b.connect();
    const f = await rescanFixture(db, jobsRpc(a)), left = new FindingFeedbackService(jobsRpc(a)), right = new FindingFeedbackService(jobsRpc(b));
    const reportId = f.baseline.report.reportId, ref = { kind: 'evidence', id: f.baseline.report.evidence[0].evidenceId };
    const body = { classification: 'unclear', comment: 'PRIVATE_COMMENT_SENTINEL', expectedRevision: 0, idempotencyKey: randomUUID() };
    try {
      const [one, two] = await Promise.all([left.feedback(f.actor, reportId, ref, body), right.feedback(f.actor, reportId, ref, body)]);
      assert.deepEqual(one, two); assert.equal(one!.revision, 1);
      const edits = await Promise.allSettled([left.feedback(f.actor, reportId, ref, { ...body, classification: 'accurate', expectedRevision: 1, idempotencyKey: randomUUID() }), right.feedback(f.actor, reportId, ref, { ...body, classification: 'inaccurate', expectedRevision: 1, idempotencyKey: randomUUID() })]);
      assert.equal(edits.filter(e => e.status === 'fulfilled').length, 1);
      assert.equal((edits.find(e => e.status === 'rejected') as PromiseRejectedResult).reason.code, 'IDEMPOTENCY_CONFLICT');
      assert.equal((await left.feedback(f.actor, reportId, ref))!.revision, 2);
      await assert.rejects(left.queue(f.actor, {}), { code: 'FORBIDDEN' }); await db.query('INSERT INTO feature_one_private.finding_reviewers VALUES($1,true)', [f.actor]);
      assert.doesNotMatch(JSON.stringify(await left.queue(f.actor, {})), /PRIVATE_COMMENT|"(?:comment|reportId|findingId|source|repository)":/);
      const review = { expectedRevision: 2, expectedReviewRevision: 0, disposition: 'needs_reproduction', note: 'needs_fixture', benchmarkCase: null, idempotencyKey: randomUUID() };
      const reviews = await Promise.all([left.review(f.actor, one!.id, review), right.review(f.actor, one!.id, review)]); assert.deepEqual(reviews[0], reviews[1]);
      for (const role of ['anon','authenticated','service_role']) for (const table of ['finding_feedback','finding_feedback_events','finding_feedback_requests','finding_reviewers','finding_reviews','analysis_provenance']) {
        const priv = (await db.query('SELECT has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') exposed', [role, `feature_one_private.${table}`])).rows[0]; assert.equal(priv.exposed, false);
      }
      for (const role of ['anon','authenticated']) {
        for (const fn of ['feature_one_finding_feedback(uuid,uuid,text,text,jsonb,text)','feature_one_finding_review(uuid,jsonb,uuid,jsonb,text)','feature_one_feedback_prune()','feature_one_job_provenance_context(uuid,uuid,uuid)','feature_one_job_provenance_store(uuid,uuid,uuid,jsonb)','feature_one_export_v8(uuid)']) assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') exposed', [role, `public.${fn}`])).rows[0].exposed, false);
      }
      await db.query('UPDATE feature_one_private.finding_reviewers SET active=false WHERE user_id=$1', [f.actor]); await assert.rejects(left.queue(f.actor, {}), { code: 'FORBIDDEN' });
      await db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]);
      assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.finding_feedback WHERE id=$1', [one!.id])).rows[0].n, 0);
      assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.finding_reviews WHERE feedback_id=$1', [one!.id])).rows[0].n, 0);
      assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.finding_feedback_requests WHERE user_id=$1', [f.actor])).rows[0].n, 0);
    } finally { await f.cleanup(); await a.end(); await b.end(); }
  });
  test('new provenance consumes actual bounded metadata and exclusions; SQL rejects forged counts, penalties, private text and silent replacement', async () => {
    const f = await rescanFixture(db, jobsRpc(db)), policy = narrativeExecutionPolicy(true); let captured: Record<string, unknown> | undefined;
    const diagnostic: string[] = [];
    const originalRpc = f.rpc.rpc;
    f.rpc.rpc = async (name, args) => {
      if (name === 'feature_one_job_provenance_store') {
        captured = args;
        for (const tamper of [(p: any) => { p.snapshots[0].history.records++; }, (p: any) => { p.snapshots[0].comment = 'PRIVATE_SOURCE'; }, (p: any) => { p.snapshots[0].contribution.confidence = .95; }, (p: any) => { p.snapshots[0].files.generatedExcluded++; }, (p: any) => { p.snapshots[0].signals.push('possible_bulk_initial_commit'); }]) {
          const value = structuredClone(args.p_result); tamper(value); const result = await originalRpc(name, { ...args, p_result: value }); diagnostic.push(result.error?.message ?? 'tamper accepted'); assert.equal(result.error?.message, 'ANALYSIS_VALIDATION_FAILED');
        }
      }
      const result = await originalRpc(name, args); if (result.error) diagnostic.push(`${name}: ${result.error.message}`); return result;
    };
    try {
      f.commits.set(f.bindings[0].repositoryId, 'b'.repeat(40)); Object.assign(f.files.get(f.bindings[0].repositoryId)!, { 'generated/output.ts': 'export const a=1', 'vendor/library.ts': 'export const b=2', 'scaffold.ts': '// auto-generated\nexport const scaffold=1;' });
      const started = await f.service.start(f.actor, f.baseline.report.reportId, { ...f.request(), includeMetadata: { commits: true, pullRequests: false, ci: false } }, policy, 5); if (started.state !== 'queued') throw new Error();
      const metadata = { async collect(_actor: string, pin: any, options: any) {
        const batch = emptyMetadata(pin.repositoryId, pin.commitSha, options);
        batch.groups[0] = { coverage: { source: 'commits', state: 'available', records: 3, exactCommitRecords: 1, retrievedAt: '2026-09-20T00:00:00Z' }, records: ['connected_identity','other_identity','unavailable'].map((match, i) => ({ objectId: String(i + 1), detail: providerDetail('commit', { retrievedAt: '2026-09-20T00:00:00Z', result: 'unknown', relationship: i ? 'ancestor' : 'exact_commit', subjectSha: i ? 'c'.repeat(40) : pin.commitSha, authorMatch: match as any, authorType: 'User' }, { parents: 1 }) })) }; return batch;
      } };
      await f.workerFor(policy, undefined, metadata).once(); const job = await f.jobs.read(f.actor, started.job.jobId); assert.equal(job.status, 'completed', JSON.stringify({ status: job.status, stage: job.stage, captured: !!captured, diagnostic })); if (job.status !== 'completed') throw new Error();
      const context = (await f.reader.view(f.actor, job.report.reportId)).aggregation!.provenance!.snapshots[0];
      assert.deepEqual([context.history.records, context.history.linkedToConnected, context.history.linkedToOthers, context.history.unlinked], [3,1,1,1]);
      assert.equal(context.files.generatedExcluded, 1); assert.equal(context.files.generatedMarked, 1); assert.equal(context.files.vendorExcluded, 1); assert.ok(context.signals.includes('multiple_linked_identities')); assert.equal(context.contribution.confidence, null);
      assert.ok(captured); await assert.rejects(db.query('UPDATE feature_one_private.analysis_provenance SET payload=payload WHERE job_id=$1', [started.job.jobId]), /IMMUTABLE/);
      await f.reader.remove(f.actor, job.report.reportId, randomUUID()); assert.equal((await f.evidence.exportUserData(f.actor)).provenance.length, 0);
    } finally { f.rpc.rpc = originalRpc; await f.cleanup(); }
  });
  test('worker selects the supported frozen policy of a queued job across provenance rollout and rollback', async () => {
    const f = await rescanFixture(db, jobsRpc(db)), seen: string[] = [];
    const worker = f.workerFor(claim => { seen.push(claim.policy.versions.aggregationPolicy.version); return narrativeExecutionPolicy(claim.policy.versions.aggregationPolicy.version === '1.1.0'); });
    try {
      for (const [version, sha] of [[false,'b'], [true,'c']] as const) {
        f.commits.set(f.bindings[0].repositoryId, sha.repeat(40)); const queued = await f.service.start(f.actor, f.baseline.report.reportId, f.request(), narrativeExecutionPolicy(version), 5); if (queued.state !== 'queued') throw new Error();
        await worker.once(); const job = await f.jobs.read(f.actor, queued.job.jobId); assert.equal(job.status, 'completed'); if (job.status !== 'completed') throw new Error();
        const view = await f.reader.view(f.actor, job.report.reportId); assert.equal(view.report.versions.aggregationPolicy.version, version ? '1.1.0' : '1.0.0'); assert.equal(!!view.aggregation?.provenance, version);
      }
      assert.deepEqual(seen, ['1.0.0','1.1.0']);
    } finally { await f.cleanup(); }
  });
}
