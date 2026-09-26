import { expect, it } from 'vitest';
import { ComparisonQuerySchema, roleAvailability } from '@repofy/contracts';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { rolePortfolio, unknownRolePortfolio, weakRolePortfolio } from '../../helpers/role-portfolios';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';
import { projectReportView } from '../../../src/domain/readiness/reader';
import { compareReports } from '../../../src/domain/rescans/comparison';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';

async function view(files: Record<string, string>) {
  const { p, selection, modelRunId } = await narrativeFixture(files, '2.0.0');
  const report = renderNarrative(p, selection, modelRunId);
  return projectReportView({ report, aggregation: p.facts.aggregation, categories: [], capabilities: [], roleDefinitions: [],
    repositories: report.snapshots.map(s => ({ snapshotId: s.snapshotId, repositoryId: s.repositoryId, visibility: s.repositoryVisibility, access: 'active' })) });
}
it('delivers bounded provisional coverage for all five roles from real source with unchanged minima and unknowns', async () => {
  const result = await view(rolePortfolio());
  expect(result.roleAvailability).toHaveLength(5);
  expect(result.roleAvailability!.every(r => r.state === 'provisional' && r.reason === 'calibration_pending')).toBe(true);
  const caps = result.aggregation!.capabilities;
  expect(caps.find(c => c.capabilityId === 'reliability_recovery')).toMatchObject({ strength: .65, confidence: .55, confidenceLabel: 'moderate' });
  expect(caps.find(c => c.capabilityId === 'reliability_concurrency')).toMatchObject({ strength: .55, confidenceLabel: 'moderate' });
  expect(caps.find(c => c.capabilityId === 'mobile_lifecycle')).toMatchObject({ state: 'unknown', strength: null, confidence: null });
  for (const role of result.aggregation!.roles) {
    expect(role.coverage).toBeGreaterThan(0);
    expect(role.unknownWeight).toBeGreaterThan(0);
    expect(role.requirements.filter(r => r.required).every(r => r.minimumConfidence === 'moderate' && r.minimumEvidence === .55)).toBe(true);
  }
  for (const id of ['backend', 'full_stack', 'ai_application']) expect(result.aggregation!.roles.find(r => r.template.roleId === id)!.requirements.find(r => r.requirementId === 'reliability_recovery')!.state).toBe('satisfied');
  expect(result.aggregation!.roles.find(r => r.template.roleId === 'frontend')!.requirements.find(r => r.requirementId === 'frontend_interaction')!.failures).toContainEqual({ capabilityId: 'frontend_interaction', reasons: ['independent_corroboration_required'] });
  // Mobile/core-native and compound requirements do not become satisfied by a shared UI observation.
  expect(result.aggregation!.roles.find(r => r.template.roleId === 'mobile')!.requirements.filter(r => r.required).every(r => r.state !== 'satisfied')).toBe(true);
  expect(caps.every(c => c.confidenceLabel !== 'high')).toBe(true);
});
it('keeps weak patterns below required thresholds and unsupported portfolios unknown across all roles', async () => {
  const weak = await view(weakRolePortfolio), unknown = await view(unknownRolePortfolio);
  expect(weak.aggregation!.roles.flatMap(r => r.requirements).filter(r => r.required).every(r => r.state !== 'satisfied')).toBe(true);
  expect(unknown.aggregation!.roles.every(r => r.state === 'unknown' && r.coverage === null && r.confidence === null && r.unknownWeight === 1)).toBe(true);
  expect(roleAvailability(unknown.report).every(r => r.state === 'unknown')).toBe(true);
});
it('attributes a rescan gain to independent test evidence and withholds deltas across policy versions', async () => {
  const baseline = await view(rolePortfolio(false)), target = await view(rolePortfolio(true));
  // The extraction fixtures allocate identities separately; map their identical repository to the baseline.
  const sid = baseline.report.snapshots[0], old = target.report.snapshots[0];
  const raw = JSON.stringify(target).replaceAll(target.report.ownerUserId, baseline.report.ownerUserId).replaceAll(old.repositoryId, sid.repositoryId).replaceAll(old.commitSha, 'b'.repeat(40));
  const next = JSON.parse(raw) as typeof target;
  const facts = (v: typeof target) => v.report.evidence.map(observation => ({ observation, contentKey: null, pathKey: `fixture:${observation.detector.id}` }));
  const compare = () => compareReports({ baseline, target: next, baselineFacts: facts(baseline), targetFacts: facts(next), baselineInventory: [], targetInventory: [] }, ComparisonQuerySchema.parse({ targetReportId: next.report.reportId }));
  const diff = compare();
  expect(diff.comparability).toBe('comparable');
  expect(diff.roles.find(r => r.roleId === 'backend')!.coverageDelta).toBeGreaterThan(0);
  expect(diff.evidence.some(e => e.change === 'gained' && e.detector === 'tsjs.asserted_call')).toBe(true);
  expect(diff.notes.join(' ')).toContain('provisional evidence coverage');
  next.report.versions.aggregationPolicy.version = '1.0.0';
  expect(compare().roles.every(r => r.coverageDelta === null && r.confidenceDelta === null)).toBe(true);
});
it.each(['parser_failure', 'resolution_incomplete', 'detector_disabled', 'evidence_budget_exhausted'] as const)('does not qualify Moderate when captured scope has %s', async reason => {
  const { input } = await extractedAggregation(rolePortfolio()); input.versions.aggregationPolicy.version = '2.0.0';
  const scope = input.snapshots[0].coverage.assessment!.capabilities.find(c => c.capabilityId === 'reliability_recovery')!;
  scope.reasons.push(reason);
  expect(aggregateEvidence(input).capabilities.find(c => c.capabilityId === scope.capabilityId)!.confidenceLabel).toBe('low');
});
it('retains Low for excluded source, invalid observations and presence-only evidence', async () => {
  const { input } = await extractedAggregation({ ...rolePortfolio(), 'vendor/unused.ts': 'export const other=1' });
  input.versions.aggregationPolicy.version = '2.0.0';
  expect(aggregateEvidence(input).capabilities.filter(c => c.state === 'assessed').every(c => c.confidenceLabel === 'low')).toBe(true);
  const complete = (await extractedAggregation(rolePortfolio())).input; complete.versions.aggregationPolicy.version = '2.0.0'; complete.evidence.push({ invalid: true });
  expect(aggregateEvidence(complete).capabilities.find(c => c.capabilityId === 'reliability_recovery')!.confidenceLabel).toBe('low');
});
