import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedAnalysisFixture } from './job-fixtures';
import { aggregationFiles } from './aggregation-fixtures';
import { archiveFixture } from './ingestion-fixtures';
import { syntheticGateway } from './narrative-fixtures';
import { narrativeExecutionPolicy } from '../../src/domain/synthesis/composition';
import { NarrativeService } from '../../src/domain/synthesis/service';
import { AnalysisWorker } from '../../src/domain/jobs/worker';
import { createCoverageExtraction } from '../../src/domain/extraction/pipeline';
import { createAggregation } from '../../src/domain/aggregation/repository';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { ReadinessReader } from '../../src/domain/readiness/reader';
import { RescanService } from '../../src/domain/rescans/service';
import type { SnapshotSource } from '../../src/domain/ingestion/source';
import type { FeatureOneRpcClient } from '../../src/domain/analysis/persistence';
import { ProvenanceService } from '../../src/domain/provenance/service';
import type { ExecutionPolicy } from '../../src/domain/jobs/policy';
import type { GitHubConnectionService } from '../../src/domain/github-app/service';
import type { Claim } from '../../src/domain/jobs/repository';

export async function rescanFixture(db: Parameters<typeof seedAnalysisFixture>[0], rpc: FeatureOneRpcClient, count = 1) {
  const f = await seedAnalysisFixture(db, rpc, count), policy = narrativeExecutionPolicy(), root = await mkdtemp(join(tmpdir(), 'repofy-rescan-test-'));
  const commits = new Map(f.bindings.map(b => [b.repositoryId, 'a'.repeat(40)]));
  const initial = { ...aggregationFiles }; delete (initial as Partial<typeof initial>)['retry.test.ts'];
  const files = new Map(f.bindings.map(b => [b.repositoryId, { ...initial } as Record<string, string>]));
  const counters = { downloads: 0, models: 0, extracts: 0, resolves: 0 };
  const source: SnapshotSource = {
    async resolve(request, access) { counters.resolves++; return { providerRepositoryId: access.providerRepositoryId, repositoryVisibility: access.repositoryVisibility, branch: 'main', commitSha: commits.get(request.repositoryId)! }; },
    async download(request, pin, path, signal, checkpoint) {
      await checkpoint(); signal.throwIfAborted(); counters.downloads++;
      if (pin.commitSha !== commits.get(request.repositoryId)) throw new Error('Fixture archive SHA mismatch');
      await writeFile(path, archiveFixture(Object.entries(files.get(request.repositoryId)!).map(([path, body]) => ({ path: `fixture-root/${path}`, body }))), { mode: 0o600, flag: 'wx' });
    },
  };
  const narrative = new NarrativeService(f.jobs, { async generate(...args) { counters.models++; return syntheticGateway.generate(...args); } });
  const workerFor = (policy: ExecutionPolicy | ((claim: Claim) => ExecutionPolicy), provider?: Pick<GitHubConnectionService, 'verifyRepository'>, metadata?: Parameters<typeof createCoverageExtraction>[1]) => new AnalysisWorker(f.jobs, claim => ({ policy: typeof policy === 'function' ? policy(claim) : policy,
    extract: async (...args) => { counters.extracts++; return createCoverageExtraction(f.crypto, metadata).extract(...args); },
    aggregate: createAggregation(f.jobs, new ProvenanceService(f.jobs, provider)).aggregate, synthesize: c => narrative.synthesize(c), validate: (r, c) => narrative.validate(r, c) }),
    c => new SnapshotIngestionService(new IngestionRepository(f.jobs.ingestionClient(c), f.crypto), source, f.crypto, new WorkspaceManager(root), c.policy.security), () => f.crypto);
  const worker = workerFor(policy);
  const reader = new ReadinessReader(rpc, () => f.crypto, { async verifyRepository() { throw new Error('No locator lookup in rescan fixture'); } });
  const service = new RescanService(rpc, reader, source, () => f.crypto);
  const cleanup = async () => { await db.query('DELETE FROM auth.users WHERE id=$1', [f.actor]); await rm(root, { recursive: true, force: true }); };
  try {
    const job = await f.jobs.start(f.actor, f.body, policy, 5, randomUUID()); await worker.once();
    const done = await f.jobs.read(f.actor, job.jobId); if (done.status !== 'completed') throw new Error(`Fixture baseline: ${JSON.stringify(done)}`);
    const baseline = await reader.view(f.actor, done.report.reportId);
    return { ...f, rpc, policy, worker, workerFor, reader, service, source, baseline, files, commits, counters, cleanup,
      request: () => ({ repositoryIds: f.bindings.map(b => b.repositoryId), idempotencyKey: randomUUID() }) };
  } catch (error) { await cleanup(); throw error; }
}
