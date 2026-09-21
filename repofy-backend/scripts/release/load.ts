// Local-only real HTTP/PostgreSQL/worker measurement. The child owns a random
// disposable database; identity, GitHub and model transports are synthetic.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, arch, totalmem } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { quantile, proportion } from './metrics';
import { readCorpus } from './benchmark';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), origin = 'http://127.0.0.1:3191';
const elapsed = (start: number) => Math.round((performance.now() - start) * 100) / 100;
async function main() {
  // Never attach to an existing app, even if its port happens to match.
  let occupied = false;
  try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch { /* No listener. */ }
  assert.equal(occupied, false, 'Port 3191 is occupied; stop the other local harness first');
  const child = spawn(process.execPath, ['scripts/db/test-postgres.mjs', '--readiness-e2e'], { cwd: backend,
    env: { PATH: process.env.PATH, LC_ALL: 'C', NODE_ENV: 'test', ...(process.env.PG_BINDIR ? { PG_BINDIR: process.env.PG_BINDIR } : {}),
      ...(process.env.TEST_PG_ADMIN_URL ? { TEST_PG_ADMIN_URL: process.env.TEST_PG_ADMIN_URL } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = ''; const capture = (b: Buffer) => { diagnostics = (diagnostics + b.toString()).slice(-8000); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  const exited = new Promise<number | null>((done, fail) => { child.once('error', fail); child.once('exit', done); });
  const samples: Record<string, number[]> = {}; const jobs: any[] = []; const cleanupChecks: number[] = []; let token = '';
  async function call(route: string, data?: unknown, category?: string, expected = 200, actorToken = token): Promise<any> {
    const start = performance.now();
    const response = await fetch(`${origin}${route}`, { method: data === undefined ? 'GET' : 'POST',
      headers: { ...(actorToken ? { Authorization: `Bearer ${actorToken}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(60000) });
    const body = await response.json() as Record<string, any>;
    if (category) (samples[category] ??= []).push(elapsed(start));
    assert.equal(response.status, expected, `Synthetic ${category ?? 'setup'} HTTP status; code=${body.code ?? 'none'}`);
    return route.startsWith('/__test/') ? body : body.data;
  }
  try {
    const deadline = Date.now() + 60000;
    while (true) {
      if (child.exitCode !== null) throw new Error('Disposable server exited before startup');
      try { const response = await fetch(`${origin}/api/v1/capabilities`, { signal: AbortSignal.timeout(1000) }); if (response.ok) break; } catch { /* Startup. */ }
      assert.ok(Date.now() < deadline, 'Disposable server startup deadline'); await delay(100);
    }
    token = (await call('/__test/session')).token;
    await call('/__test/release-repositories', {});
    await call('/__test/controls', { provenance: true, feedback: true });
    const account = (await call('/api/v1/github/accounts')).accounts[0];
    const installation = (await call(`/api/v1/github/installations?accountId=${account.accountId}`)).installations[0];
    const repositories = (await call(`/api/v1/repositories?accountId=${account.accountId}&installationId=${installation.installationId}`)).repositories;
    assert.equal(repositories.length, 5);
    const prior = await call('/api/v1/repository-selections');
    await call('/api/v1/repository-selections', { repositories: repositories.map((r: any) => ({ repositoryId: r.repositoryId, accountId: r.accountId, installationId: r.installationId })),
      expectedRevision: prior.revision, idempotencyKey: randomUUID(), attestation: { version: '1.0.0', accepted: true } }, 'save_selection');
    async function configure(ids: string[]) {
      for (const [i, scenarioId] of ids.entries()) await call('/__test/workload', { repositoryId: repositories[i].repositoryId, scenarioId });
      return repositories.slice(0, ids.length).map((r: any) => r.repositoryId);
    }
    async function submit(ids: string[], duplicate = false) {
      const body = { contractVersion: '1.0.0', repositoryIds: ids, idempotencyKey: randomUUID() };
      const responses = await Promise.all(Array.from({ length: duplicate ? 2 : 1 }, () => call('/api/v1/analyses', body, 'start', 202)));
      assert.ok(responses.every(job => job.jobId === responses[0].jobId), 'Duplicate starts created separate jobs');
      return responses[0];
    }
    async function finish(initial: any, scenario: string, expectedStatus = 'completed') {
      let job = initial; const deadline = Date.now() + 180000;
      while (job.status === 'queued' || job.status === 'running') {
        assert.ok(Date.now() < deadline, 'Synthetic job deadline'); await delay(30);
        job = await call(`/api/v1/analyses/${initial.jobId}`, undefined, 'job_read');
      }
      assert.equal(job.status, expectedStatus, `${scenario}: ${job.failureCode ?? job.status}`);
      const measured = { scenario, jobId: job.jobId, status: job.status, failureCode: job.failureCode ?? null,
        queueMs: Date.parse(job.attempt.startedAt) - Date.parse(job.createdAt),
        processingMs: Date.parse(job.finishedAt) - Date.parse(job.attempt.startedAt),
        totalMs: Date.parse(job.finishedAt) - Date.parse(job.createdAt), reportId: job.report?.reportId };
      jobs.push(measured); return job;
    }
    async function checkCleanup(finishedAt: string) {
      assert.equal((await call('/__test/state')).workspaceFiles, 0, 'Terminal workload retained raw workspace');
      cleanupChecks.push(Math.max(0, Date.now() - Date.parse(finishedAt)));
    }
    const workloads = [
      ['backend_parse'], ['frontend_request'], ['model_adapter'], ['dependency_only'], ['python_baseline'], ['java_baseline'],
      ['mobile_native_unknown'], ['empty_unknown'], ['private_sentinels'],
      ['backend_parse','python_baseline','java_baseline','frontend_request','model_adapter'],
    ];
    let reportId = '';
    for (const [i, workload] of workloads.entries()) {
      const ids = await configure(workload); const initial = await submit(ids, i === 0);
      const job = await finish(initial, workload.join('+')); reportId = job.report.reportId;
      const view = await call(`/api/v1/readiness-reports/${reportId}/view`, undefined, 'report_view');
      assert.equal(view.report.snapshots.length, workload.length); assert.equal(view.report.roles.length, 5);
      assert.doesNotMatch(JSON.stringify(view), /RUN16_(?:PRIVATE|HIDDEN|EXECUTION)|PRIVATE_RECORDS/);
      if (['mobile_native_unknown','empty_unknown'].includes(workload[0])) assert.ok(view.report.roles.every((role: any) => role.state === 'unknown'));
      await checkCleanup(job.finishedAt);
    }
    // Two admitted jobs share the one real worker: measure queue wait separately.
    const pairIds = await configure(['backend_parse']);
    await call('/__test/controls', { paused: true });
    const pair = await Promise.all([submit(pairIds), submit(pairIds)]);
    assert.notEqual(pair[0].jobId, pair[1].jobId); await call('/__test/controls', { paused: false });
    const pairFinished = await Promise.all(pair.map((job, i) => finish(job, `queued_pair_${i + 1}`)));
    await checkCleanup(pairFinished.map(j => j.finishedAt).sort().at(-1));
    // Exactly the default eligible-file limit, then one over it. Rejection is
    // measured separately and never removed from a valid-workload denominator.
    const limit = await submit(await configure(['limit_10000']));
    await checkCleanup((await finish(limit, 'limit_10000')).finishedAt);
    const rejected = await finish(await submit(await configure(['too_many_eligible'])), 'too_many_eligible', 'failed');
    assert.equal(rejected.failureCode, 'REPOSITORY_TOO_LARGE');
    await checkCleanup(rejected.finishedAt);
    const beforeOutage = await call('/__test/state');
    await call('/__test/outage', { github: true, model: true });
    for (let i = 0; i < 50; i++) {
      await call(`/api/v1/readiness-reports/${reportId}/view`, undefined, 'report_view');
      await call('/api/v1/readiness-reports?limit=20', undefined, 'history');
      await call(`/api/v1/readiness-reports/${reportId}/evidence?limit=10`, undefined, 'evidence');
    }
    const afterOutage = await call('/__test/state'); assert.equal(afterOutage.modelCalls, beforeOutage.modelCalls); assert.equal(afterOutage.downloads, beforeOutage.downloads);
    const other = await call('/__test/session?actor=2');
    for (const suffix of ['/view','/evidence']) await call(`/api/v1/readiness-reports/${reportId}${suffix}`, undefined, 'foreign_denial', 404, other.token);
    for (const route of ['/api/v1/public/readiness-reports', '/api/v1/employer/readiness-reports']) {
      // Unknown routes have Express's generic HTML 404, not a report projection.
      const response = await fetch(`${origin}${route}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /RUN16_|commitSha|capabilityGroups/);
    }
    const metrics = await call('/__test/metrics'); const { corpus, sha256 } = await readCorpus();
    const validJobs = jobs.filter(j => j.scenario !== 'too_many_eligible');
    const perStage: Record<string, number[]> = {};
    for (const item of metrics.stageMarks) for (let i = 0; i < item.marks.length - 1; i++) {
      const stage = item.marks[i].stage; (perStage[stage] ??= []).push(Math.round(item.marks[i + 1].atMs - item.marks[i].atMs));
    }
    const summary = (values: number[]) => ({ samples: values.length, p50: quantile(values, .5), p95: quantile(values, .95), max: Math.max(...values) });
    const result = { measuredAt: new Date().toISOString(), corpus: { id: corpus.id, version: corpus.version, sha256 },
      environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem()/2**30), workerConcurrency: 1, maximumQueuedTogether: 2, maximumSelectedRepositories: 5, maximumEligibleFiles: 10000, database: 'disposable PostgreSQL 17', providerTransports: 'synthetic', host: 'shared_local_development_machine' },
      completion: proportion(validJobs.filter(j => j.status === 'completed').length, validJobs.length),
      validWorkloads: validJobs.map(({ jobId: _j, reportId: _r, ...j }) => j),
      rejectedWorkloads: jobs.filter(j => j.scenario === 'too_many_eligible').map(({ jobId: _j, reportId: _r, ...j }) => j),
      latencyMs: { queue: summary(validJobs.map(j => j.queueMs)), processing: summary(validJobs.map(j => j.processingMs)), endToEnd: summary(validJobs.map(j => j.totalMs)),
        api: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, summary(values)])),
        stages: Object.fromEntries(Object.entries(perStage).map(([name, values]) => [name, summary(values)])) },
      peakServerRssMiB: metrics.peakRssMiB, peakGeneratedArchiveBytes: metrics.peakArchiveBytes,
      cleanup: { terminalWorkspacesRemaining: afterOutage.workspaceFiles, emptyWorkspaceChecks: cleanupChecks.length,
        terminalToEmptyCheckMs: summary(cleanupChecks), jobPollIntervalMs: 30, productionSweeperVerified: false },
      cost: { actualProviderUsd: 0, syntheticUsage: metrics.model, configuredPerJobCapUsd: .10, productionProviderCostMeasured: false },
      invariants: { duplicateStartCreatedOneJob: true, savedReadsDuringProviderOutage: true, foreignReportReadsDenied: true },
      limitations: ['Local synthetic transports exclude provider/auth network latency and rate limits', 'A small workload is not a production completion/latency SLA',
        'Stage intervals include database bookkeeping and adjacent stage work; downloading includes some authorization', 'Archive bytes are not a measured container-volume high-water mark',
        'Cleanup observed at terminal polling; deployed supervision and outage behavior remain external gates'] };
    if (process.argv.includes('--record')) await writeFile(resolve(backend, '../docs/benchmarks/run16-load.json'), JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    child.kill('SIGTERM');
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([exited, new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Disposable harness shutdown deadline')); }, 10000);
      })]);
    } finally { clearTimeout(watchdog); }
    if (child.exitCode !== 0) console.error('Synthetic harness stopped with a nonzero status.');
    // Diagnostics contain only the synthetic harness; emit only when startup failed.
    if (!jobs.length && diagnostics) console.error(diagnostics);
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Release load check failed'); process.exitCode = 1; });
