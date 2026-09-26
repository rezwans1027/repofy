import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { jobsRpc } from './jobs.cases';
import { coverageJobFixture } from '../helpers/coverage-job-fixture';
import { aggregationFiles, aggregationPolicy } from '../helpers/aggregation-fixtures';
import { AggregationRepository } from '../../src/domain/aggregation/repository';
import { aggregateEvidence } from '../../src/domain/aggregation/engine';
import { JobRepository } from '../../src/domain/jobs/repository';
import type { StageContext } from '../../src/domain/jobs/worker';
import { BOUNDED_AGGREGATION_POLICY, ROLE_AGGREGATION_POLICY } from '../../src/domain/aggregation/policy';
import { implementedRolePortfolio } from '../helpers/role-coverage-v3';
import { rolePortfolio } from '../helpers/role-portfolios';
import { ProvenanceService } from '../../src/domain/provenance/service';

export function registerAggregationTests(db: pg.Client, config: pg.ClientConfig) {
  for (const version of ['3.0.0', '3.1.0'] as const) test(`SQL persists all five role outcomes and rejects forged scope/corroboration under ${version}`, async () => {
    const files = { ...implementedRolePortfolio(), '.repofyignore': '', 'public/logo.png': '', '.env.example': 'PORT=3000' };
    const f = await coverageJobFixture(db, jobsRpc(db), files, { id: 'evidence_aggregation', version });
    try {
      const expected = { ...ROLE_AGGREGATION_POLICY, version, provenance: version === '3.1.0' ? 'context_only_v1' : 'not_inferred_v1' };
      assert.deepEqual((await db.query('SELECT definition FROM feature_one_private.aggregation_policies WHERE id=$1 AND version=$2', [expected.id,version])).rows[0].definition, expected);
      const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto), {runId} = await f.f.jobs.run(f.claim,[sid]);
      const context: StageContext = {claim:f.claim,runId,snapshotIds:[sid],signal:new AbortController().signal,checkpoint:()=>f.f.jobs.heartbeat(f.claim)};
      if(version==='3.1.0') await new ProvenanceService(f.f.jobs).collect(context);
      const args={p_job:f.claim.jobId,p_token:f.claim.token,p_run:runId};
      const result=aggregateEvidence(await f.f.jobs.call('aggregation_input',args));
      assert.ok(result.roles.every(r=>r.requirements.filter(q=>q.required).every(q=>q.state==='satisfied')));
      assert.deepEqual(result.validation,[]);
      for(const mutate of [
        (x:typeof result)=>{x.capabilities[0].trace.coverage[0].nonSourceExcludedFiles=0;},
        (x:typeof result)=>{x.capabilities[0].trace.coverage[0].excludedFiles=0;},
        (x:typeof result)=>{x.capabilities.find(c=>c.capabilityId==='frontend_interaction')!.confidenceLabel='high';},
        (x:typeof result)=>{const c=x.capabilities.find(c=>c.capabilityId==='testing_failures')!;const cl=c.trace.clusters.find(z=>z.clusterId===c.trace.selectedClusterId)!;cl.corroboration[0].evidenceId=cl.baseEvidenceId;},
        (x:typeof result)=>{const c=x.capabilities.find(c=>c.capabilityId==='testing_failures')!;const cl=c.trace.clusters.find(z=>z.clusterId===c.trace.selectedClusterId)!;cl.corroboration[0].evidenceId=x.capabilities.find(z=>z.capabilityId==='mobile_navigation')!.trace.clusters[0].corroboration[0].evidenceId;},
      ]) {
        const bad=structuredClone(result);mutate(bad);
        assert.ok((await jobsRpc(db).rpc('feature_one_job_aggregation_store',{...args,p_result:bad})).error);
        assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_aggregations WHERE run_id=$1',[runId])).rows[0].n,0);
      }
      const repository=new AggregationRepository(f.f.jobs);await repository.aggregate(context);
      assert.deepEqual(await repository.read(f.f.actor,runId),result);
    } finally {await f.cleanup();}
  });
  for (const version of ['2.0.0', '2.1.0'] as const) test(`SQL independently validates bounded confidence, scope and rubric thresholds under ${version}`, async () => {
    const f = await coverageJobFixture(db, jobsRpc(db), rolePortfolio(), { id: 'evidence_aggregation', version });
    try {
      const expected = { ...BOUNDED_AGGREGATION_POLICY, version, provenance: version === '2.1.0' ? 'context_only_v1' : 'not_inferred_v1' };
      assert.deepEqual((await db.query('SELECT definition FROM feature_one_private.aggregation_policies WHERE id=$1 AND version=$2', [expected.id,version])).rows[0].definition, expected);
      const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto), { runId } = await f.f.jobs.run(f.claim, [sid]);
      const context: StageContext = { claim: f.claim, runId, snapshotIds: [sid], signal: new AbortController().signal, checkpoint: () => f.f.jobs.heartbeat(f.claim) };
      if (version === '2.1.0') await new ProvenanceService(f.f.jobs).collect(context);
      const args = { p_job: f.claim.jobId, p_token: f.claim.token, p_run: runId };
      const result = aggregateEvidence(await f.f.jobs.call('aggregation_input', args));
      assert.equal(result.capabilities.find(c => c.capabilityId === 'reliability_recovery')!.confidenceLabel, 'moderate');
      assert.equal(result.roles.find(r => r.template.roleId === 'backend')!.requirements.find(r => r.requirementId === 'reliability_recovery')!.state, 'satisfied');
      for (const mutate of [
        (x: typeof result) => { x.capabilities.find(c => c.capabilityId === 'reliability_recovery')!.confidenceLabel = 'high'; },
        (x: typeof result) => { x.capabilities.find(c => c.capabilityId === 'reliability_recovery')!.trace.coverage[0].reasons = []; },
        (x: typeof result) => { x.capabilities.find(c => c.capabilityId === 'framework_presence')!.confidenceLabel = 'moderate'; },
        (x: typeof result) => { const q = x.roles[0].requirements.find(q => q.state !== 'satisfied')!; q.state = 'satisfied'; q.satisfaction = .65; q.weightedContribution = q.weight * .65; },
      ]) {
        const bad = structuredClone(result); mutate(bad);
        assert.ok((await jobsRpc(db).rpc('feature_one_job_aggregation_store', { ...args, p_result: bad })).error);
        assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_aggregations WHERE run_id=$1', [runId])).rows[0].n, 0);
      }
      const repository = new AggregationRepository(f.f.jobs);
      await repository.aggregate(context);
      assert.deepEqual(await repository.read(f.f.actor, runId), result);
    } finally { await f.cleanup(); }
  });
  test('deterministic aggregation is canonical under concurrent writes, privately readable, immutable and deletable', async () => {
    const a = new pg.Client(config), b = new pg.Client(config); await a.connect(); await b.connect();
    const f = await coverageJobFixture(db, jobsRpc(a), aggregationFiles, aggregationPolicy);
    try {
      const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto); const { runId } = await f.f.jobs.run(f.claim, [sid]);
      const context: StageContext = { claim: f.claim, runId, snapshotIds: [sid], signal: new AbortController().signal, checkpoint: () => f.f.jobs.heartbeat(f.claim) };
      const one = new AggregationRepository(f.f.jobs), two = new AggregationRepository(new JobRepository(jobsRpc(b)));
      await Promise.all([one.aggregate(context), two.aggregate(context)]);
      assert.deepEqual(await one.read(f.f.actor, runId), await two.read(f.f.actor, runId));
      assert.equal((await one.read(f.f.actor, runId))!.capabilities.find(c => c.capabilityId === 'performance_resources')!.strength, .65);
      assert.equal(await two.read(randomUUID(), runId), null);
      await assert.rejects(two.evidence(randomUUID(), runId), /NOT_FOUND/);
      await assert.rejects(db.query("UPDATE feature_one_private.analysis_aggregations SET payload='{}' WHERE run_id=$1", [runId]), /IMMUTABLE_CONTENT/);
      await db.query('SET ROLE authenticated');
      try {
        await assert.rejects(db.query('SELECT * FROM feature_one_private.analysis_aggregations'), /permission denied/);
        await assert.rejects(db.query('SELECT public.feature_one_job_aggregation_read($1,$2)', [f.f.actor, runId]), /permission denied/);
      } finally { await db.query('RESET ROLE'); }
      const page = await one.evidence(f.f.actor, runId, { roleId: 'backend', requirementId: 'performance_resources', limit: 1 });
      assert.equal(page.items.length, 1); assert.ok(page.nextEvidenceId);
      assert.equal((await f.f.evidence.exportUserData(f.f.actor)).aggregations.length, 1);
      await f.f.jobs.cancel(f.f.actor, f.job.jobId, randomUUID()); await f.f.jobs.delete(f.f.actor, f.job.jobId, randomUUID());
      assert.equal(await one.read(f.f.actor, runId), null);
    } finally { await f.cleanup(); await a.end(); await b.end(); }
  });
  test('SQL rejects actual foreign evidence, inflated confidence and waived requirement minima with rollback', async () => {
    const f = await coverageJobFixture(db, jobsRpc(db), aggregationFiles, aggregationPolicy);
    const foreign = await coverageJobFixture(db, jobsRpc(db), aggregationFiles, aggregationPolicy);
    try {
      await foreign.f.jobs.storeSnapshot(foreign.claim, foreign.bundle, foreign.f.crypto);
      const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto); const { runId } = await f.f.jobs.run(f.claim, [sid]);
      const args = { p_job: f.claim.jobId, p_token: f.claim.token, p_run: runId };
      const result = aggregateEvidence(await f.f.jobs.call('aggregation_input', args));
      for (const mutate of [
        (x: any) => x.capabilities.find((c: any) => c.state === 'assessed').support[0].evidenceId = foreign.bundle.evidence[0].evidenceId,
        (x: any) => { const c = x.capabilities.find((c: any) => c.state === 'assessed'); c.confidence = .55; c.confidenceLabel = 'high'; },
        (x: any) => { const c = x.capabilities.find((c: any) => c.state === 'assessed'); c.allowedClaimScopes = ['tested_behavior']; },
        (x: any) => { const q = x.roles[0].requirements.find((q: any) => q.state !== 'satisfied'); q.state = 'satisfied'; q.satisfaction = .65; q.strength = .65; q.weightedContribution = q.weight * .65; },
      ]) {
        const bad = structuredClone(result); mutate(bad);
        assert.ok((await jobsRpc(db).rpc('feature_one_job_aggregation_store', { ...args, p_result: bad })).error);
        assert.equal((await db.query('SELECT count(*)::int n FROM feature_one_private.analysis_aggregations WHERE run_id=$1', [runId])).rows[0].n, 0);
      }
    } finally { await f.cleanup(); await foreign.cleanup(); }
  });
  test('aggregation cannot read or write through an expired worker lease or canceled run', async () => {
    const f = await coverageJobFixture(db, jobsRpc(db), aggregationFiles, aggregationPolicy);
    try {
      const sid = await f.f.jobs.storeSnapshot(f.claim, f.bundle, f.f.crypto); const { runId } = await f.f.jobs.run(f.claim, [sid]);
      const args = { p_job: f.claim.jobId, p_token: f.claim.token, p_run: runId };
      const result = aggregateEvidence(await f.f.jobs.call('aggregation_input', args));
      await db.query("UPDATE feature_one_private.analysis_execution SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1", [f.claim.jobId]);
      assert.equal((await jobsRpc(db).rpc('feature_one_job_aggregation_input', args)).error?.message, 'LEASE_LOST');
      assert.equal((await jobsRpc(db).rpc('feature_one_job_aggregation_store', { ...args, p_result: result })).error?.message, 'LEASE_LOST');
      await f.f.jobs.cancel(f.f.actor, f.job.jobId, randomUUID());
      assert.equal((await jobsRpc(db).rpc('feature_one_job_aggregation_store', { ...args, p_result: result })).error?.message, 'LEASE_LOST');
    } finally { await f.cleanup(); }
  });
}
