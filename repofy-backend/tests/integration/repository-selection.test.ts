import { randomUUID, createHmac } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { selectionDatabase } from "../helpers/selection-db";
import { actor1, actor2, SyntheticGitHubProvider, testKey } from "../helpers/github-app-fixtures";
import { GitHubConnectionRepository } from "../../src/domain/github-app/repository";
import { GitHubConnectionService } from "../../src/domain/github-app/service";
import { GitHubVault, digest, randomSecret } from "../../src/domain/github-app/crypto";
import { RepositorySelectionService } from "../../src/domain/github-app/selection";
import { createRepositorySelectionRoutes } from "../../src/routes/repository-selection.routes";
import { requestId } from "../../src/middleware/requestId";
import { csrfProtection } from "../../src/middleware/csrf";
import { getSupabaseAdmin } from "../../src/config/supabase";
import { createApp } from "../../src/app";
import { env } from "../../src/config/env";

vi.mock('../../src/config/supabase', () => ({ getSupabaseAdmin: vi.fn() }));
let fixture: Awaited<ReturnType<typeof selectionDatabase>>;
let selection: RepositorySelectionService;
let choice: { repositoryId: string; accountId: string; installationId: string };
const provider = new SyntheticGitHubProvider(); const session = randomUUID();
const jwt = (actor = actor1) => `header.${Buffer.from(JSON.stringify({ sub: actor, session_id: session })).toString('base64url')}.fixture`;
let enabled = true;
function app() {
  const app = express(); app.use(requestId, cookieParser(), express.json(), csrfProtection);
  app.use((_req, res, next) => { res.locals.apiVersion = 'v1'; res.locals.requestId = randomUUID(); next(); });
  app.use('/api/v1', createRepositorySelectionRoutes((_req, res, next) => enabled ? next() : void res.status(503).json({ code: 'FEATURE_DISABLED' }), () => selection));
  return app;
}
beforeAll(async () => {
  fixture = await selectionDatabase();
  await fixture.db.query('INSERT INTO auth.users VALUES($1),($2)', [actor1, actor2]);
  await fixture.db.query('INSERT INTO auth.sessions VALUES($1,$2)', [session, actor1]);
  const repository = new GitHubConnectionRepository(fixture.rpc); const vault = new GitHubVault(testKey);
  const hash = digest(randomSecret()); const binding = digest(randomSecret());
  await repository.startState(actor1, hash, binding, 'authorize', vault.seal({}, 'test'), new Date(Date.now() + 600000).toISOString(), session);
  await repository.consumeState(actor1, hash, binding, 'authorize');
  const accountId = await repository.link(actor1, '100', 'fixture-one', vault.seal({ token: 'fixture_user100' }, `user:${actor1}:100`), new Date(Date.now() + 28800000).toISOString(), hash);
  const github = new GitHubConnectionService(repository, provider, vault, { appId: '42', clientId: 'test', slug: 'fixture', frontendOrigin: 'http://localhost:3100' });
  const installationId = (await github.installations(actor1, accountId)).installations[0].installationId;
  const repositoryId = (await github.repositories(actor1, accountId, installationId)).repositories[0].repositoryId;
  choice = { repositoryId, accountId, installationId }; selection = new RepositorySelectionService(fixture.rpc, github, vault, 5);
}, 20000);
beforeEach(() => {
  vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc: fixture.rpc.rpc,
    auth: { getUser: vi.fn(async (token: string) => ({ data: { user: { id: token === jwt(actor2) ? actor2 : actor1 } }, error: null })) } } as never);
});
afterAll(async () => fixture?.db.close());
it('requires a verified live session and retains browser CSRF on selection writes', async () => {
  expect((await request(app()).get('/api/v1/repository-selections')).status).toBe(401);
  expect((await request(app()).post('/api/v1/repository-selections').set('Cookie', `access_token=${jwt()}`).send({})).status).toBe(403);
  expect((await request(app()).post('/api/v1/repository-selections').set('Cookie', `access_token=${jwt()}`).set('X-Requested-With', 'XMLHttpRequest').set('Origin', 'https://evil.example').send({})).status).toBe(403);
});
it('saves authorized choices with machine-readable errors and allows read/removal when intake is off', async () => {
  const application = app();
  const get = () => request(application).get('/api/v1/repository-selections').set('Authorization', `Bearer ${jwt()}`);
  const initial = await get(); expect(initial.status).toBe(200);
  const body = { repositories: [choice], expectedRevision: initial.body.data.revision, idempotencyKey: randomUUID() };
  const post = (input: unknown) => request(application).post('/api/v1/repository-selections').set('Authorization', `Bearer ${jwt()}`).set('X-Request-Id', 'readable-trace').send(input);
  expect((await post(body)).body.code).toBe('CONSENT_REQUIRED');
  const saved = await post({ ...body, attestation: { accepted: true, version: '1.0.0' } }); expect(saved.status).toBe(200);
  const grant = saved.body.data.repositories[0];
  enabled = false;
  expect((await post(body)).status).toBe(503); expect((await get()).status).toBe(200);
  const removed = await request(application).delete(`/api/v1/repository-selections/${grant.grantId}`).set('Authorization', `Bearer ${jwt()}`);
  expect(removed.status).toBe(200); expect(removed.body.data.repositories).toEqual([]);
  await expect(selection.checkGrant(actor1, grant.grantId, grant.accessRevision)).rejects.toMatchObject({ code: 'REPOSITORY_ACCESS_REVOKED' });
  enabled = true;
});
it('the real app verifies original webhook bytes before JSON/CSRF and processes duplicates with intake off', async () => {
  // Flags are off in the application fixture. Retain the security secret separately.
  Object.assign(env.featureOne, { githubWebhookSecret: 'fixture-webhook-secret' });
  const raw = '{ "action" : "removed", "installation":{"id":500}, "repositories_removed":[{"id":300}] }';
  const signature = 'sha256=' + createHmac('sha256', 'fixture-webhook-secret').update(raw).digest('hex');
  const delivery = randomUUID(); const application = createApp();
  const deliver = (body = raw) => request(application).post('/api/github-app/webhook').set('Content-Type', 'application/json')
    .set('Cookie', 'access_token=ignored-server-delivery').set('X-Hub-Signature-256', signature).set('X-GitHub-Delivery', delivery).set('X-GitHub-Event', 'installation_repositories').send(body);
  expect((await deliver(JSON.stringify(JSON.parse(raw)))).status).toBe(401);
  expect((await deliver()).body).toEqual({ received: true, duplicate: false });
  expect((await deliver()).body).toEqual({ received: true, duplicate: true });
});
