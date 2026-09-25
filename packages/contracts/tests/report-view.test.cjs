const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReportHistoryQuerySchema, ReportEvidenceQuerySchema, EvidenceLocationResponseSchema, ReportEventSchema, isPinnedGitHubUrl, ReportViewSchema } = require('../dist');
const { createSyntheticReportFixture } = require('../dist/testing');
const id = '00000000-0000-4000-8000-000000000001';
const { roleAvailability } = require('../dist');
test('role availability is explicit for limited, unknown and unqualified policies without rewriting saved math', () => {
  for (const version of ['1.0.0', '1.1.0', '2.0.0']) {
    const report = createSyntheticReportFixture();
    report.versions.aggregationPolicy = { id: 'evidence_aggregation', version };
    report.versions.taxonomy = { id: 'engineering_capabilities', version: '1.0.0' };
    report.roles[0] = { state: 'assessed', template: report.roles[0].template, coverage: .03, confidence: .15,
      assessedRequirementIds: ['testing'], unknownRequirementIds: [], limitations: [] };
    const before = structuredClone(report), statuses = roleAvailability(report);
    assert.deepEqual(statuses[0], { template: report.roles[0].template, state: 'unavailable',
      reason: version === '2.0.0' ? 'policy_not_qualified' : 'required_confidence_unattainable' });
    assert.ok(statuses.slice(1).every(s => s.state === 'unknown' && s.reason === 'insufficient_coverage'));
    assert.deepEqual(report, before);
    const view = { report, aggregation: null, repositories: report.snapshots.map(s => ({ snapshotId: s.snapshotId, repositoryId: s.repositoryId,
      visibility: s.repositoryVisibility, access: 'active' })), categories: [], capabilities: [], roleDefinitions: [], roleAvailability: statuses };
    assert.equal(ReportViewSchema.safeParse(view).success, true);
    view.roleAvailability[0] = { template: report.roles[0].template, state: 'available' };
    assert.equal(ReportViewSchema.safeParse(view).success, false);
    view.roleAvailability = [statuses[1], ...statuses.slice(1)];
    assert.equal(ReportViewSchema.safeParse(view).success, false);
  }
});
test('read pagination and telemetry accept only bounded parameters, enums and opaque IDs', () => {
  for (const limit of [0, -1, 1.2, 51, '20']) assert.equal(ReportHistoryQuerySchema.safeParse({ limit }).success, false);
  assert.equal(ReportEvidenceQuerySchema.safeParse({ requirementId: 'api_design' }).success, false);
  assert.equal(ReportEvidenceQuerySchema.safeParse({ roleId: 'backend', requirementId: 'api_design', limit: 100 }).success, true);
  assert.equal(ReportEventSchema.safeParse({ event: 'improvement_opened', objectId: id }).success, true);
  for (const bad of [{ event: 'improvement_opened' }, { event: 'report_viewed', source: 'private' }, { event: 'custom_event' }]) assert.equal(ReportEventSchema.safeParse(bad).success, false);
});
test('public location links require GitHub, a matching commit, and safe repository-relative paths', () => {
  const url = `https://github.com/fixture/project/blob/${'a'.repeat(40)}/src/a%20b.ts#L3-L5`;
  assert.equal(isPinnedGitHubUrl(url), true);
  for (const bad of [url.replace('github.com', 'github.com.evil.test'), url.replace('https:', 'http:'), url.replace('a'.repeat(40), 'main'),
    url.replace('src/a%20b.ts', '%2e%2e/secret'), url.replace('src/a%20b.ts', 'src%2Fsecret'), url + '?token=x', 'javascript:alert(1)']) assert.equal(isPinnedGitHubUrl(bad), false);
  const value = { state: 'available', evidenceId: id, commitSha: 'a'.repeat(40), label: 'src/a b.ts', repositoryLabel: 'fixture/project', visibility: 'public', url };
  assert.equal(EvidenceLocationResponseSchema.safeParse(value).success, true);
  assert.equal(EvidenceLocationResponseSchema.safeParse({ ...value, visibility: 'private' }).success, false);
  assert.equal(EvidenceLocationResponseSchema.safeParse({ ...value, commitSha: 'b'.repeat(40) }).success, false);
});
test('view access state must describe exactly the report snapshots with effective privacy', () => {
  const report = createSyntheticReportFixture(), snapshot = report.snapshots[0];
  const view = { report, aggregation: null, repositories: [{ snapshotId: snapshot.snapshotId, repositoryId: snapshot.repositoryId, visibility: 'private', access: 'revoked' }], categories: [], capabilities: [], roleDefinitions: [] };
  assert.equal(ReportViewSchema.safeParse(view).success, true);
  assert.equal(ReportViewSchema.safeParse({ ...view, repositories: [{ ...view.repositories[0], visibility: 'public' }] }).success, false);
  assert.equal(ReportViewSchema.safeParse({ ...view, repositories: [view.repositories[0], view.repositories[0]] }).success, false);
});
