import { randomUUID } from 'node:crypto';
import { aggregateEvidence } from '../../src/domain/aggregation/engine';
import { prepareNarrative, type PreparedNarrative } from '../../src/domain/synthesis/narrative';
import { synthesisVersion } from '../../src/domain/synthesis/policy';
import { extractedAggregation, aggregationFiles, aggregationPolicy } from './aggregation-fixtures';
import { coverageJobFixture } from './coverage-job-fixture';
import { AggregationRepository } from '../../src/domain/aggregation/repository';
import type { StageContext } from '../../src/domain/jobs/worker';
import type { ModelGateway } from '../../src/domain/synthesis/gateway';
export function selection(input: PreparedNarrative['input']) {
  return { schemaVersion: '1.0.0', explanations: input.explanations.map(e => ({ capabilityId: e.capabilityId, statementId: e.statementId, evidenceIds: e.evidenceIds, style: 'observation_first' })),
    improvements: input.gaps.map(g => ({ gapId: g.gapId, templateId: g.templates[0].templateId, focus: 'proof' })) };
}
export const syntheticGateway: ModelGateway = { async generate(input) { return { selection: selection(input), usage: { code: 'valid', inputTokens: 1000, outputTokens: 1000, latencyMs: 1 } }; } };
export async function narrativeFixture(files: Record<string,string> = aggregationFiles) {
  const { input,bundle } = await extractedAggregation(files);
  input.versions.synthesis = synthesisVersion(); input.versions.disclosurePolicy = { id: 'candidate_private', version: '1.0.0' };
  const aggregation = aggregateEvidence(input);
  const { providerRepositoryId: _p, branch: _b, ...snapshot } = bundle.snapshot;
  const evidence = bundle.evidence.map(({ locator: _l,locatorId: _i,fingerprint: _f,...e }) => e);
  const p = prepareNarrative({ aggregation, snapshots: [{ ...snapshot,repositoryLabel: 'Repository' }], coverage: [bundle.coverage], evidence, createdAt: new Date().toISOString() });
  return { p, selection: selection(p.input), modelRunId: randomUUID() };
}
export async function narrativeJobFixture(db: Parameters<typeof coverageJobFixture>[0],rpc: Parameters<typeof coverageJobFixture>[1],files: Record<string,string> = aggregationFiles) {
  const f = await coverageJobFixture(db,rpc,files,aggregationPolicy,true);
  const sid = await f.f.jobs.storeSnapshot(f.claim,f.bundle,f.f.crypto), { runId } = await f.f.jobs.run(f.claim,[sid]);
  const context: StageContext = { claim: f.claim,runId,snapshotIds:[sid],signal: new AbortController().signal,checkpoint:()=>f.f.jobs.heartbeat(f.claim) };
  await f.f.jobs.stage(f.claim,'aggregating'); await new AggregationRepository(f.f.jobs).aggregate(context);
  await f.f.jobs.stage(f.claim,'synthesizing');
  const hash='sha256:'+'1'.repeat(64); await f.f.jobs.synthesis(f.claim,hash);
  return { ...f,context,hash };
}
