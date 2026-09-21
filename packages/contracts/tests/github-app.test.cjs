const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const id = '11111111-1111-4111-8111-111111111111';
test('connection inputs allow only safe return routes and bounded opaque pagination', () => {
  assert.deepEqual(c.GitHubConnectionStartSchema.parse({}), { intent: 'install', returnTo: '/readiness/new' });
  for (const input of [{ returnTo: '//evil.example' }, { actor: id }, { accountId: 'bad' }]) assert.equal(c.GitHubConnectionStartSchema.safeParse(input).success, false);
  for (const perPage of ['0', '101', '-1', '1.1', '01']) assert.equal(c.GitHubPageQuerySchema.safeParse({ accountId: id, perPage }).success, false);
  assert.equal(c.GitHubPageQuerySchema.parse({ accountId: id, perPage: '100' }).perPage, 100);
});
test('discovery includes safe display metadata but rejects tokens, provider IDs and internal locators', () => {
  const repository = { repositoryId: id, installationId: id, accountId: id, fullName: 'fixture/private', visibility: 'private', defaultBranch: 'main', archived: false };
  assert.ok(c.GitHubRepositorySummarySchema.parse(repository));
  for (const key of ['token', 'providerRepositoryId', 'privateKey', 'locatorEncrypted']) assert.equal(c.GitHubRepositorySummarySchema.safeParse({ ...repository, [key]: 'sentinel' }).success, false);
  assert.ok(c.GitHubRepositoriesResponseSchema.parse({ repositories: [], status: 'unavailable', nextCursor: null, issues: ['rate_limited'], retryAfterSeconds: 60, connectPath: '/api/v1/github/installations/start' }));
  assert.equal(c.GitHubConnectionStartResponseSchema.safeParse({ authorizeUrl: 'https://evil.example', expiresAt: '2026-09-15T00:00:00Z' }).success, false);
});
