import { expect, it, vi } from 'vitest';
import Module from 'node:module';
import { coverageFixture } from '../../helpers/coverage-fixtures';
import { languageMatrix, pythonSource, pom } from '../../fixtures/evidence/language-coverage';
import { coverageDeclaration, coverageProfile } from '../../../src/domain/coverage/manifest';
import { baselineTree, extractBaseline } from '../../../src/domain/extraction/baseline';
import { SnapshotBundleSchema } from '../../../src/domain/analysis/persistence';
import { implementationRepository } from '../../helpers/implementation-fixtures';
import { ImplementationPass } from '../../../src/domain/detectors/pass';
import { ParseFailure } from '../../../src/domain/extraction/policy';
import { randomUUID } from 'node:crypto';
import * as rules from '../../../src/domain/detectors/rules';
import structuralFixtures from '../../fixtures/evidence/repositories.json';

for (const sample of languageMatrix) it(`records honest achieved coverage: ${sample.name}`, async () => {
  const f = await coverageFixture(sample.files); try {
    const { bundle } = await f.extract(); const achieved = bundle.coverage.assessment!;
    expect(achieved.counts).toMatchObject({ analyzedFiles: sample.analyzed, unparsedFiles: sample.unparsed });
    expect(achieved.counts.totalFiles).toBe(Object.keys(sample.files).length);
    expect(achieved.capabilities).toHaveLength(34);
    expect(bundle.evidence.every(e => e.capabilityIds.length === 0)).toBe(true);
    expect(achieved.capabilities.find(c => c.capabilityId === 'mobile_lifecycle')).toMatchObject({ state: 'not_assessable', observations: 0 });
    expect(achieved.capabilities.find(c => c.capabilityId === 'ai_evaluation')).toMatchObject({ state: 'not_assessable', observations: 0 });
    if (['empty', 'excluded_only', 'native_mobile', 'malformed', 'no_meaningful_source'].includes(sample.name)) expect(achieved.result).toBe('insufficient_evidence');
    expect(JSON.stringify(bundle.coverage)).not.toMatch(/Calculator|org\.junit|from app|def calculate|class App/);
    if (sample.name === 'mixed') {
      expect(achieved.capabilities.find(c => c.capabilityId === 'data_modeling')).toMatchObject({ state: 'partially_assessable', observations: 1 });
      expect(achieved.capabilities.find(c => c.capabilityId === 'delivery_automation')).toMatchObject({ state: 'partially_assessable', observations: 1 });
    }
    if (sample.name.endsWith('multi')) expect(bundle.inventorySummary.structural!.projectManifests).toBe(2);
    if (sample.name === 'python_single') expect(bundle.evidence.find(e => e.structural?.kind === 'structure')!.structural!.counts).toMatchObject({ classes: 1, functions: 2, imports: 1 });
    if (sample.name === 'java_single') expect(bundle.evidence.find(e => e.structural?.kind === 'dependency')!.structural).toMatchObject({ technologies: ['junit', 'spring'], counts: { production: 1, development: 1 } });
  } finally { await f.cleanup(); }
});
it('retains the TS/JS ecosystem inventory while dynamic Next configuration stays an unresolved declaration', async () => {
  const f = await coverageFixture(structuralFixtures.monorepo); try {
    const { bundle } = await f.extract(); const a = bundle.coverage.assessment!;
    expect(a.declaration.entries.map(entry => entry.id)).toEqual(expect.arrayContaining(['tsjs', 'react', 'express_node', 'next', 'database', 'selected_tests', 'static_configuration', 'containers', 'github_actions', 'documentation']));
    expect(bundle.coverage.structural!.sources.filter(s => s.analyzedFiles > 0).map(s => s.source)).toHaveLength(7);
    expect(bundle.inventorySummary.frameworks).toContainEqual({ name: 'next', basis: 'configuration' });
    expect(a.reasons).toEqual(expect.arrayContaining(['dynamic_configuration', 'security_exclusions', 'parser_failure', 'unsupported_depth']));
    expect(bundle.files.find(f => f.locator.kind === 'file' && f.locator.path === 'next.config.ts')!.structure!.coverage).toMatchObject({ implementation: 'not_applicable', reasons: ['dynamic_configuration'] });
    expect((globalThis as { __repofyExecuted?: boolean }).__repofyExecuted).toBeUndefined();
    expect(JSON.stringify(bundle.coverage)).not.toContain('PRIVATE_PROSE_SENTINEL');
  } finally { await f.cleanup(); }
});
it('preserves all Run 9 patterns under the new profile and records actual per-language execution', async () => {
  const f = await coverageFixture({ ...implementationRepository(), 'other.py': pythonSource }); try {
    const { bundle } = await f.extract(); expect((await f.extract()).bundle).toEqual(bundle);
    expect(new Set(bundle.evidence.filter(e => e.implementation).map(e => e.implementation!.kind)).size).toBe(16);
    expect(bundle.coverage.assessment!.languages.find(l => l.language === 'typescript')).toMatchObject({ depth: 'bounded_patterns', implementationAnalyzedFiles: 30 });
    expect(bundle.coverage.assessment!.languages.find(l => l.language === 'python')).toMatchObject({ depth: 'baseline', implementationAnalyzedFiles: 0 });
    expect(bundle.coverage.assessment!.capabilities.find(c => c.capabilityId === 'security_authorization')).toMatchObject({ eligibleFiles: 33, analyzedFiles: 32, unparsedFiles: 1 });
  } finally { await f.cleanup(); }
});
it('does not turn unsupported scope into evidence-not-observed, or absence into lack of skill', async () => {
  const f = await coverageFixture({ 'plain.ts': 'export const value = 1;', 'native.swift': 'struct Value {}' }); try {
    const { bundle } = await f.extract();
    expect(bundle.coverage.assessment!.capabilities.find(c => c.capabilityId === 'api_design')).toMatchObject({ state: 'evidence_not_observed_within_assessed_scope', eligibleFiles: 2, analyzedFiles: 1, observations: 0 });
    expect(bundle.coverage.assessment!.capabilities.find(c => c.capabilityId === 'mobile_offline')).toMatchObject({ state: 'not_assessable', confidenceCeiling: 0 });
  } finally { await f.cleanup(); }
});
it('freezes parser quarantine in a different manifest and refuses stale/missing achieved coverage', async () => {
  const f = await coverageFixture({ 'app.py': pythonSource, 'large.py': ' '.repeat(262145) }); try {
    const { bundle } = await f.extract(); const profile = coverageProfile(['python']);
    await expect(f.extract({ profile })).rejects.toMatchObject({ code: 'ANALYSIS_VALIDATION_FAILED' });
    const disabled = (await f.extract({ profile, versions: { ...f.input.versions, extractorBundle: profile.extractorBundle, coverageManifest: profile.coverageManifest } })).bundle;
    expect(disabled.snapshot.snapshotId).not.toBe(bundle.snapshot.snapshotId);
    expect(disabled.coverage.assessment!.reasons).toContain('parser_disabled'); expect(disabled.inventorySummary.analyzedFiles).toBe(0);
    expect(disabled.files.every(f => f.structure?.processing === 'unsupported' && f.structure.coverage?.reasons.includes('parser_disabled'))).toBe(true);
    for (const change of [
      (b: any) => b.coverage.assessment.counts.analyzedFiles++, (b: any) => b.coverage.assessment.declaration.entries[0].confidenceCeiling = 1,
      (b: any) => b.coverage.assessment.capabilities.at(-1).state = 'assessable', (b: any) => delete b.coverage.assessment,
      (b: any) => b.coverage.assessment.capabilities.find((c: any) => c.capabilityId === 'mobile_lifecycle').observations = 1,
    ]) { const bad = structuredClone(bundle); change(bad); expect(SnapshotBundleSchema.safeParse(bad).success).toBe(false); }
    expect(() => coverageProfile(['python', 'python'])).toThrow(); expect(coverageDeclaration(['java']).entries.find(e => e.id === 'java')!.depth).toBe('unsupported');
  } finally { await f.cleanup(); }
});
it('keeps the denominator when difficult files are excluded', async () => {
  const before = await coverageFixture({ 'good.py': pythonSource, 'bad.py': 'def bad(:' });
  const after = await coverageFixture({ 'good.py': pythonSource, 'bad.py': 'def bad(:', '.repofyignore': 'bad.py\n' });
  try { const a = (await before.extract()).bundle.coverage.assessment!, b = (await after.extract()).bundle.coverage.assessment!;
    expect(b.counts.analyzedFiles).toBe(a.counts.analyzedFiles); expect(b.counts.analyzedFractionOfAllFiles).toBeLessThanOrEqual(a.counts.analyzedFractionOfAllFiles!);
    expect(b.counts.excludedFiles).toBe(2); expect(b.reasons).toContain('security_exclusions');
  } finally { await before.cleanup(); await after.cleanup(); }
});
it('records bounded implementation selection explicitly and retains all inventory files', async () => {
  const f = await coverageFixture(Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`file${String(i).padStart(3, '0')}.ts`, 'export const x = 1;']))); try {
    const { bundle } = await f.extract(); expect(bundle.coverage.assessment!.counts).toMatchObject({ totalFiles: 257, analyzedFiles: 257 });
    expect(bundle.coverage.implementation).toMatchObject({ analyzedFiles: 256, limitedFiles: 1 });
    expect(bundle.coverage.assessment!.reasons).toContain('reduced_scan');
    expect(bundle.coverage.assessment!.capabilities.find(c => c.capabilityId === 'api_design')).toMatchObject({ eligibleFiles: 257, analyzedFiles: 256, unparsedFiles: 1 });
  } finally { await f.cleanup(); }
});
it('bounds nesting/nodes, refuses recovered syntax and never executes source', () => {
  for (const [language, text] of [['python', 'value=' + '['.repeat(100) + '0' + ']'.repeat(100)], ['java', 'class A {' + 'int x;'.repeat(5000) + '}']] as const) expect(() => baselineTree(text, language)).toThrow();
  expect(() => baselineTree('def broken(: pass', 'python')).toThrow();
  const sentinel = 'open("/tmp/repofy-must-not-execute", "w").write("no")\n';
  expect(extractBaseline({ path: 'setup.py', text: sentinel, language: 'python', classification: 'code' }, []).state).toBe('analyzed');
  const clock = vi.spyOn(performance, 'now'); try { let now = 0; clock.mockImplementation(() => now += 2000); expect(() => baselineTree(pythonSource, 'python')).toThrow('WORKER_EXPIRED'); } finally { clock.mockRestore(); }
});
it('records missing application parser dependencies as service unavailability, without falling back to deep support', async () => {
  const f = await coverageFixture({ 'app.py': pythonSource });
  const loader = Module as unknown as { _load: (...args: any[]) => unknown }; const original = loader._load;
  const spy = vi.spyOn(loader, '_load').mockImplementation(function (...args) { if (args[0] === '@lezer/python') throw new Error('private parser details'); return original.apply(loader, args); });
  try { const { bundle } = await f.extract(); expect(bundle.coverage.assessment!.reasons).toContain('parser_unavailable');
    expect(bundle.coverage.assessment!.result).toBe('insufficient_evidence'); expect(JSON.stringify(bundle)).not.toContain('private parser details');
  } finally { spy.mockRestore(); await f.cleanup(); }
});
it('drops only the file whose detector traversal hits a deterministic budget', () => {
  const pass = new ImplementationPass(coverageProfile(), () => randomUUID());
  pass.add({ path: 'a.ts', text: 'export const x=1;', fileId: randomUUID(), classification: 'code' }, 'analyzed');
  pass.add({ path: 'b.ts', text: 'export const x=2;', fileId: randomUUID(), classification: 'code' }, 'analyzed');
  const spy = vi.spyOn(rules, 'detect').mockImplementationOnce(() => { throw new ParseFailure('limited'); });
  try { pass.finish(); expect(pass.coverage).toMatchObject({ eligibleFiles: 2, analyzedFiles: 1, limitedFiles: 1 });
    expect(pass.outcomes.get('a.ts')).toBe('limited'); expect(pass.outcomes.get('b.ts')).toBe('analyzed');
  } finally { spy.mockRestore(); }
});
it('rejects XML entities, mismatched tags and unsupported Maven versions; retains dynamic declarations honestly', () => {
  const parse = (text: string) => extractBaseline({ path: 'pom.xml', text, language: 'xml', classification: 'config' }, []);
  for (const text of [pom.replace('4.0.0', '5.0.0'), '<!DOCTYPE project SYSTEM "file:///etc/passwd">' + pom, pom.replace('junit-jupiter', '&external;'), '<project><modelVersion>4.0.0</project>', pom + pom]) expect(() => parse(text)).toThrow();
  expect(parse(pom.replace('5.11.0', '${revision}'))).toMatchObject({ state: 'analyzed', reasons: ['dynamic_configuration'] });
});
