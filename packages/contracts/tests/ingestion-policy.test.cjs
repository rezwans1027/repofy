const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReadinessReportResponseSchema } = require('../dist');
const { createSyntheticReportFixture } = require('../dist/testing');
test('reports pin one security policy and reject incompatible or omitted snapshot policy hashes', () => {
  const report = createSyntheticReportFixture();
  report.versions.ingestionPolicyHash = 'sha256:' + 'a'.repeat(64);
  assert.equal(ReadinessReportResponseSchema.safeParse(report).success, false);
  for (const snapshot of report.snapshots) snapshot.securityPolicyHash = report.versions.ingestionPolicyHash;
  assert.ok(ReadinessReportResponseSchema.parse(report));
  report.snapshots[0].securityPolicyHash = 'sha256:' + 'b'.repeat(64);
  assert.equal(ReadinessReportResponseSchema.safeParse(report).success, false);
  report.versions.ingestionPolicyHash = 'a private policy name';
  assert.equal(ReadinessReportResponseSchema.safeParse(report).success, false);
});
