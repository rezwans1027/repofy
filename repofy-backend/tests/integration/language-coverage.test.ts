import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { selectionDatabase } from '../helpers/selection-db';
import { seedAnalysisFixture, seedJobRubrics } from '../helpers/job-fixtures';
import { coverageFixture } from '../helpers/coverage-fixtures';
import { implementationRepository } from '../helpers/implementation-fixtures';
import { pythonSource, javaSource, pom } from '../fixtures/evidence/language-coverage';
import { coverageDeclaration } from '../../src/domain/coverage/manifest';
import { coverageJobFixture } from '../helpers/coverage-job-fixture';
import { EvidenceRepository, type FeatureOneRpcClient, type SnapshotBundle } from '../../src/domain/analysis/persistence';

let db: Awaited<ReturnType<typeof selectionDatabase>>;
beforeAll(async () => { db = await selectionDatabase(); await seedJobRubrics(db.db); }, 20000);
afterAll(async () => { await db?.db.close(); });
// Rebind only fixture identity. Extraction still uses the actual safe context and current policy.
function rebind(bundle: SnapshotBundle, f: Awaited<ReturnType<typeof seedAnalysisFixture>>) {
  bundle.snapshot.repositoryId = f.bindings[0].repositoryId;
  bundle.snapshot.providerRepositoryId = f.bundles[0].snapshot.providerRepositoryId;
  bundle.snapshot.repositoryVisibility = 'public';
  for (const e of bundle.evidence) { e.repositoryId = bundle.snapshot.repositoryId; e.repositoryVisibility = 'public'; }
}
it('seals new coverage with exact declaration, source counts and capability states; preserves owner-only access and deletion', async () => {
  const fixture = await coverageJobFixture(db.db, db.rpc, { ...implementationRepository(), 'app.py': pythonSource, 'Calculator.java': javaSource, 'pom.xml': pom, 'bad.swift': 'struct App {}' });
  const { f, bundle, job, claim } = fixture;
  try {
    const sid = await f.jobs.storeSnapshot(claim, bundle, f.crypto);
    expect((await f.jobs.read(f.actor, job.jobId)).coverage).toEqual([bundle.coverage]);
    await expect(f.jobs.read(randomUUID(), job.jobId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await f.jobs.list(randomUUID()))).toEqual([]);
    const declaration = coverageDeclaration();
    const rows = await db.db.query<{ declaration: unknown }>('SELECT declaration FROM feature_one_private.analyzer_coverage_manifests WHERE version=$1', [declaration.version]);
    expect(rows.rows[0].declaration).toEqual(declaration);
    await expect(db.db.query("UPDATE feature_one_private.analyzer_coverage_manifests SET declaration='{}'")).rejects.toThrow('IMMUTABLE_CONTENT');
    expect(JSON.stringify(await f.evidence.exportUserData(f.actor))).not.toMatch(/def calculate|class Calculator|locator_encrypted|content_fingerprint/);
    await f.jobs.cancel(f.actor, job.jobId, randomUUID());
    await f.jobs.delete(f.actor, job.jobId, randomUUID());
    expect((await db.db.query('SELECT id FROM public.repository_snapshots WHERE id=$1', [sid])).rows).toHaveLength(0);
  } finally { await fixture.cleanup(); }
}, 20000);
it('rejects raw SQL coverage inflation, unknown reasons and declaration changes with complete rollback', async () => {
  const f = await seedAnalysisFixture(db.db, db.rpc); const fixture = await coverageFixture({ 'app.py': pythonSource, 'pom.xml': pom });
  try {
    const { bundle } = await fixture.extract(); rebind(bundle, f); let submitted: any;
    const capture: FeatureOneRpcClient = { async rpc(_name, args) { submitted = structuredClone(args); return { data: bundle.snapshot.snapshotId, error: null }; } };
    await new EvidenceRepository(capture).storeSnapshot(f.actor, f.bindings[0].grantId, bundle, f.crypto);
    for (const change of [
      (b: any) => b.coverage.assessment.counts.analyzedFiles++,
      (b: any) => b.coverage.assessment.declaration.entries[0].confidenceCeiling = 1,
      (b: any) => b.coverage.assessment.capabilities.at(-1).state = 'assessable',
      (b: any) => b.coverage.assessment.capabilities[0].observations++,
      (b: any) => b.coverage.assessment.reasons.push('private parser detail'),
      (b: any) => b.coverage.assessment.languages[0].implementationAnalyzedFiles++,
      (b: any) => delete b.coverage.assessment,
    ]) {
      const bad = structuredClone(submitted); change(bad.p_bundle);
      const result = await db.rpc.rpc('feature_one_store_snapshot', bad); expect(result.error?.message).toBe('INCOMPLETE_ANALYSIS');
      expect((await db.db.query('SELECT id FROM public.repository_snapshots WHERE id=$1', [bundle.snapshot.snapshotId])).rows).toHaveLength(0);
    }
    const valid = await db.rpc.rpc('feature_one_store_snapshot', submitted); expect(valid.error).toBeNull();
  } finally { await fixture.cleanup(); await db.db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]); }
});
it('persists parser quarantine variants and empty/unsupported outcomes without retroactive evidence', async () => {
  const f = await seedAnalysisFixture(db.db, db.rpc);
  for (const disabled of [[], ['python'], ['java', 'maven']] as const) {
    const fixture = await coverageFixture({ 'app.py': pythonSource, 'large.py': ' '.repeat(262145), 'Calculator.java': javaSource, 'pom.xml': pom }, disabled);
    try { const { bundle } = await fixture.extract(); rebind(bundle, f); await f.evidence.storeSnapshot(f.actor, f.bindings[0].grantId, bundle, f.crypto); }
    finally { await fixture.cleanup(); }
  }
  for (const files of [{}, { 'app.swift': 'struct App {}' }]) {
    const fixture = await coverageFixture(files);
    try { const { bundle } = await fixture.extract(); rebind(bundle, f); expect(bundle.coverage.assessment!.result).toBe('insufficient_evidence');
      await f.evidence.storeSnapshot(f.actor, f.bindings[0].grantId, bundle, f.crypto); }
    finally { await fixture.cleanup(); }
  }
  await db.db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]);
});
