const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const fixture = require('../../../docs/benchmarks/run11-example-result.json');
test('deterministic output preserves nullable unknowns, trace membership and all role dependencies', () => {
  assert.deepEqual(c.AggregationResultSchema.parse(fixture), fixture);
  for (const change of [
    v => v.policy.version = '1.0.1',
    v => v.versions.aggregationPolicy.id = 'other',
    v => v.roles[0].template.version = '1.0.1',
    v => v.capabilities.push(v.capabilities[0]),
    v => v.capabilities.find(c => c.state === 'unknown').strength = 0,
    v => v.capabilities.find(c => c.state === 'assessed').evidenceIds = [],
    v => v.capabilities.find(c => c.state === 'assessed').trace.selectedClusterId = 'foreign',
    v => v.capabilities.find(c => c.state === 'assessed').support[0].snapshotId = '10000000-0000-4000-8000-000000000001',
    v => v.capabilities.find(c => c.state === 'not_observed').allowedClaimScopes = ['repository_behavior'],
    v => v.capabilities[0].uncertainty.push('candidate_lacks_skill'),
    v => v.credential = 'PRIVATE_CANARY',
  ]) { const bad = structuredClone(fixture); change(bad); assert.equal(c.AggregationResultSchema.safeParse(bad).success, false); }
});
test('evidence queries require a role for requirement grouping and bound cursor pages', () => {
  assert.deepEqual(c.AggregationEvidenceQuerySchema.parse({}), { limit: 50 });
  assert.equal(c.AggregationEvidenceQuerySchema.safeParse({ requirementId: 'api_design' }).success, false);
  assert.equal(c.AggregationEvidenceQuerySchema.safeParse({ roleId: 'backend', requirementId: 'api_design', limit: 100 }).success, true);
  for (const limit of [0, 101, -1, NaN]) assert.equal(c.AggregationEvidenceQuerySchema.safeParse({ limit }).success, false);
  assert.equal(c.AggregationEvidenceQuerySchema.safeParse({ afterEvidenceId: 'foreign' }).success, false);
});
