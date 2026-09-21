// Test-only loopback server: real services, RPCs/migrations and synthetic GitHub.
// It never loads application environment files or connects to hosted services.
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { selectionDatabase } from '../helpers/selection-db';
import { actor1, SyntheticGitHubProvider, fixtureRepository, testKey } from '../helpers/github-app-fixtures';
import { GitHubConnectionRepository } from '../../src/domain/github-app/repository';
import { GitHubConnectionService } from '../../src/domain/github-app/service';
import { GitHubVault, digest, randomSecret } from '../../src/domain/github-app/crypto';
import { RepositorySelectionService } from '../../src/domain/github-app/selection';
import { analysisPolicy } from '../helpers/job-fixtures';
import { JobRepository } from '../../src/domain/jobs/repository';

async function main() {
  process.chdir(tmpdir());
  for (const key of ['ENGINE_URL','SENTRY_DSN','GITHUB_APP_ID','GITHUB_APP_PRIVATE_KEY','GITHUB_APP_SLUG']) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', SUPABASE_URL: 'http://127.0.0.1:3191', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', SUPABASE_ANON_KEY: 'fixture-anon',
    TOKEN_ENCRYPTION_KEY: testKey, ADMIN_SECRET: 'fixture-admin', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'fixture', RESEND_API_KEY: 're_fixture',
    FEEDBACK_NOTIFICATION_EMAIL: 'fixture@example.test', ENGINE_INTERNAL_KEY: 'fixture', GITHUB_APP_CLIENT_ID: 'fixture', GITHUB_APP_CLIENT_SECRET: 'fixture',
    GITHUB_APP_WEBHOOK_SECRET: 'fixture-webhook-secret', FEATURE_ONE_ENABLED: 'false', GITHUB_APP_REPOSITORIES_ENABLED: 'false', CORS_ORIGIN: 'http://127.0.0.1:3190' });
  const { createGitHubAppRoutes } = await import('../../src/routes/github-app.routes');
  const { createRepositorySelectionRoutes } = await import('../../src/routes/repository-selection.routes');
  const { createAnalysisRoutes } = await import('../../src/routes/analysis.routes');
  const { handleGitHubWebhook } = await import('../../src/controllers/github-webhook.controller');
  const { csrfProtection } = await import('../../src/middleware/csrf');
  const { requestId } = await import('../../src/middleware/requestId');
  const { v1Errors } = await import('../../src/middleware/v1-errors');
  const fixture = await selectionDatabase(); const session = randomUUID();
  await fixture.db.query('INSERT INTO auth.users VALUES($1)', [actor1]);
  await fixture.db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, actor1]);
  const vault = new GitHubVault(testKey); const repository = new GitHubConnectionRepository(fixture.rpc); const provider = new SyntheticGitHubProvider();
  const ids = Array.from({ length: 35 }, (_, i) => String(300 + i));
  for (const id of ids) provider.repositories.set(id, fixtureRepository(id));
  provider.access.get('fixture_user100')!.set('500', ids);
  const state = digest(randomSecret()); const binding = digest(randomSecret());
  await repository.startState(actor1, state, binding, 'authorize', vault.seal({}, 'fixture'), new Date(Date.now() + 600000).toISOString(), session);
  await repository.consumeState(actor1, state, binding, 'authorize');
  await repository.link(actor1, '100', 'fixture-one', vault.seal({ token: 'fixture_user100' }, `user:${actor1}:100`), new Date(Date.now() + 28800000).toISOString(), state);
  const github = new GitHubConnectionService(repository, provider, vault, { appId: '42', clientId: 'fixture', slug: 'fixture', frontendOrigin: 'http://127.0.0.1:3190' });
  const selection = new RepositorySelectionService(fixture.rpc, github, vault, 5);
  const token = `header.${Buffer.from(JSON.stringify({ sub: actor1, session_id: session })).toString('base64url')}.fixture`;
  const app = express(); app.use(requestId);
  app.post('/api/github-app/webhook', express.raw({ type: 'application/json' }), handleGitHubWebhook);
  app.use(cookieParser(), express.json());
  // Minimal local Supabase transport stub; real active-session and owner RPCs still run.
  app.get('/auth/v1/user', (req, res) => req.headers.authorization === `Bearer ${token}` ? res.json({ id: actor1, email: 'fixture@example.test' }) : res.status(401).json({ message: 'No fixture session' }));
  app.post('/rest/v1/rpc/:name', async (req, res) => { const result = await fixture.rpc.rpc(req.params.name, req.body); res.status(result.error ? 400 : 200).json(result.error ?? result.data); });
  let analysisEnabled=false;
  const jobs=new JobRepository(fixture.rpc);
  app.post('/__test/analysis-intake', (_req,res)=>{analysisEnabled=true;res.json({enabled:true});});
  app.post('/__test/analysis-claim',async (_req,res)=>{const claim=await jobs.claim();res.json({claimed:!!claim});});
  app.get('/__test/session', (_req, res) => res.json({ token }));
  app.get('/api/auth/me', (req, res) => res.json({ success: true, data: { user: req.cookies.access_token === token ? { id: actor1, email: 'fixture@example.test', display_name: 'Fixture' } : null } }));
  app.get('/api/v1/capabilities', (_req, res) => res.json({ success: true, data: { contractVersion: '1.0.0', features: { featureOneEnabled: true, githubAppRepositoriesEnabled: true, rescansEnabled: false, findingFeedbackEnabled: false }, readinessAvailability: 'not_implemented' } }));
  app.use(csrfProtection);
  app.use('/api/v1', (req, res, next) => { res.locals.apiVersion = 'v1'; res.locals.requestId = req.requestId; res.setHeader('Cache-Control', 'private, no-store'); next(); });
  app.use('/api/v1', createGitHubAppRoutes((_req, _res, next) => next(), () => github));
  app.use('/api/v1', createRepositorySelectionRoutes((_req, _res, next) => next(), () => selection));
  app.use('/api/v1',createAnalysisRoutes((_req,_res,next)=>next(),{jobs:()=>jobs,available:()=>analysisEnabled,policy:analysisPolicy,maxRepositories:5}));
  app.use(v1Errors);
  const server = app.listen(3191, '127.0.0.1');
  for (const signal of ['SIGTERM','SIGINT'] as const) process.on(signal, () => { server.close(); void fixture.db.close().then(() => process.exit(0)); });
}
void main().catch(error => { console.error(error); process.exit(1); });
