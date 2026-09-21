const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const fixture = require('../../../docs/benchmarks/run10-example-coverage.json');
test('coverage contracts retain achieved denominators, closed reason codes and unknown legacy defaults', () => {
  assert.ok(c.AnalyzerCoverageSchema.parse(fixture));
  const old = structuredClone(fixture); delete old.assessment; old.manifestVersion = '1.1.0';
  assert.equal(c.AnalyzerCoverageSchema.parse(old).assessment, undefined);
  for (const change of [
    b => b.assessment.counts.totalFiles++, b => b.assessment.counts.analyzedFractionOfAllFiles = 1,
    b => b.assessment.counts.eligibleFiles++, b => b.assessment.reasons.push('raw parser exception'),
    b => b.assessment.declaration.version = '1.0.0', b => delete b.structural,
    b => b.assessment.capabilities.push(b.assessment.capabilities[0]),
    b => b.assessment.capabilities.find(c => c.state === 'not_assessable').observations++,
    b => b.assessment.capabilities.find(c => c.state === 'evidence_not_observed_within_assessed_scope').observations++,
    b => b.assessment.path = 'private/source.py',
  ]) { const bad = structuredClone(fixture); change(bad); assert.equal(c.AnalyzerCoverageSchema.safeParse(bad).success, false); }
});
test('every coverage reason has a trusted user label; runtime proof is not a declared tier', () => {
  for (const code of c.CoverageReasonSchema.options) assert.equal(typeof c.COVERAGE_REASON_LABELS[code], 'string');
  assert.equal(c.CoverageDepthSchema.safeParse('verified_runtime').success, false);
  const policy = structuredClone(fixture.assessment.declaration.selection); policy.reducedScanOffered = true;
  assert.equal(c.CoverageSelectionPolicySchema.safeParse(policy).success, false);
});
