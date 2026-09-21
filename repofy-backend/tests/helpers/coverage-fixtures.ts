import { implementationFixture } from './implementation-fixtures';
import { coverageProfile } from '../../src/domain/coverage/manifest';
import type { BaselineParser } from '@repofy/contracts';

export async function coverageFixture(files: Record<string, string | Buffer>, disabled: readonly BaselineParser[] = []) {
  const f = await implementationFixture(files); const profile = coverageProfile(disabled);
  f.input.profile = profile;
  Object.assign(f.input.versions, { extractorBundle: profile.extractorBundle, detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest });
  return f;
}
