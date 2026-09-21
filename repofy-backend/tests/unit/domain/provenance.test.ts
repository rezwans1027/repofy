import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { observeProvenance, type ProvenanceContext } from '../../../src/domain/provenance/policy';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import cases from '../../fixtures/evidence/provenance.json';
const context = (): ProvenanceContext => ({ snapshotId: randomUUID(), repositoryId: randomUUID(), commitSha: 'a'.repeat(40), providerRepositoryId: '301', visibility: 'private', accountId: randomUUID(), installationId: randomUUID(), totalFiles: 150, generatedMarked: 0, exclusions: { generated: 4, dependency: 7 }, history: { state: 'available', records: 1 }, commits: [{ match: 'connected_identity', relationship: 'exact_commit', parents: 0 }] });
const provider = { state: 'available' as const, fork: true, templateOrigin: 'declared' as const, relationship: 'current_repository_context' as const };
const observe = (c = context()) => observeProvenance(c, provider, '2026-09-20T12:00:00Z');
it.each(cases)('$id: $scenario remains neutral', fixture => {
  const input = { ...context(), totalFiles: fixture.totalFiles, generatedMarked: fixture.generatedMarked, exclusions: fixture.exclusions, history: fixture.history, commits: fixture.commits } as ProvenanceContext;
  const result = observeProvenance(input, fixture.provider as Parameters<typeof observeProvenance>[1], '2026-09-20T12:00:00Z');
  for (const signal of fixture.expectedSignals) expect(result.signals).toContain(signal);
  for (const signal of fixture.absentSignals) expect(result.signals).not.toContain(signal);
  expect(result.contribution.state).toBe(fixture.expectedContribution); expect(result.contribution.strengthModifier).toBeNull(); expect(result.contribution.confidenceModifier).toBeNull();
});
it('fork, template, generated and vendor context never asserts authorship or changes numeric confidence', () => {
  const result = observe(); expect(result.signals).toEqual(expect.arrayContaining(['provider_fork','provider_template_origin','generated_files','vendor_files','possible_bulk_initial_commit']));
  expect(result.contribution).toEqual({ state: 'unknown', confidence: null, confidenceModifier: null, strengthModifier: null, basis: 'context_only_uncalibrated' });
  expect(result.limitations).toEqual(expect.arrayContaining(['not_authorship','not_legal_ownership','not_ai_detection','squash_or_import_possible']));
});
it.each(['truncated','not_requested','permission_denied','provider_unavailable','no_signal'] as const)('history %s remains unknown without a skill penalty', state => {
  const c = context(); c.history = { state, records: 0 }; c.commits = [];
  const result = observe(c); expect(result.signals).not.toContain('possible_bulk_initial_commit'); expect(result.contribution.confidence).toBeNull(); expect(result.contribution.confidenceModifier).toBeNull();
});
it('squash/import shape is only a heuristic and requires a lone exact-commit root and threshold', () => {
  for (const variation of [{ totalFiles: 99 }, { commits: [{ match: 'unavailable', relationship: 'ancestor', parents: 0 }] }, { commits: [{ match: 'unavailable', relationship: 'exact_commit', parents: 1 }] }] as Partial<ProvenanceContext>[]) expect(observe({ ...context(), ...variation }).signals).not.toContain('possible_bulk_initial_commit');
});
it('uses provider-linked identity categories, not author strings/emails or an inferred unique contributor count', () => {
  const c = context(); c.commits.push({ match: 'other_identity', relationship: 'ancestor', parents: 1 }, { match: 'unavailable', relationship: 'ancestor', parents: 1 }); c.history!.records = 3;
  const result = observe(c); expect(result.signals).toContain('multiple_linked_identities'); expect(result.signals).toContain('unlinked_commit_author'); expect(JSON.stringify(result)).not.toMatch(/email|authorName|identityId/);
});
it('a revised aggregation policy retains all capability and role arithmetic while freezing provenance context', async () => {
  const { input } = await extractedAggregation(), before = aggregateEvidence(input), snap = input.snapshots[0];
  const afterInput = structuredClone(input); afterInput.versions.aggregationPolicy.version = '1.1.0';
  afterInput.provenance = { policy: { id: 'provenance_context', version: '1.0.0' }, snapshots: [observe({ ...context(), snapshotId: snap.snapshotId, repositoryId: snap.repositoryId, commitSha: snap.commitSha })] };
  const after = aggregateEvidence(afterInput);
  expect(after.roles).toEqual(before.roles); expect(after.capabilities.map(c => ({ ...c, provenance: undefined }))).toEqual(before.capabilities.map(c => ({ ...c, provenance: undefined })));
  expect(after.policy.version).toBe('1.1.0'); expect(after.provenance).toEqual(afterInput.provenance); expect(before.provenance).toBeUndefined();
  afterInput.provenance.snapshots[0].repositoryId = randomUUID() as never; expect(() => aggregateEvidence(afterInput)).toThrow();
});
