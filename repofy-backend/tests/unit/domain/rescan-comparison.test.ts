import { beforeEach, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createSyntheticReportFixture } from '@repofy/contracts/testing';
import { ComparisonQuerySchema, ReportViewSchema } from '@repofy/contracts';
import { compareReports, type ComparisonInput, type ComparisonFact } from '../../../src/domain/rescans/comparison';
let input: ComparisonInput;
beforeEach(() => {
  const report = createSyntheticReportFixture();
  const view = ReportViewSchema.parse({ report, aggregation: null, categories: [], capabilities: [], roleDefinitions: [], repositories: report.snapshots.map(s => ({ snapshotId: s.snapshotId, repositoryId: s.repositoryId, visibility: s.repositoryVisibility, access: 'active' })) });
  const target = structuredClone(view); target.report.reportId = randomUUID() as never;
  const facts = report.evidence.map((observation, i) => ({ observation, contentKey: `key:content-${i}`, pathKey: `key:path-${i}` }));
  const targetFacts = structuredClone(facts); targetFacts.forEach(f => f.observation.evidenceId = randomUUID() as never);
  input = { baseline: view, target, baselineFacts: facts, targetFacts, baselineInventory: [], targetInventory: [] };
});
const compare = (query = {}) => compareReports(input, ComparisonQuerySchema.parse({ targetReportId: input.target.report.reportId, ...query }));
it('does not count pure prose, source-line offsets or snapshot symbol IDs as an improvement', () => {
  input.target.report.claims[0].text = 'Different validated narrative wording';
  input.targetFacts[0].observation.observations = ['Different observation phrasing'];
  const diff = compare(); expect(diff.counts.changed).toBe(0); expect(diff.counts.gained).toBe(0); expect(diff.counts.lost).toBe(0);
});
it('renames and moved modules use content plus concept, never a line-offset match', () => {
  input.targetFacts[0].pathKey = 'key:renamed-file';
  const diff = compare(); expect(diff.counts.relocated).toBe(1); expect(diff.evidence.find(e => e.change === 'relocated')!.basis).toBe('content_and_concept');
});
it('ambiguous repeated patterns remain uncertain instead of fabricated gained/lost pairs', () => {
  const clone = (f: ComparisonFact) => ({ ...structuredClone(f), observation: { ...structuredClone(f.observation), evidenceId: randomUUID() as never } });
  input.baselineFacts = [input.baselineFacts[0], clone(input.baselineFacts[0])]; input.targetFacts = [input.targetFacts[0], clone(input.targetFacts[0])];
  const diff = compare(); expect(diff.counts.uncertain).toBe(4); expect(diff.counts.gained + diff.counts.lost).toBe(0);
});
it.each(['detector', 'rubric', 'security', 'truncated', 'metadata', 'revoked'] as const)('qualifies differences when %s availability or version changes', cause => {
  if (cause === 'detector') input.target.report.versions.detectorBundle.version = '2.0.0';
  if (cause === 'rubric') input.target.report.versions.roleRubrics[0].version = '2.0.0';
  if (cause === 'security') input.target.report.versions.ingestionPolicyHash = ('sha256:' + 'a'.repeat(64)) as never;
  if (cause === 'revoked') input.target.repositories[0].access = 'revoked';
  if (cause === 'truncated' || cause === 'metadata') {
    input.target.report.coverage[0].structural = { evidenceTruncated: cause === 'truncated', disabledExtractors: [], sources: [],
      metadata: [{ source: 'checks', state: 'permission_denied', records: 0, exactCommitRecords: 0 }] };
  }
  const diff = compare(); expect(diff.comparability).toBe('limited'); expect(diff.notes.join(' ')).toContain('cannot by themselves establish improvement');
});
it('missing/added repositories are scope changes, with bounded pages and foreign filters rejected', () => {
  const extra = structuredClone(input.target.report.snapshots[0]); extra.repositoryId = randomUUID() as never; extra.snapshotId = randomUUID() as never;
  input.target.report.snapshots.push(extra); input.target.repositories.push({ repositoryId: extra.repositoryId, snapshotId: extra.snapshotId, visibility: extra.repositoryVisibility, access: 'active' });
  expect(compare().causes).toContain('repository_added');
  const page = compare({ limit: 1 }); expect(page.evidence).toHaveLength(1);
  expect(() => compare({ repositoryId: randomUUID() })).toThrow('NOT_FOUND');
  input.target.report.ownerUserId = randomUUID() as never; expect(() => compare()).toThrow('NOT_FOUND');
});
it('rejects facts not attached to either report and never exposes matching fingerprints', () => {
  expect(JSON.stringify(compare())).not.toMatch(/key:content|key:path|contentKey|pathKey/);
  input.targetFacts[0].observation.snapshotId = randomUUID() as never;
  expect(() => compare()).toThrow('ANALYSIS_VALIDATION_FAILED');
});
it('qualifies newly supported detector evidence without attributing analyzer gains to code improvement', () => {
  input.target.report.versions.detectorBundle.version = '2.0.0';
  const next = structuredClone(input.targetFacts[0]); next.observation.evidenceId = randomUUID() as never; next.observation.detector.id = 'new_detector' as never;
  input.targetFacts.push(next);
  const diff = compare(); expect(diff.counts.gained).toBe(1); expect(diff.causes).toContain('detector_changed');
  expect(diff.evidence.find(e => e.change === 'gained')!.interpretation).toBe('limited_by_scope_or_versions');
});
it('metadata signal changes do not invent a permission change', () => {
  input.baseline.report.coverage[0].structural = { evidenceTruncated: false, disabledExtractors: [], sources: [], metadata: [{ source: 'checks', state: 'available', records: 1, exactCommitRecords: 1 }] };
  input.target.report.coverage[0].structural = { evidenceTruncated: false, disabledExtractors: [], sources: [], metadata: [{ source: 'checks', state: 'no_signal', records: 0, exactCommitRecords: 0 }] };
  const diff = compare(); expect(diff.causes).toContain('scope_changed'); expect(diff.causes).not.toContain('metadata_permission_changed');
});
it('keeps equally incomplete scans qualified when counts cannot establish file membership', () => {
  for (const view of [input.baseline, input.target]) {
    view.report.coverage[0].structural = { evidenceTruncated: false, disabledExtractors: [], metadata: [], sources: [
      { source: 'source', eligibleFiles: 10, analyzedFiles: 9, parseFailures: 0, limitedFiles: 1, unsupportedFiles: 0, noSignalFiles: 0 },
    ] };
  }
  const diff = compare();
  expect(diff.causes).toContain('scope_incomplete');
  expect(diff.causes).not.toContain('scope_changed');
  expect(diff.comparability).toBe('limited');
  expect(diff.evidence.every(e => e.interpretation === 'limited_by_scope_or_versions')).toBe(true);
});
