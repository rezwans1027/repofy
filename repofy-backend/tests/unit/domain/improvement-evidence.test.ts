import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ReportViewSchema, improvementEvidenceReferences, type ReportView } from '@repofy/contracts';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { implementedRolePortfolio } from '../../helpers/role-coverage-v3';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';
import { projectReportView, ReadinessReader } from '../../../src/domain/readiness/reader';

async function fixture() {
  const { p, selection, modelRunId } = await narrativeFixture(implementedRolePortfolio(undefined, false), '3.0.0');
  const report = renderNarrative(p, selection, modelRunId);
  const raw: ReportView = { report, aggregation: p.facts.aggregation, categories: [], capabilities: [], roleDefinitions: [],
    repositories: report.snapshots.map(s => ({ snapshotId: s.snapshotId, repositoryId: s.repositoryId, visibility: 'private', access: 'active' })) };
  return raw;
}
it('projects relevant file evidence for limited observations without mutating a saved report or disclosing paths', async () => {
  const raw = await fixture();
  raw.report.evidence[0].location = { label: 'PRIVATE_PATH_SENTINEL' };
  raw.report.improvements[0].permittedLocations = [{ snapshotId: raw.report.snapshots[0].snapshotId, location: { label: 'PRIVATE_PATH_SENTINEL' } }];
  const before = structuredClone(raw), view = projectReportView(raw);
  expect(raw).toEqual(before);
  expect(JSON.stringify(view)).not.toContain('PRIVATE_PATH_SENTINEL');
  expect(view.improvementEvidence!.length).toBeGreaterThan(0);
  for (const reference of view.improvementEvidence!) {
    const improvement = view.report.improvements.find(i => i.improvementId === reference.improvementId)!;
    expect(improvement.permittedLocations).toEqual([]);
    expect(view.report.gaps.some(g => improvement.gapIds.includes(g.gapId) && g.state === 'limited_evidence')).toBe(true);
    for (const id of reference.evidenceIds) {
      const evidence = view.report.evidence.find(e => e.evidenceId === id)!;
      expect(evidence.repositoryVisibility).toBe('private');
      expect(improvement.repositoryIds).toContain(evidence.repositoryId);
      expect(evidence.capabilityIds.some(id => improvement.capabilityIds.includes(id))).toBe(true);
    }
  }
});
it('does not propose files for unknown, unobserved or unsupported evidence', async () => {
  const raw = await fixture(), view = projectReportView(raw);
  const unobserved = view.report.improvements.filter(i => i.gapIds.every(id => view.report.gaps.find(g => g.gapId === id)!.state !== 'limited_evidence'));
  expect(unobserved.length).toBeGreaterThan(0);
  expect(unobserved.every(i => !view.improvementEvidence!.some(r => r.improvementId === i.improvementId))).toBe(true);
  expect(improvementEvidenceReferences(view.report, null)).toEqual([]);
  expect(improvementEvidenceReferences({ ...view.report, evidence: [] }, view.aggregation)).toEqual([]);
  const metadata = structuredClone(view.report);
  metadata.evidence.forEach(e => { e.sourceType = 'commit'; });
  expect(improvementEvidenceReferences(metadata, view.aggregation)).toEqual([]);
});
it('rejects foreign, duplicate or unrelated references in the report view contract', async () => {
  const view = projectReportView(await fixture()), reference = view.improvementEvidence![0];
  const unrelated = view.report.evidence.find(e => !reference.evidenceIds.includes(e.evidenceId))!;
  for (const changed of [
    [{ ...reference, improvementId: randomUUID() }],
    [{ ...reference, evidenceIds: [randomUUID()] }],
    [{ ...reference, evidenceIds: [unrelated.evidenceId] }],
    [...view.improvementEvidence!, reference],
  ]) expect(ReportViewSchema.safeParse({ ...view, improvementEvidence: changed }).success).toBe(false);
});
it('keeps revoked references opaque and leaves all location authorization to the live endpoint', async () => {
  const raw = await fixture(); raw.repositories.forEach(r => { r.access = 'revoked'; });
  const rpc = vi.fn(async () => ({ data: raw, error: null }));
  const crypto = vi.fn(() => { throw new Error('Must not decrypt on report reads'); });
  const verifyRepository = vi.fn();
  const reader = new ReadinessReader({ rpc }, crypto, { verifyRepository });
  const view = await reader.view(raw.report.ownerUserId, raw.report.reportId);
  expect(view.improvementEvidence!.length).toBeGreaterThan(0);
  expect(view.repositories.every(r => r.access === 'revoked')).toBe(true);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('feature_one_report_view', { p_actor: raw.report.ownerUserId, p_report: raw.report.reportId });
  expect(crypto).not.toHaveBeenCalled(); expect(verifyRepository).not.toHaveBeenCalled();
});
