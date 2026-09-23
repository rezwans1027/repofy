import { expect, it } from 'vitest';
import { extractionProfile } from '../../../src/domain/extraction/policy';
import { implementationProfile } from '../../../src/domain/detectors/registry';
import { coverageProfile } from '../../../src/domain/coverage/manifest';
import { extractionFixture } from '../../helpers/extraction-fixtures';
import { coverageFixture } from '../../helpers/coverage-fixtures';
import { SnapshotBundleSchema } from '../../../src/domain/analysis/persistence';

it('pins corrected semantics to distinct structural, implementation, and language analyzer profiles', () => {
  expect(extractionProfile()).toMatchObject({ extractorBundle: { version: '1.0.1' }, detectorBundle: { version: '1.0.1' }, coverageManifest: '1.0.1' });
  expect(implementationProfile()).toMatchObject({ extractorBundle: { version: '1.0.1' }, detectorBundle: { version: '1.0.3' }, coverageManifest: '1.1.1' });
  expect(coverageProfile()).toMatchObject({ extractorBundle: { version: '1.0.1' }, detectorBundle: { version: '1.0.3' }, coverageManifest: '1.2.1' });
  expect(coverageProfile(['python'], ['request_validation'])).toMatchObject({ extractorBundle: { version: '1.0.1-p100' },
    detectorBundle: { version: '1.0.3-q0100000000000000' }, coverageManifest: '1.2.1-p100' });
});
it('rejects an old structural profile before interpreting source with corrected semantics', async () => {
  const fixture = await extractionFixture({ 'schema.prisma': 'model Person {\n id Int @id\n}\n' });
  try {
    const profile = { ...extractionProfile(), extractorBundle: { id: 'structural_inventory', version: '1.0.0' },
      detectorBundle: { id: 'structural_signals', version: '1.0.0' }, coverageManifest: '1.0.0' };
    await expect(fixture.extract({ profile, versions: { ...fixture.input.versions, extractorBundle: profile.extractorBundle,
      detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest } })).rejects.toMatchObject({ code: 'ANALYSIS_VALIDATION_FAILED' });
  } finally { await fixture.cleanup(); }
});
it.each(['1.0.0', '1.0.1', '1.0.2'])('does not run corrected binding semantics under detector %s', async version => {
  const fixture = await coverageFixture({ 'query.ts': "import {Pool} from 'pg';export const Fake=class Pool {};" });
  try {
    const profile = { ...coverageProfile(), detectorBundle: { id: 'tsjs_implementation', version } };
    await expect(fixture.extract({ profile, versions: { ...fixture.input.versions, detectorBundle: profile.detectorBundle } }))
      .rejects.toMatchObject({ code: 'ANALYSIS_VALIDATION_FAILED' });
  } finally { await fixture.cleanup(); }
});
it('rejects legacy schema observations inside a corrected extraction bundle', async () => {
  const fixture = await coverageFixture({ 'schema.prisma': 'model Person {\n id Int @id\n}\n' });
  try {
    const { bundle } = await fixture.extract();
    const schema = bundle.evidence.find(e => e.structural?.kind === 'schema')!;
    expect(schema.detector).toEqual({ id: 'structural.schemas.schema', version: '1.0.1' });
    schema.detector.version = '1.0.0';
    expect(SnapshotBundleSchema.safeParse(bundle).success).toBe(false);
  } finally { await fixture.cleanup(); }
});
