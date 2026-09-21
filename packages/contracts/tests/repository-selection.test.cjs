const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const id = '11111111-1111-4111-8111-111111111111';
const request = { repositories: [{ repositoryId: id, accountId: id, installationId: id }], expectedRevision: id, idempotencyKey: id };
test('selection requests cannot assert grants, timestamps, owner facts, or duplicate repositories', () => {
  assert.ok(c.SaveRepositorySelectionSchema.parse(request));
  for (const input of [{ ...request, grantId: id }, { ...request, attestedAt: '2026-09-19T00:00:00Z' },
    { ...request, repositories: [...request.repositories, ...request.repositories] },
    { ...request, attestation: { version: '0.0.0', accepted: true } },
    { ...request, repositories: [{ ...request.repositories[0], visibility: 'public' }] }]) {
    assert.equal(c.SaveRepositorySelectionSchema.safeParse(input).success, false);
  }
});
test('saved selection advertises exact consent, authoritative bounds and a server-controlled analysis action', () => {
  const response = { revision: id, repositories: [], policy: { maxRepositories: 5, attestationVersion: c.REPOSITORY_ATTESTATION_VERSION,
    attestationText: c.REPOSITORY_ATTESTATION_TEXT, allowArchived: false, requireDefaultBranch: true, analysisAvailable: false } };
  assert.ok(c.SavedRepositorySelectionSchema.parse(response));
  assert.ok(c.SavedRepositorySelectionSchema.parse({ ...response, policy: { ...response.policy, analysisAvailable: true } }));
  for (const policy of [{ maxRepositories: 100 }, { attestationText: 'unauthorized substitute' }])
    assert.equal(c.SavedRepositorySelectionSchema.safeParse({ ...response, policy: { ...response.policy, ...policy } }).success, false);
});
