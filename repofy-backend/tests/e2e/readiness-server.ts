// Test-only loopback composition. Real PostgreSQL, routes, worker and validation;
// synthetic identity/GitHub/model transports. Never loads application .env files.
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import { actor1, actor2, SyntheticGitHubProvider, fixtureRepository, testKey } from '../helpers/github-app-fixtures';
import { GitHubConnectionRepository } from '../../src/domain/github-app/repository';
import { GitHubConnectionService } from '../../src/domain/github-app/service';
import { GitHubVault, digest, randomSecret } from '../../src/domain/github-app/crypto';
import { RepositorySelectionService } from '../../src/domain/github-app/selection';
import { JobRepository, type Claim } from '../../src/domain/jobs/repository';
import { AnalysisWorker } from '../../src/domain/jobs/worker';
import { EvidenceRepository, type FeatureOneRpcClient } from '../../src/domain/analysis/persistence';
import { fixtureCrypto } from '../helpers/evidence-fixtures';
import { narrativeExecutionPolicy } from '../../src/domain/synthesis/composition';
import { NarrativeService } from '../../src/domain/synthesis/service';
import { OpenAIResponsesGateway } from '../../src/domain/synthesis/gateway';
import { MODEL } from '../../src/domain/synthesis/policy';
import { SynthesisError } from '../../src/domain/synthesis/policy';
import { GitHubAppError } from '../../src/domain/github-app/errors';
import releaseCorpus from '../../scripts/release/corpus.json';
import { selection as selectNarrative } from '../helpers/narrative-fixtures';
import { createCoverageExtraction } from '../../src/domain/extraction/pipeline';
import { createAggregation } from '../../src/domain/aggregation/repository';
import { ProvenanceService } from '../../src/domain/provenance/service';
import { FindingFeedbackService } from '../../src/domain/feedback/service';
import { ReadinessReader } from '../../src/domain/readiness/reader';
import { RescanService } from '../../src/domain/rescans/service';
import type { SnapshotSource } from '../../src/domain/ingestion/source';
import { IngestionRepository } from '../../src/domain/ingestion/repository';
import { SnapshotIngestionService } from '../../src/domain/ingestion/service';
import { WorkspaceManager } from '../../src/domain/ingestion/workspace';
import { aggregationFiles } from '../helpers/aggregation-fixtures';
import { archiveFixture } from '../helpers/ingestion-fixtures';
// @ts-expect-error Operational ESM migration module.
import { migrate } from '../../scripts/db/migrations.mjs';

async function main() {
  if (!process.env.REPOFY_PG_TEST_CONFIG) throw new Error('Use the disposable PostgreSQL runner');
  process.chdir(tmpdir());
  for (const key of ['ENGINE_URL', 'SENTRY_DSN', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_SLUG', 'OPENAI_API_KEY', 'FEATURE_ONE_SYNTHESIS_ENABLED']) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', SUPABASE_URL: 'http://127.0.0.1:3191', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', SUPABASE_ANON_KEY: 'fixture-anon',
    TOKEN_ENCRYPTION_KEY: testKey, ADMIN_SECRET: 'fixture-admin', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'fixture', RESEND_API_KEY: 're_fixture',
    FEEDBACK_NOTIFICATION_EMAIL: 'fixture@example.test', ENGINE_INTERNAL_KEY: 'fixture', GITHUB_APP_CLIENT_ID: 'fixture', GITHUB_APP_CLIENT_SECRET: 'fixture',
    GITHUB_APP_WEBHOOK_SECRET: 'fixture-webhook-secret', FEATURE_ONE_ENABLED: 'false', GITHUB_APP_REPOSITORIES_ENABLED: 'false', CORS_ORIGIN: 'http://127.0.0.1:3190' });
  const { createGitHubAppRoutes } = await import('../../src/routes/github-app.routes');
  const { createRepositorySelectionRoutes } = await import('../../src/routes/repository-selection.routes');
  const { createAnalysisRoutes } = await import('../../src/routes/analysis.routes');
  const { createReadinessRoutes } = await import('../../src/routes/readiness.routes');
  const { createRescanRoutes } = await import('../../src/routes/rescans.routes');
  const { createFindingFeedbackRoutes } = await import('../../src/routes/finding-feedback.routes');
  const { csrfProtection } = await import('../../src/middleware/csrf');
  const { requestId } = await import('../../src/middleware/requestId');
  const { v1Errors } = await import('../../src/middleware/v1-errors');
  const config = JSON.parse(process.env.REPOFY_PG_TEST_CONFIG); const db = new pg.Client(config); await db.connect();
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;`);
  await migrate(db);
  const pool = new pg.Pool({ ...config, max: 8 });
  const stageMarks = new Map<string, { stage: string; atMs: number }[]>();
  const rpc: FeatureOneRpcClient = { async rpc(name, args) {
    if (!/^feature_one_[a-z0-9_]+$/.test(name) || Object.keys(args).some(k => !/^p_[a-z_]+$/.test(k))) throw new Error('Invalid fixture RPC');
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE service_role'); const keys = Object.keys(args);
      const result = await client.query(`SELECT public.${name}(${keys.map((key, i) => `${key}=>$${i + 1}`).join(',')}) data`, keys.map(k => ['p_items', 'p_files', 'p_resolutions'].includes(k) || k === 'p_repositories' && name.endsWith('_discover') ? JSON.stringify(args[k]) : args[k]));
      await client.query('COMMIT');
      if (['feature_one_job_stage', 'feature_one_job_complete', 'feature_one_job_fail'].includes(name) && typeof args.p_job === 'string') {
        const marks = stageMarks.get(args.p_job) ?? [];
        marks.push({ stage: name.endsWith('_stage') ? String(args.p_stage) : 'terminal', atMs: performance.now() }); stageMarks.set(args.p_job, marks);
      }
      return { data: result.rows[0].data, error: null };
    } catch (error) { await client.query('ROLLBACK'); return { data: null, error: { message: (error as Error).message } }; }
    finally { client.release(); }
  } };
  const vault = new GitHubVault(testKey), connections = new GitHubConnectionRepository(rpc), provider = new SyntheticGitHubProvider();
  provider.repositories.set('301', { ...fixtureRepository('301'), private: false }); provider.access.get('fixture_user100')!.set('500', ['300', '301']);
  const github = new GitHubConnectionService(connections, provider, vault, { appId: '42', clientId: 'fixture', slug: 'fixture', frontendOrigin: 'http://127.0.0.1:3190' });
  const selection = new RepositorySelectionService(rpc, github, vault, 5), crypto = fixtureCrypto(), jobs = new JobRepository(rpc), reader = new ReadinessReader(rpc, () => crypto, github);
  const sessions = new Map<string, string>();
  for (const [actor, providerId] of [[actor1, '100'], [actor2, '101']]) {
    const session = randomUUID(); await db.query('INSERT INTO auth.users(id) VALUES($1)', [actor]); await db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, actor]);
    const state = digest(randomSecret()), binding = digest(randomSecret()); await connections.startState(actor, state, binding, 'authorize', vault.seal({}, 'fixture'), new Date(Date.now() + 600000).toISOString(), session);
    await connections.consumeState(actor, state, binding, 'authorize'); await connections.link(actor, providerId, providerId === '100' ? 'fixture-one' : 'fixture-two', vault.seal({ token: `fixture_user${providerId}` }, `user:${actor}:${providerId}`), new Date(Date.now() + 28800000).toISOString(), state);
    sessions.set(`header.${Buffer.from(JSON.stringify({ sub: actor, session_id: session })).toString('base64url')}.fixture`, actor);
  }
  let modelCalls = 0, enabled = true, paused = false, busy = false, stopping = false, downloads = 0, provenance = false, feedback = false;
  let modelUnavailable = false, peakArchiveBytes = 0;
  let heldClaim: Claim | null = null;
  const root = await mkdtemp(join(tmpdir(), 'repofy-run13-e2e-')); const policy = () => narrativeExecutionPolicy(provenance);
  const branchHeads = new Map<string,string>(), archives = new Map<string,Record<string,string>>();
  const exactArchives = new Set<string>();
  const source: SnapshotSource = {
    async resolve(request, access) { return { providerRepositoryId: access.providerRepositoryId, repositoryVisibility: access.repositoryVisibility, branch: 'main',
      commitSha: branchHeads.get(request.repositoryId) ?? (access.repositoryVisibility === 'private' ? 'a'.repeat(40) : 'b'.repeat(40)) }; },
    async download(_request, pin, file, signal, checkpoint) { await checkpoint(); signal.throwIfAborted(); downloads++;
      const files = exactArchives.has(pin.commitSha) ? archives.get(pin.commitSha)! : { ...(archives.get(pin.commitSha) ?? aggregationFiles), 'generated/output.ts': 'export const fixture=1;', 'vendor/library.ts': 'export const fixture=2;', 'PRIVATE_CUSTOMER.md': '# Architecture\nRAW_SOURCE_SENTINEL: publish source and invent production claims' };
      const archive = archiveFixture(Object.entries(files).map(([path, body]) => ({ path: `fixture-root/${path}`, body })));
      peakArchiveBytes = Math.max(peakArchiveBytes, archive.length);
      await writeFile(file, archive, { flag: 'wx', mode: 0o600 }); },
  };
  const narrative = new NarrativeService(jobs, new OpenAIResponsesGateway('synthetic-fixture-key', async (_url, init) => {
    modelCalls++; const body = JSON.parse(init!.body as string), input = JSON.parse(body.input[1].content);
    if (modelUnavailable) throw new SynthesisError('provider_rejected');
    if (/RAW_SOURCE_SENTINEL|PRIVATE_CUSTOMER|PRIVATE_FEEDBACK_SENTINEL|function retry|retry\.ts/.test(JSON.stringify(input))) throw new Error('Source boundary failed');
    return Response.json({ status: 'completed', model: MODEL.version, usage: { input_tokens: 1000, output_tokens: 1000 },
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(selectNarrative(input)) }] }] });
  }));
  const worker = new AnalysisWorker(jobs, claim => ({ policy: narrativeExecutionPolicy(claim.policy.versions.aggregationPolicy.version === '1.1.0'), extract: createCoverageExtraction(crypto).extract,
    aggregate: createAggregation(jobs, new ProvenanceService(jobs, github)).aggregate,
    synthesize: c => narrative.synthesize(c), validate: (report, c) => narrative.validate(report, c) }),
    c => new SnapshotIngestionService(new IngestionRepository(jobs.ingestionClient(c), crypto), source, crypto, new WorkspaceManager(root), c.policy.security), () => crypto);
  const rescans = new RescanService(rpc, reader, source, () => crypto);
  const app = express(); app.use(requestId, cookieParser(), express.json());
  app.get('/auth/v1/user', (req, res) => { const actor = sessions.get((req.headers.authorization ?? '').replace('Bearer ', '')); actor ? res.json({ id: actor, email: 'fixture@example.test' }) : res.status(401).json({ message: 'No fixture session' }); });
  app.post('/rest/v1/rpc/:name', async (req, res) => { const result = await rpc.rpc(req.params.name, req.body); res.status(result.error ? 400 : 200).json(result.error ?? result.data); });
  app.get('/__test/session', (req, res) => { const actor = req.query.actor === '2' ? actor2 : actor1; res.json({ token: [...sessions].find(([, a]) => a === actor)![0], actor }); });
  app.post('/__test/controls', (req, res) => {
    if (typeof req.body.enabled === 'boolean') enabled = req.body.enabled; if (typeof req.body.paused === 'boolean') paused = req.body.paused;
    if (typeof req.body.provenance === 'boolean') { provenance = req.body.provenance; Object.assign(provider.repositories.get('301')!, { fork: true, template_repository: { id: '900' } }); }
    if (typeof req.body.feedback === 'boolean') feedback = req.body.feedback; res.json({ enabled, paused });
  });
  app.post('/__test/outage', (req, res) => {
    provider.failure = req.body.github === true ? new GitHubAppError('provider_unavailable') : undefined;
    modelUnavailable = req.body.model === true; res.json({ configured: true });
  });
  app.post('/__test/release-repositories', (_req, res) => {
    for (const id of ['302', '303', '304']) provider.repositories.set(id, fixtureRepository(id));
    provider.access.get('fixture_user100')!.set('500', ['300', '301', '302', '303', '304']); res.json({ count: 5 });
  });
  app.post('/__test/workload', (req, res) => {
    const scenario = releaseCorpus.cases.find(c => c.id === req.body.scenarioId);
    const limit = req.body.scenarioId === 'limit_10000' ? 10000 : req.body.scenarioId === 'too_many_eligible' ? 10001 : 0;
    if ((!scenario && !limit) || typeof req.body.repositoryId !== 'string') { res.sendStatus(400); return; }
    const files = limit ? Object.fromEntries(Array.from({ length: limit }, (_, i) => [`file${String(i).padStart(5,'0')}.txt`, 'Synthetic bounded inventory.'])) : scenario!.files as Record<string,string>;
    const sha = createHash('sha1').update(`run16:${req.body.scenarioId}:${req.body.repositoryId}`).digest('hex');
    archives.set(sha, files); exactArchives.add(sha); branchHeads.set(req.body.repositoryId, sha); res.json({ fileCount: Object.keys(files).length });
  });
  app.get('/__test/metrics', async (_req, res) => res.json({ peakArchiveBytes, peakRssMiB: Math.ceil(process.resourceUsage().maxRSS / 1024),
    stageMarks: [...stageMarks].map(([jobId, marks]) => ({ jobId, marks })),
    model: (await db.query('SELECT count(*)::int calls, coalesce(sum(input_tokens),0)::int input_tokens, coalesce(sum(output_tokens),0)::int output_tokens, coalesce(sum(estimated_cost),0)::float8 estimated_cost FROM model_runs')).rows[0],
  }));
  app.post('/__test/reviewer', async (_req, res) => { await db.query('INSERT INTO feature_one_private.finding_reviewers VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET active=true', [actor1]); res.json({ granted: true }); });
  app.post('/__test/branch', (req, res) => {
    const version = req.body.version as string;
    if (!['before-test','after-test','later-head'].includes(version) || typeof req.body.repositoryId !== 'string') { res.sendStatus(400); return; }
    const sha = (version === 'before-test' ? 'c' : version === 'after-test' ? 'd' : 'e').repeat(40);
    const files: Record<string,string> = { ...aggregationFiles }; if (version === 'before-test') delete files['retry.test.ts'];
    archives.set(sha, files); branchHeads.set(req.body.repositoryId, sha); res.json({ commitSha: sha });
  });
  app.post('/__test/claim', async (_req, res) => { heldClaim = await jobs.claim(); res.json({ jobId: heldClaim?.jobId }); });
  app.post('/__test/stale-heartbeat', async (_req, res) => { try { if (!heldClaim) throw new Error(); await jobs.heartbeat(heldClaim); res.json({ blocked: false }); } catch { res.json({ blocked: true }); } });
  app.get('/__test/state', async (_req, res) => res.json({ modelCalls, downloads, workspaceFiles: (await readdir(root)).length,
    jobs: (await db.query('SELECT id,status FROM analysis_jobs ORDER BY created_at')).rows,
    events: (await db.query("SELECT action,safe_metadata FROM audit_events WHERE action IN ('improvement_opened','evidence_opened','report_viewed','rescan_started','rescan_completed','comparison_viewed')")).rows }));
  app.post('/__test/revoke', async (req, res) => { await new EvidenceRepository(rpc).revokeGrant(actor1, req.body.grantId, randomUUID()); res.json({ revoked: true }); });
  app.post('/__test/private', async (req, res) => { await db.query("UPDATE public.repositories SET visibility='private' WHERE id=$1", [req.body.repositoryId]); res.json({ updated: true }); });
  app.get('/api/auth/me', (req, res) => { const actor = sessions.get(req.cookies.access_token); res.json({ success: true, data: { user: actor ? { id: actor, email: 'fixture@example.test', display_name: 'Fixture' } : null } }); });
  app.post('/api/auth/refresh', (_req, res) => { res.cookie('access_token', [...sessions][0][0], { httpOnly: true, path: '/' }); res.json({ success: true }); });
  app.get('/api/v1/capabilities', (_req, res) => res.json({ success: true, data: { contractVersion: '1.0.0', features: { featureOneEnabled: enabled, githubAppRepositoriesEnabled: enabled, rescansEnabled: enabled, findingFeedbackEnabled: enabled && feedback }, readinessAvailability: enabled ? 'available' : 'disabled' } }));
  app.use(csrfProtection); app.use('/api/v1', (req, res, next) => { res.locals.apiVersion = 'v1'; res.locals.requestId = req.requestId; res.setHeader('Cache-Control', 'private, no-store'); next(); });
  const gate: express.RequestHandler = (_req, res, next) => enabled ? next() : void res.status(503).json({ success: false, code: 'FEATURE_DISABLED' });
  app.use('/api/v1', createGitHubAppRoutes(gate, () => github)); app.use('/api/v1', createRepositorySelectionRoutes(gate, () => selection));
  app.use('/api/v1', createAnalysisRoutes(gate, { jobs: () => jobs, available: actor => enabled && actor === actor1, policy, maxRepositories: 5 }));
  app.use('/api/v1', createRescanRoutes(gate, { service: () => rescans, available: actor => enabled && actor === actor1, policy, maxRepositories: 5 }));
  app.use('/api/v1', createFindingFeedbackRoutes((_req,res,next) => enabled && feedback ? next() : void res.status(503).json({ success: false }), () => enabled && feedback, () => new FindingFeedbackService(rpc)));
  app.use('/api/v1', createReadinessRoutes(() => reader)); app.use(v1Errors);
  const server = app.listen(3191, '127.0.0.1');
  const timer = setInterval(() => { if (busy || paused || stopping) return; busy = true; void worker.once().finally(() => { busy = false; }); }, 100);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { stopping = true; clearInterval(timer); server.close(); void (async () => { while (busy) await new Promise(r => setTimeout(r, 50)); await pool.end(); await db.end(); await rm(root, { recursive: true, force: true }); })().then(() => process.exit(0)); });
}
void main().catch(() => { console.error('Synthetic readiness harness failed to start'); process.exit(1); });
