import { expect, it } from 'vitest';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { implementationRepository } from '../../helpers/implementation-fixtures';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';
import { projectReportView } from '../../../src/domain/readiness/reader';

it('discloses unavailable role readiness through the real positive detector-to-report pipeline', async () => {
  const { p, selection, modelRunId } = await narrativeFixture(implementationRepository());
  const report = renderNarrative(p, selection, modelRunId), before = structuredClone(report);
  expect(p.facts.aggregation.capabilities.filter(c => c.state === 'assessed').length).toBeGreaterThan(10);
  const required = p.facts.aggregation.roles.flatMap(r => r.requirements.filter(q => q.required));
  expect(required).toHaveLength(31);
  expect(required.some(q => q.state === 'satisfied')).toBe(false);
  const view = projectReportView({ report, aggregation: p.facts.aggregation, categories: [], capabilities: [], roleDefinitions: [],
    repositories: report.snapshots.map(s => ({ snapshotId: s.snapshotId, repositoryId: s.repositoryId, visibility: s.repositoryVisibility, access: 'active' })) });
  expect(view.roleAvailability).toHaveLength(5);
  expect(view.roleAvailability!.every(r => r.state === 'unavailable' && r.reason === 'required_confidence_unattainable')).toBe(true);
  expect(view.report.roles).toEqual(before.roles);
  expect(view.aggregation).toEqual(p.facts.aggregation);
  expect(report).toEqual(before);
});
