import { test } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { AnalyzerCoverageSchema } from '@repofy/contracts';
import { jobsRpc } from './jobs.cases';
import { coverageJobFixture } from '../helpers/coverage-job-fixture';
import { detectorCases, service } from '../fixtures/evidence/implementation';
import { EvidenceRepository, type FeatureOneRpcClient } from '../../src/domain/analysis/persistence';

const files = { 'service.ts': service, 'route.ts': detectorCases.find(c => c.kind === 'request_validation')!.positive,
  'schema.prisma': 'model Person {\n id Int @id\n}\n' };
async function captured(fixture: Awaited<ReturnType<typeof coverageJobFixture>>) {
  let args: any;
  const capture: FeatureOneRpcClient = { async rpc(_name, input) { args = structuredClone(input); return { data: fixture.bundle.snapshot.snapshotId, error: null }; } };
  await new EvidenceRepository(capture).storeSnapshot(fixture.f.actor, fixture.f.bindings[0].grantId, fixture.bundle, fixture.f.crypto);
  return args;
}
function legacy(bundle: any, declaration: unknown, version: '1.0.0' | '1.0.1' | '1.0.2' | '1.0.3' | '1.0.4' | '1.0.5') {
  const structuralVersion = version === '1.0.0' ? '1.0.0' : '1.0.1';
  bundle.snapshot.extractionPolicyVersion = bundle.versions.extractorBundle.version = bundle.inventorySummary.extractorBundle.version = structuralVersion;
  bundle.versions.detectorBundle.version = bundle.coverage.detectorBundle.version = bundle.coverage.implementation.bundle.version = version;
  bundle.versions.coverageManifest = bundle.coverage.manifestVersion = version === '1.0.0' ? '1.2.0' : '1.2.1';
  bundle.coverage.assessment.declaration = declaration;
  bundle.coverage.implementation.detectors.forEach((d: any) => { d.version = version; });
  bundle.evidence.forEach(({ observation: e }: any) => { e.detector.version = e.implementation ? version : e.structural?.kind === 'schema' ? structuralVersion : '1.0.0'; });
}
export function registerAnalyzerVersionTests(db: pg.Client) {
  test('analyzer corrections append immutable definitions and preserve every legacy coverage declaration', async () => {
    const detectors = await db.query('SELECT bundle_version,count(*)::int n FROM feature_one_private.implementation_detectors GROUP BY bundle_version ORDER BY bundle_version');
    assert.deepEqual(detectors.rows, [{ bundle_version: '1.0.0', n: 16 }, { bundle_version: '1.0.1', n: 16 }, { bundle_version: '1.0.2', n: 16 }, { bundle_version: '1.0.3', n: 16 }, { bundle_version: '1.0.4', n: 16 }, { bundle_version: '1.0.5', n: 16 }, { bundle_version: '1.0.6', n: 16 }]);
    const manifests = await db.query("SELECT old.declaration AS old, corrected.declaration AS corrected FROM feature_one_private.analyzer_coverage_manifests old JOIN feature_one_private.analyzer_coverage_manifests corrected ON corrected.version='1.2.1'||substring(old.version from 6) WHERE split_part(old.version,'-',1)='1.2.0'");
    assert.equal(manifests.rowCount, 8);
    for (const row of manifests.rows) assert.deepEqual(row.corrected, { ...row.old, version: row.old.version.replace('1.2.0', '1.2.1') });
    await assert.rejects(db.query("UPDATE feature_one_private.implementation_detectors SET maximum_strength=0.6 WHERE bundle_version='1.0.0'"), /IMMUTABLE_CONTENT/);
    await assert.rejects(db.query("UPDATE feature_one_private.analyzer_coverage_manifests SET declaration='{}' WHERE version='1.2.0'"), /IMMUTABLE_CONTENT/);
  });
  test('corrected snapshots reject mixed detector, schema, extractor and manifest versions with full rollback', async () => {
    const fixture = await coverageJobFixture(db, jobsRpc(db), files);
    try {
      const args = await captured(fixture);
      for (const [mutate, code] of [
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.0'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.1'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.2'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.3'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.4'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.implementation).observation.detector.version = '1.0.5'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.evidence.find((e: any) => e.observation.structural?.kind === 'schema').observation.detector.version = '1.0.0'; }, 'UNSUPPORTED_CLAIM'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.0'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.1'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.2'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.3'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.4'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.implementation.detectors[0].version = '1.0.5'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.coverage.manifestVersion = b.versions.coverageManifest = b.coverage.assessment.declaration.version = '1.2.0'; }, 'INCOMPLETE_ANALYSIS'],
        [(b: any) => { b.versions.extractorBundle.version = b.inventorySummary.extractorBundle.version = b.snapshot.extractionPolicyVersion = '1.0.0';
          b.evidence.find((e: any) => e.observation.structural?.kind === 'schema').observation.detector.version = '1.0.0'; }, 'INCOMPLETE_ANALYSIS'],
      ] as const) {
        const mixed = structuredClone(args); mutate(mixed.p_bundle);
        assert.equal((await jobsRpc(db).rpc('feature_one_store_snapshot', mixed)).error?.message, code);
        assert.equal((await db.query('SELECT count(*)::int n FROM public.repository_snapshots WHERE id=$1', [fixture.bundle.snapshot.snapshotId])).rows[0].n, 0);
      }
      assert.equal((await jobsRpc(db).rpc('feature_one_store_snapshot', args)).error, null);
      const stored = (await db.query('SELECT coverage FROM public.repository_snapshots WHERE id=$1', [fixture.bundle.snapshot.snapshotId])).rows[0].coverage;
      assert.equal(AnalyzerCoverageSchema.parse(stored).manifestVersion, '1.2.1');
    } finally { await fixture.cleanup(); }
  });
  for (const version of ['1.0.0', '1.0.1', '1.0.2', '1.0.3', '1.0.4', '1.0.5'] as const) test(`${version} snapshot and evidence remain readable while rejecting mismatched rows`, async () => {
    const fixture = await coverageJobFixture(db, jobsRpc(db), files);
    try {
      const args = await captured(fixture);
      const coverage = version === '1.0.0' ? '1.2.0' : '1.2.1';
      const declaration = (await db.query('SELECT declaration FROM feature_one_private.analyzer_coverage_manifests WHERE version=$1', [coverage])).rows[0].declaration;
      legacy(args.p_bundle, declaration, version);
      for (const kind of ['implementation', 'schema']) {
        const mixed = structuredClone(args);
        const observation = mixed.p_bundle.evidence.find((e: any) => kind === 'implementation' ? e.observation.implementation : e.observation.structural?.kind === 'schema').observation;
        observation.detector.version = kind === 'implementation' ? '1.0.6' : version === '1.0.0' ? '1.0.1' : '1.0.0';
        assert.equal((await jobsRpc(db).rpc('feature_one_store_snapshot', mixed)).error?.message, 'UNSUPPORTED_CLAIM');
      }
      assert.equal((await jobsRpc(db).rpc('feature_one_store_snapshot', args)).error, null);
      const stored = (await db.query('SELECT coverage FROM public.repository_snapshots WHERE id=$1', [fixture.bundle.snapshot.snapshotId])).rows[0].coverage;
      assert.equal(AnalyzerCoverageSchema.parse(stored).manifestVersion, coverage);
      assert.ok((await fixture.f.evidence.exportUserData(fixture.f.actor)).evidence.length > 0);
    } finally { await fixture.cleanup(); }
  });
}
