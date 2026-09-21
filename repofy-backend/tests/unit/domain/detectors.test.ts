import { describe, expect, it } from 'vitest';
import { detect } from '../../../src/domain/detectors/rules';
import { DETECTORS } from '../../../src/domain/detectors/registry';
import { detectorCases, service } from '../../fixtures/evidence/implementation';
import { indexed } from '../../helpers/detector-index';
describe('versioned implementation detector boundaries',()=>{
  it('requires four reviewable fixture classes for every registry entry',()=>{
    expect(detectorCases.map(c=>c.kind).sort()).toEqual(DETECTORS.map(d=>d.kind).sort());
  });
  for(const sample of detectorCases) {
    it(`${sample.kind}: traces the supported positive`,()=>{
      const project=indexed({'service.ts':service,[sample.path]:sample.positive});
      expect(detect(project.files.get(sample.path)!).some(f=>f.kind===sample.kind)).toBe(true);
    });
    for(const variant of ['falsePositive','limitation','mutation'] as const)it(`${sample.kind}: rejects ${variant}`,()=>{
      const project=indexed({'service.ts':service,[sample.path]:sample[variant]});
      expect(detect(project.files.get(sample.path)!).some(f=>f.kind===sample.kind)).toBe(false);
    });
  }
});
