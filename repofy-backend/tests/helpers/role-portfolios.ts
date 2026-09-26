import { aggregationFiles } from './aggregation-fixtures';
import { detectorCases, service } from '../fixtures/evidence/implementation';

// Invented portfolio examples processed as source, never executed. The tests
// corroborate source observations; they do not establish passing runtime tests.
export function rolePortfolio(tests = true) {
  const files: Record<string, string> = { ...aggregationFiles };
  const examples = [
    ['state_guard', 'run', "run({state:'ready'})"],
    ['bounded_model_output', 'run', 'await run({})'],
  ] as const;
  for (const [kind, symbol, call] of examples) {
    const sample = detectorCases.find(c => c.kind === kind)!;
    files[`${kind}/${sample.path}`] = sample.positive;
    files[`${kind}/service.ts`] = service;
    if (tests && kind === 'state_guard') files[`${kind}/proof.test.ts`] = `import {test,expect} from 'vitest';import {${symbol}} from './${sample.path.replace(/\.[^.]+$/, '')}';test('observed result',async()=>{expect(${call}).toEqual({saved:{state:'ready'}});});`;
  }
  const form = detectorCases.find(c => c.kind === 'form_validation')!;
  files[form.path] = form.positive;
  if (!tests) delete files['retry.test.ts'];
  return files;
}
export const weakRolePortfolio = {
  'service.ts': service,
  'retry.ts': detectorCases.find(c => c.kind === 'bounded_retry')!.falsePositive,
  'Load.jsx': detectorCases.find(c => c.kind === 'request_state')!.falsePositive,
  'package.json': aggregationFiles['package.json'],
};
export const unknownRolePortfolio = { 'main.go': 'package main\nfunc main() {}' };
