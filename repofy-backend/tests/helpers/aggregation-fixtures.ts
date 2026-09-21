import { randomUUID } from 'node:crypto';
import { AggregationInputSchema } from '../../src/domain/aggregation/input';
import type { SnapshotBundle } from '../../src/domain/analysis/persistence';
import { coverageFixture } from './coverage-fixtures';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { AGGREGATION_POLICY } from '../../src/domain/aggregation/policy';
import { service } from '../fixtures/evidence/implementation';

export const aggregationPolicy = { id: AGGREGATION_POLICY.id, version: AGGREGATION_POLICY.version };
export const aggregationFiles = {
  'service.ts': service,
  'retry.ts': `import {work} from './service'; export async function retry(){for(let n=0;n<3;n++){try{return await work();}catch{}}}`,
  'retry.test.ts': `import {test,expect} from 'vitest';import {retry} from './retry';test('bounds work',async()=>{expect(await retry()).toBe(1);});`,
  'package.json': '{"dependencies":{"express":"4.21.2"},"devDependencies":{"vitest":"4.0.0"}}',
};
export function aggregationInput(bundles: SnapshotBundle[]) {
  return AggregationInputSchema.parse({ runId: randomUUID(), jobId: randomUUID(), ownerUserId: randomUUID(),
    versions: { ...bundles[0].versions, aggregationPolicy }, catalog: initialRubricCatalog,
    snapshots: bundles.map(b => ({ snapshotId: b.snapshot.snapshotId, repositoryId: b.snapshot.repositoryId, commitSha: b.snapshot.commitSha,
      repositoryVisibility: b.snapshot.repositoryVisibility, coverage: b.coverage, files: b.files.map(f => ({ fileId: f.locatorId,
        lines: f.structure?.lines ?? 0, analyzed: f.analyzed, classification: f.classification, ...(f.structure?.coverage ? { outcome: f.structure.coverage } : {}) })) })),
    evidence: bundles.flatMap(b => b.evidence.map(({ locator, locatorId: _id, fingerprint, ...observation }) => ({ observation,
      fileId: locator.kind === 'file' ? b.files.find(f => f.locator.kind === 'file' && f.locator.path === locator.path)!.locatorId : null,
      contentFingerprint: fingerprint.digest }))),
  });
}
export async function extractedAggregation(files: Record<string, string> = aggregationFiles) {
  const f = await coverageFixture(files);
  try { const { bundle } = await f.extract(); return { input: aggregationInput([bundle]), bundle }; }
  finally { await f.cleanup(); }
}
