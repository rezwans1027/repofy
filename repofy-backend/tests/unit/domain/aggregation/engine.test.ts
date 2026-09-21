import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AggregationResultSchema } from '@repofy/contracts';
import { aggregateEvidence } from '../../../../src/domain/aggregation/engine';
import { calculateStrength } from '../../../../src/domain/aggregation/policy';
import { matchRole } from '../../../../src/domain/aggregation/roles';
import { strengthBand } from '../../../../src/domain/rubrics/policy';
import { initialRubricCatalog } from '../../../../src/domain/rubrics/catalog';
import { extractedAggregation, aggregationFiles, aggregationInput } from '../../../helpers/aggregation-fixtures';
import { implementationRepository } from '../../../helpers/implementation-fixtures';

const cap = (result: ReturnType<typeof aggregateEvidence>, id: string) => result.capabilities.find(c => c.capabilityId === id)!;
describe('frozen aggregation calculations', () => {
  it('links an independent test to the actual implementation, yielding .65 strength and .55 Low confidence', async () => {
    const { input } = await extractedAggregation(); const result = aggregateEvidence(input); const retry = cap(result, 'performance_resources');
    expect(retry).toMatchObject({ strength: .65, strengthBand: 'strong', confidence: .55, confidenceLabel: 'low', provenance: { state: 'unknown', value: null } });
    expect(retry.trace.clusters[0].corroboration).toHaveLength(1);
    expect(retry.allowedClaimScopes).toEqual(['repository_behavior']); expect(retry.allowedClaimScopes).not.toContain('tested_behavior');
    expect(result.capabilities).toHaveLength(34); expect(result.roles).toHaveLength(5);
    expect(result.validation).toEqual([]); expect(AggregationResultSchema.safeParse(result).success).toBe(true);
  });
  it('is invariant under all input ordering and collapses exact, content, shape and concept duplicates', async () => {
    const { input } = await extractedAggregation(); const initial = aggregateEvidence(input);
    input.snapshots.reverse(); input.snapshots.forEach(s => s.files.reverse()); input.evidence.reverse();
    expect(aggregateEvidence(input)).toEqual(initial);
    const copied = structuredClone(input.evidence.find((e: any) => e.observation.implementation?.kind === 'bounded_retry')) as any;
    input.evidence.push(structuredClone(copied));
    for (let n = 0; n < 40; n++) { const next = structuredClone(copied); next.observation.evidenceId = randomUUID(); input.evidence.push(next); }
    const after = cap(aggregateEvidence(input), 'performance_resources');
    expect(after.strength).toBe(.65); expect(after.trace.clusters).toHaveLength(1); expect(after.confidence).toBe(.55);
  });
  it('gives no extra strength or implementation independence for copied repositories', async () => {
    const a = await extractedAggregation(), b = await extractedAggregation();
    const combined = aggregateEvidence(aggregationInput([a.bundle, b.bundle]));
    expect(cap(combined, 'performance_resources').strength).toBe(.65);
    expect(cap(combined, 'performance_resources').trace.clusters).toHaveLength(2);
    expect(combined.roles.find(r => r.template.roleId === 'backend')!.coverage).toBe(.0325);
  });
  it('never upgrades repeated dependencies or unlinked documentation/configuration to implementation', async () => {
    const { input } = await extractedAggregation({ 'package.json': aggregationFiles['package.json'], 'README.md': '# Architecture\nText\n', 'Dockerfile': 'FROM node:22\nRUN npm test' });
    const dependency = input.evidence.find((e: any) => e.observation.sourceType === 'dependency') as any;
    for (let n = 0; n < 100; n++) { const copy = structuredClone(dependency); copy.observation.evidenceId = randomUUID(); input.evidence.push(copy); }
    const result = aggregateEvidence(input);
    expect(cap(result, 'framework_presence').strength).toBe(.2); expect(cap(result, 'framework_presence').strengthBand).toBe('limited');
    expect(cap(result, 'delivery_reproducibility').strength).toBe(.3);
    expect(cap(result, 'documentation_decisions').allowedClaimScopes).toEqual([]);
    expect(result.roles.every(r => r.coverage === null || r.coverage === 0)).toBe(true);
  });
  it('does not corroborate mocked, unrelated, same-file, or unresolved tests', async () => {
    for (const test of [
      `import {test,expect,vi} from 'vitest';import {retry} from './retry';vi.mock('./retry');test('mock',()=>{expect(retry()).toBeDefined();});`,
      `import {test,expect} from 'vitest';import {add} from './service';test('unrelated',()=>{expect(add(1)).toBe(2);});`,
      `import {test,expect} from 'vitest';import {retry} from './missing';test('missing',()=>{expect(retry()).toBeDefined();});`,
    ]) { const { input } = await extractedAggregation({ ...aggregationFiles, 'retry.test.ts': test });
      expect(cap(aggregateEvidence(input), 'performance_resources').strength).toBe(.55); }
  });
  it('retains unknown weights and compound minima with the independently calculated 2.75% example', async () => {
    const { input } = await extractedAggregation({ 'app.swift': 'struct App {}' }); const result = aggregateEvidence(input);
    expect(result.roles.every(r => r.state === 'unknown' && r.coverage === null && r.confidence === null && r.unknownWeight === 1)).toBe(true);
    const valid = aggregateEvidence((await extractedAggregation({ ...aggregationFiles, 'retry.test.ts': '' })).input);
    const performance = cap(valid, 'performance_resources');
    performance.trace.coverage.forEach(c => { c.fraction = 1; });
    const caps = result.capabilities.map(c => c.capabilityId === 'performance_resources' ? performance : c);
    const backend = matchRole(initialRubricCatalog.rubrics.find(r => r.roleId === 'backend')!, caps);
    expect(backend).toMatchObject({ coverage: .0275, denominator: 1, numerator: .0275, assessableFraction: .05, unknownWeight: .95 });
    expect(backend.requirements.find(r => r.requirementId === 'api_design')!.state).toBe('unknown');
    expect(backend.gaps[0].impact).toBe(.15);
  });
  it.each([0, .199999, .2, .399999, .4, .649999, .65, .849999, .85, 1].map((n, i) => [n, ['not_observed','not_observed','limited','limited','moderate','moderate','strong','strong','very_strong','very_strong'][i]] as const))('preserves PRD band at %s', (strength, key) => {
    expect(strengthBand(initialRubricCatalog.taxonomy.strengthPolicy, { state: 'assessed', strength }).key).toBe(key);
  });
  it('caps and diminishes independent family bonuses without manufacturing stronger current detectors', () => {
    expect(calculateStrength(.55, false, 1)).toBe(.65); expect(calculateStrength(.55, false, 4)).toBe(.7375);
    expect(calculateStrength(.75, false, 2)).toBe(.9); expect(calculateStrength(.9, false, 4)).toBe(1);
    expect(calculateStrength(.2, true, 4)).toBe(.2); expect(calculateStrength(.55, true, 4)).toBe(.39);
    for (const value of [-1, 1.01, NaN, Infinity]) expect(() => calculateStrength(value, false, 0)).toThrow();
    expect(() => calculateStrength(.55, false, 5)).toThrow();
  });
  it('separates achieved absence from unsupported semantics and lowers completeness for omitted files', async () => {
    const good = aggregateEvidence((await extractedAggregation()).input);
    const limited = aggregateEvidence((await extractedAggregation({ ...aggregationFiles, 'bad.ts': 'function broken( {', 'ignored.pem': 'private' })).input);
    expect(cap(limited, 'performance_resources').strength).toBe(.65);
    expect(cap(limited, 'performance_resources').confidence).toBeLessThan(cap(good, 'performance_resources').confidence!);
    expect(limited.roles.find(r => r.template.roleId === 'backend')!.assessableFraction).toBeLessThan(good.roles.find(r => r.template.roleId === 'backend')!.assessableFraction);
    expect(cap(good, 'security_authorization').state).toBe('not_observed');
    expect(cap(good, 'mobile_lifecycle')).toMatchObject({ state: 'unknown', strength: null, confidence: null, evidenceIds: [] });
  });
  it('validates real Run 9 patterns and rejects foreign, conflicting, malformed and inflated evidence safely', async () => {
    const { input } = await extractedAggregation(implementationRepository()); const baseline = aggregateEvidence(input); expect(baseline.validation).toEqual([]);
    const valid = input.evidence.find((e: any) => e.observation.implementation) as any;
    for (const [code, change] of [
      ['foreign_evidence', (e: any) => e.observation.repositoryId = randomUUID()],
      ['version_mismatch', (e: any) => e.observation.strength = 1],
      ['unsupported_mapping', (e: any) => { delete e.observation.implementation; }],
      ['invalid_shape', (e: any) => e.observation.secret = 'PRIVATE_CANARY'],
      ['invalid_relation', (e: any) => { e.observation.implementation.relations = [{ fileId: randomUUID(), symbolId: randomUUID(), conceptId: randomUUID(), lines: { start: 1, end: 1 }, relationship: 'local_call', independence: 'same_source' }]; }],
    ] as const) { const clone = structuredClone(input), bad = structuredClone(valid); bad.observation.evidenceId = randomUUID(); change(bad); clone.evidence.push(bad);
      const result = aggregateEvidence(clone); expect(result.validation).toContainEqual({ code, count: 1 }); expect(JSON.stringify(result)).not.toContain('PRIVATE_CANARY'); }
    const conflicting = structuredClone(valid); conflicting.observation.strength = .1; input.evidence.push(conflicting);
    expect(aggregateEvidence(input).validation).toContainEqual({ code: 'duplicate_id_conflict', count: 1 });
  });
  it('rejects policy/taxonomy/rubric and run snapshot dependency mismatches', async () => {
    const { input } = await extractedAggregation();
    for (const change of [(x: any) => x.versions.aggregationPolicy.version = '1.0.1', (x: any) => x.versions.taxonomy.version = '1.0.1',
      (x: any) => x.versions.roleRubrics[0].version = '1.0.1', (x: any) => x.snapshots[0].coverage.manifestVersion = '1.0.0',
      (x: any) => x.snapshots.push(structuredClone(x.snapshots[0])), (x: any) => x.catalog.taxonomy.capabilities[0].label = 'Changed']) {
      const copy = structuredClone(input); change(copy); expect(() => aggregateEvidence(copy)).toThrow('ANALYSIS_VALIDATION_FAILED'); }
  });
});

it('keeps missing metadata and provenance neutral, and reports contradictory exact-commit results without credit', async () => {
  const { coverageFixture } = await import('../../../helpers/coverage-fixtures');
  const { emptyMetadata, providerDetail } = await import('../../../../src/domain/extraction/metadata');
  const f = await coverageFixture(aggregationFiles);
  try {
    const options = { commits: true, pullRequests: false, ci: true }, date = '2026-09-20T00:00:00Z';
    const metadata = emptyMetadata(f.input.pin.repositoryId, f.input.pin.commitSha, options);
    metadata.groups.find(g => g.coverage.source === 'commits')!.coverage.state = 'permission_denied';
    const missing = aggregateEvidence(aggregationInput([(await f.extract({ options, metadata })).bundle]));
    expect(cap(missing, 'provenance_history')).toMatchObject({ state: 'unknown', confidence: null });
    expect(cap(missing, 'performance_resources')).toMatchObject({ strength: .65, provenance: { state: 'unknown', value: null } });
    const checks = metadata.groups.find(g => g.coverage.source === 'checks')!;
    checks.coverage = { source: 'checks', state: 'available', records: 2, exactCommitRecords: 2, retrievedAt: date };
    checks.records = ['success', 'failure'].map((result, i) => ({ objectId: `check_${i}`, detail: providerDetail('check', {
      retrievedAt: date, subjectSha: f.input.pin.commitSha, relationship: 'exact_commit', result: result as 'success' | 'failure', authorMatch: 'unavailable', authorType: 'unknown',
    }) }));
    const conflicts = aggregateEvidence(aggregationInput([(await f.extract({ options, metadata })).bundle]));
    expect(conflicts.validation).toEqual([]); expect(conflicts.limitations).toContain('conflicting_metadata');
    expect(cap(conflicts, 'performance_resources').strength).toBe(.65);
    expect(cap(conflicts, 'performance_resources').confidence).toBe(cap(missing, 'performance_resources').confidence);
    const { input } = await extractedAggregation();
    for (const e of input.evidence as any[]) e.observation.contribution = { state: 'assessed', confidence: 1, signals: ['history_consistent'], limitations: [] };
    const reserved = cap(aggregateEvidence(input), 'performance_resources');
    expect(reserved.uncertainty).toContain('provenance_not_applied'); expect(reserved.provenance.value).toBeNull(); expect(reserved.confidence).toBe(.55);
  } finally { await f.cleanup(); }
});
it('preserves reduced-scan, parser quarantine, legacy unknowns and disabled-detector exclusions', async () => {
  const { coverageFixture } = await import('../../../helpers/coverage-fixtures');
  const { coverageProfile } = await import('../../../../src/domain/coverage/manifest');
  const reduced = await extractedAggregation(Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`file${String(i).padStart(3, '0')}.ts`, 'export const value=1;'])));
  const reducedCap = cap(aggregateEvidence(reduced.input), 'performance_resources');
  expect(reducedCap.trace.coverage[0].reasons).toContain('reduced_scan'); expect(reducedCap.trace.coverage[0].fraction).toBe(.996109);
  const f = await coverageFixture({ 'app.py': 'def run():\n return 1\n' }, ['python']);
  try { const result = aggregateEvidence(aggregationInput([(await f.extract()).bundle])); expect(result.roles.every(r => r.coverage === null)).toBe(true);
    expect(cap(result, 'language_presence').trace.coverage[0].reasons).toContain('parser_disabled'); }
  finally { await f.cleanup(); }
  const { input } = await extractedAggregation(); const legacy = structuredClone(input);
  delete legacy.snapshots[0].coverage.assessment;
  const old = aggregateEvidence(legacy); expect(old.roles.every(r => r.coverage === null)).toBe(true); expect(old.limitations).toContain('invalid_evidence_excluded');
  const profile = coverageProfile([], ['bounded_retry']);
  input.versions.detectorBundle = profile.detectorBundle;
  const coverage = input.snapshots[0].coverage; coverage.detectorBundle = profile.detectorBundle;
  coverage.implementation!.bundle = profile.detectorBundle; coverage.implementation!.disabledDetectors.push('bounded_retry');
  const detector = coverage.implementation!.detectors.find(d => d.kind === 'bounded_retry')!; detector.state = 'quarantined'; detector.observations = 0;
  expect(aggregateEvidence(input).validation).toContainEqual({ code: 'quarantined_detector', count: 1 });
});
it('enforces component ALL semantics and exact strength, confidence and independent-support minima', async () => {
  const all = aggregateEvidence((await extractedAggregation(implementationRepository())).input).capabilities;
  const backend = initialRubricCatalog.rubrics.find(r => r.roleId === 'backend')!;
  const api = all.find(c => c.capabilityId === 'api_design')!, boundary = all.find(c => c.capabilityId === 'api_boundary_validation')!;
  // Isolated hand-authored requirement inputs test the Run 03 contract; these are not production detector calibration.
  for (const c of [api, boundary]) {
    c.strength = .55; c.confidence = .55; c.confidenceLabel = 'moderate';
    c.trace.clusters[0].corroboration = [{ sourceType: 'test', evidenceId: c.support[0].evidenceId, rank: 1, bonus: .1 }];
    c.trace.selectedClusterId = c.trace.clusters[0].clusterId;
    c.support.push({ ...c.support[0], clusterId: 'independent.test', sourceType: 'test', basis: 'corroboration' });
  }
  const requirement = () => matchRole(backend, all).requirements.find(q => q.requirementId === 'api_design')!;
  expect(requirement()).toMatchObject({ state: 'satisfied', strength: .55, weightedContribution: .0825 });
  api.strength = .549999; expect(requirement().failures[0].reasons).toContain('insufficient_strength');
  api.strength = .55; boundary.confidenceLabel = 'low'; expect(requirement().failures[0].reasons).toContain('insufficient_confidence');
  boundary.confidenceLabel = 'moderate'; boundary.trace.clusters[0].corroboration = []; boundary.support = boundary.support.filter(s => s.basis !== 'corroboration');
  expect(requirement().failures[0].reasons).toContain('independent_corroboration_required');
});
it('uses the reliability of the actual linked test and never transfers its bonus to a stronger same-shape observation', async () => {
  const { input } = await extractedAggregation();
  const test = input.evidence.find((e: any) => e.observation.implementation?.kind === 'asserted_call') as any;
  test.observation.confidence = .1;
  expect(cap(aggregateEvidence(input), 'performance_resources')).toMatchObject({ strength: .65, confidence: .15 });
  const original = input.evidence.find((e: any) => e.observation.implementation?.kind === 'bounded_retry') as any;
  const copy = structuredClone(original); copy.observation.evidenceId = randomUUID(); copy.observation.implementation.conceptId = randomUUID();
  copy.observation.implementation.symbolId = randomUUID(); copy.observation.implementation.span.startColumn++; input.evidence.push(copy);
  // The .55 untested base and .40 tested observation share only a normalized AST shape.
  original.observation.strength = .4;
  expect(cap(aggregateEvidence(input), 'performance_resources')).toMatchObject({ strength: .55, confidence: .55 });
});
