import { expect, it } from 'vitest';
import { detect } from '../../../src/domain/detectors/rules';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { indexed } from '../../helpers/detector-index';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';

const source = (shadow: string) => `import {Pool} from 'pg';
  const FakePool=class {async query(){return null;}};
  export async function read(id){${shadow} const db=new Pool();return await db.query('SELECT id FROM things WHERE id=$1',[id]);}`;
const queryKinds = (text: string) => { const project = indexed({ 'query.ts': text }); return detect(project.files.get('query.ts')!).map(f => f.kind); };

it.each([
  'if(true){var Pool=FakePool;}', 'if(false){var Pool=FakePool;}',
  'for(var Pool of [FakePool]){}', 'for(var Pool=FakePool;false;){}',
  'try{var Pool=FakePool;}catch{}', 'try{throw 1;}catch{var Pool=FakePool;}',
  'if(true){var {Pool}={Pool:FakePool};}', 'if(true){var {nested:{Pool}}={nested:{Pool:FakePool}};}',
])('does not credit an imported library shadowed by function-scoped var: %s', shadow => {
  expect(queryKinds(source(shadow))).not.toContain('parameterized_query');
});
it.each([
  'if(true){let Pool=FakePool;}', 'if(true){const Pool=FakePool;}',
  'function unrelated(){if(true){var Pool=FakePool;}}',
  'class Unrelated {method(){var Pool=FakePool;} static {var Pool=FakePool;}}',
])('does not leak declarations from another scope: %s', shadow => {
  expect(queryKinds(source(shadow))).toContain('parameterized_query');
});
it('does not grant security strength to a custom object mistaken for pg', async () => {
  const { input, bundle } = await extractedAggregation({ 'query.ts': source('if(true){var Pool=FakePool;}') });
  expect(bundle.evidence.some(e => e.implementation?.kind === 'parameterized_query')).toBe(false);
  expect(aggregateEvidence(input).capabilities.find(c => c.capabilityId === 'security_input_handling')).toMatchObject({ state: 'not_observed', strength: 0 });
});
