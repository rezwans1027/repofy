import { extractionFixture } from './extraction-fixtures';
import { implementationProfile } from '../../src/domain/detectors/registry';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { detectorCases, service } from '../fixtures/evidence/implementation';

export function implementationRepository() {
  return Object.fromEntries(detectorCases.flatMap(sample => [[`${sample.kind}/${sample.path}`, sample.positive], [`${sample.kind}/service.ts`, service]]));
}
export async function implementationFixture(files: Record<string,string|Buffer> = implementationRepository()) {
  const fixture = await extractionFixture(files); const profile = implementationProfile();
  fixture.input.profile = profile;
  Object.assign(fixture.input.versions, { extractorBundle: profile.extractorBundle, detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest,
    taxonomy: {id:initialRubricCatalog.taxonomy.id,version:initialRubricCatalog.taxonomy.version}, roleRubrics:initialRubricCatalog.rubrics.map(r=>({roleId:r.roleId,version:r.version})) });
  return fixture;
}
