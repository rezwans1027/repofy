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

const query = "const db=new Pool();return await db.query('SELECT id FROM things WHERE id=$1',[id]);";
const namedClass = (member: string) => `import {Pool} from 'pg';
  export const Fake=class Pool {async query(){return [];} ${member}};`;
it.each([
  `async read(id){${query}}`,
  `static async read(id){${query}}`,
  `read=async(id)=>{${query}};`,
])('does not resolve a named class expression to the import it shadows: %s', member => {
  expect(queryKinds(namedClass(member))).not.toContain('parameterized_query');
});
it('keeps a named class expression private to its own scope', () => {
  const text = `${namedClass(`async read(id){${query}}`)} export async function actual(id){${query}}`;
  expect(queryKinds(text).filter(kind => kind === 'parameterized_query')).toHaveLength(1);
});

const patchedClient = (write: string) => `import {Pool} from 'pg';const db=new Pool();const alias=db;
  function fakeQuery(){return [];} ${write}
  export async function read(id){return await db.query('SELECT id FROM things WHERE id=$1',[id]);}`;
it.each([
  '({query:db.query}={query:fakeQuery});',
  '[db.query]=[fakeQuery];',
  '({nested:{query:db.query}}={nested:{query:fakeQuery}});',
  '({query:db.query=fakeQuery}={});',
  '[,db.query=fakeQuery]=[];',
  '[...db.query]=[fakeQuery];',
  '({...db.query}={query:fakeQuery});',
  '({["query"]:db["query"]}={query:fakeQuery});',
  '({query:alias.query}={query:fakeQuery});',
  'for([db.query] of [[fakeQuery]]){}',
  'for({query:db.query} of [{query:fakeQuery}]){}',
  'for(db.query in {query:fakeQuery}){}',
])('invalidates library origins overwritten through an assignment target: %s', write => {
  expect(queryKinds(patchedClient(write))).not.toContain('parameterized_query');
});
it.each([
  'let other;({query:other=db.query}={});',
  'let other;[other=db.query]=[];',
  'let other;({[db.query.name]:other}={});',
  'const copy=Object.assign({query:db.query},{});',
])('does not invalidate objects only read by assignment patterns or fresh objects: %s', read => {
  expect(queryKinds(patchedClient(read))).toContain('parameterized_query');
});
it('invalidates a parameter reassigned by a shorthand object pattern', () => {
  const text = `import {Pool} from 'pg';export async function read(id,db=new Pool()){
    ({db}={db:{query:async()=>[]}});return await db.query('SELECT id FROM things WHERE id=$1',[id]);}`;
  expect(queryKinds(text)).not.toContain('parameterized_query');
  expect(queryKinds(text.replace('({db}={db:{query:async()=>[]}});', ''))).toContain('parameterized_query');
});
it.each([
  namedClass(`async read(id){${query}}`),
  patchedClient('({query:db.query}={query:fakeQuery});'),
])('keeps false library calls out of persisted evidence and capability strength', async text => {
  const { input, bundle } = await extractedAggregation({ 'query.ts': text });
  expect(bundle.evidence.some(e => e.implementation?.kind === 'parameterized_query')).toBe(false);
  expect(aggregateEvidence(input).capabilities.find(c => c.capabilityId === 'security_input_handling')).toMatchObject({ state: 'not_observed', strength: 0 });
});
