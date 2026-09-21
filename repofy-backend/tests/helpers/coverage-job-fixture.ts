import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedAnalysisFixture } from './job-fixtures';
import { archiveFixture } from './ingestion-fixtures';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService, type SafeSnapshotContext } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { structuralSecurityPolicy, policyHash } from '../../src/domain/ingestion/policy';
import { coverageProfile } from '../../src/domain/coverage/manifest';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { createCoverageExtraction } from '../../src/domain/extraction/pipeline';
import type { FeatureOneRpcClient } from '../../src/domain/analysis/persistence';

export async function coverageJobFixture(db: Parameters<typeof seedAnalysisFixture>[0], rpc: FeatureOneRpcClient, files: Record<string, string>, aggregationPolicy?: { id: string; version: string }, narrative = false) {
  const f = await seedAnalysisFixture(db, rpc); const root = await mkdtemp(join(tmpdir(), 'repofy-coverage-job-')); let context: SafeSnapshotContext | undefined;
  const cleanup = async () => { await context?.dispose(); await db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]); await rm(root, { recursive: true, force: true }); };
  try {
    const profile = coverageProfile(); const security = structuralSecurityPolicy(); f.policy.security = security;
    Object.assign(f.policy.versions, { extractorBundle: profile.extractorBundle, detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest, ingestionPolicyHash: policyHash(security),
      taxonomy: { id: initialRubricCatalog.taxonomy.id, version: initialRubricCatalog.taxonomy.version }, roleRubrics: initialRubricCatalog.rubrics.map(r => ({ roleId: r.roleId, version: r.version })) });
    if (aggregationPolicy) f.policy.versions.aggregationPolicy = aggregationPolicy;
    if (narrative) {
      const { synthesisVersion } = await import('../../src/domain/synthesis/policy');
      f.policy.versions.synthesis = synthesisVersion();
      f.policy.versions.disclosurePolicy = { id: 'candidate_private', version: '1.0.0' };
    }
    const job = await f.jobs.start(f.actor, f.body, f.policy, 5, randomUUID()); const claim = (await f.jobs.claim())!;
    if (claim.jobId !== job.jobId) throw new Error('Unexpected fixture claim');
    const ingestion = new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(claim), f.crypto), {
      async resolve(_request, access) { return { providerRepositoryId: access.providerRepositoryId, repositoryVisibility: access.repositoryVisibility, branch: 'main', commitSha: 'a'.repeat(40) }; },
      async download(_request, _pin, path, signal, checkpoint) { await checkpoint(); signal.throwIfAborted(); await writeFile(path,
        archiveFixture(Object.entries(files).map(([path, body]) => ({ path: `fixture-root/${path}`, body }))), { flag: 'wx', mode: 0o600 }); },
    }, f.crypto, new WorkspaceManager(root), security);
    const request = { actor: f.actor, jobId: job.jobId, repositoryId: f.bindings[0].repositoryId };
    const pin = await ingestion.resolveSnapshot(request); context = await ingestion.prepareSafeSnapshot(request);
    const bundle = await createCoverageExtraction(f.crypto).extract(context, claim, new AbortController().signal, pin);
    return { f, job, claim, bundle, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
