const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RescanRequestSchema, RoleFocusRequestSchema, ComparisonQuerySchema, ComparisonEvidenceSchema } = require('../dist');
const id = '00000000-0000-4000-8000-000000000001';
test('rescan and role focus contracts reject fabricated prices, roles, unbounded sets and private source', () => {
  const request = { repositoryIds: [id], idempotencyKey: 'fixture-request' };
  assert.equal(RescanRequestSchema.safeParse(request).success, true);
  for (const value of [{ ...request, charge: 0 }, { ...request, repositoryIds: [id, id] }, { ...request, repositoryIds: [] }, { ...request, source: 'private' }]) assert.equal(RescanRequestSchema.safeParse(value).success, false);
  assert.equal(RoleFocusRequestSchema.safeParse({ role: { roleId: 'mobile', version: '1.0.0' } }).success, true);
  assert.equal(RoleFocusRequestSchema.safeParse({ role: { roleId: 'senior', version: '1.0.0' } }).success, false);
});
test('comparison requests and evidence outputs are bounded, owner-resource references only', () => {
  for (const value of [{ targetReportId: id, limit: 101 }, { targetReportId: id, offset: -1 }, { targetReportId: id, afterSourcePath: 'secret' }]) assert.equal(ComparisonQuerySchema.safeParse(value).success, false);
  const row = { repositoryId: id, change: 'gained', baselineEvidenceId: null, targetEvidenceId: id, detector: 'tsjs.bounded_retry', sourceType: 'code', capabilityIds: ['performance_resources'], basis: 'unmatched', interpretation: 'comparable_observation' };
  assert.equal(ComparisonEvidenceSchema.safeParse(row).success, true);
  assert.equal(ComparisonEvidenceSchema.safeParse({ ...row, baselineEvidenceId: id }).success, false);
  assert.equal(ComparisonEvidenceSchema.safeParse({ ...row, contentKey: 'private-hmac' }).success, false);
});
