import { expect, it } from 'vitest';
import { ROLE_IDS, roleAvailability } from '@repofy/contracts';
import { implementedRolePortfolio } from '../../helpers/role-coverage-v3';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';

async function assess(files: Record<string,string>) {
  const {input,bundle} = await extractedAggregation(files,true);
  input.versions.aggregationPolicy.version = '3.0.0';
  return { result: aggregateEvidence(input), bundle, input };
}
it.each(ROLE_IDS)('can satisfy every required %s criterion with implemented and independently corroborated source',async role=>{
  const {result} = await assess(implementedRolePortfolio(role));
  expect(result.validation).toEqual([]);
  const requirements=result.roles.find(r=>r.template.roleId===role)!.requirements.filter(r=>r.required);
  expect(requirements.filter(r=>r.state!=='satisfied').map(r=>({id:r.requirementId,failures:r.failures}))).toEqual([]);
  expect(requirements.every(r=>r.minimumEvidence===.55&&r.minimumConfidence==='moderate')).toBe(true);
  expect(result.capabilities.every(c=>c.confidenceLabel!=='high')).toBe(true);
});
it.each(ROLE_IDS)('withholds required %s criteria when independent assertions are absent',async role=>{
  const {result} = await assess(implementedRolePortfolio(role,false));
  expect(result.roles.find(r=>r.template.roleId===role)!.requirements.filter(r=>r.required).every(r=>r.state!=='satisfied')).toBe(true);
});
it.each(['.repofyignore','public/logo.png','.env.example'])('preserves classifications when %s adds no missing source',async path=>{
  const files=implementedRolePortfolio('frontend'),before=await assess(files),after=await assess({...files,[path]:path==='.env.example'?'PORT=3000':''});
  const measures=(r:typeof before.result)=>r.capabilities.map(c=>[c.capabilityId,c.state,c.strength,c.confidence,c.confidenceLabel]);
  expect(measures(after.result)).toEqual(measures(before.result));
  expect(after.result.roles.map(r=>r.requirements.map(q=>q.state))).toEqual(before.result.roles.map(r=>r.requirements.map(q=>q.state)));
  expect(after.bundle.coverage.assessment!.counts).toMatchObject({excludedFiles:1,nonSourceExcludedFiles:1});
});
it.each(['vendor/source.ts','generated/source.ts','secret-source.ts','payload.wasm'])('retains uncertainty for excluded or unassessed %s',async path=>{
  const addition=path==='secret-source.ts'?"const credential='ghp_"+'A'.repeat(36)+"';":'export const value=1;';
  const {result,bundle}=await assess({...implementedRolePortfolio('frontend'),[path]:addition});
  expect(bundle.coverage.assessment!.counts).toMatchObject({excludedFiles:1,nonSourceExcludedFiles:0});
  expect(result.capabilities.filter(c=>c.state==='assessed').every(c=>c.confidenceLabel==='low')).toBe(true);
});
it('renders new observations and preserves the calibration boundary',async()=>{
  const {p,selection,modelRunId}=await narrativeFixture(implementedRolePortfolio(),'3.0.0');
  const report=renderNarrative(p,selection,modelRunId);
  expect(roleAvailability(report).every(r=>r.state==='provisional')).toBe(true);
  expect(p.facts.aggregation.roles.every(r=>r.requirements.filter(q=>q.required).every(q=>q.state==='satisfied'))).toBe(true);
});
it.each(['missing','same_file','mocked','unrelated'] as const)('does not manufacture test corroboration from %s assertions',async variant=>{
  const files=implementedRolePortfolio('frontend');
  if(variant==='same_file') files['guard-failure.test.ts']+=files['guard.test.ts'].replace("import {test,expect} from 'vitest';import {guard} from './guard';",'');
  if(variant==='mocked') files['guard.test.ts']=files['guard.test.ts'].replace('{test,expect}','{test,expect,vi}')+"vi.mock('./guard');";
  else delete files['guard.test.ts'];
  if(variant==='unrelated') files['other.test.ts']="import {test,expect} from 'vitest';import {boundary} from './boundary';test('different implementation',()=>{expect(boundary({id:'1'})).toEqual({id:'1'});});";
  const {result}=await assess(files);
  const failure=result.capabilities.find(c=>c.capabilityId==='testing_failures')!;
  expect(failure.trace.clusters.every(c=>c.corroboration.length===0)).toBe(true);
  expect(result.roles.find(r=>r.template.roleId==='frontend')!.requirements.find(r=>r.requirementId==='testing_behavior')!.state).not.toBe('satisfied');
});
it('keeps actual ignore omissions uncertain while excluding the policy file from the source denominator',async()=>{
  const {result,bundle}=await assess({...implementedRolePortfolio('frontend'),'.repofyignore':'guard.ts\n'});
  expect(bundle.coverage.assessment!.counts).toMatchObject({excludedFiles:2,nonSourceExcludedFiles:1});
  expect(result.capabilities.filter(c=>c.state==='assessed').every(c=>c.confidenceLabel==='low')).toBe(true);
});
it('preserves frozen v2 exclusion scoring and leaves unsupported languages unknown',async()=>{
  const {input}=await extractedAggregation({...implementedRolePortfolio('frontend'),'.repofyignore':''});
  input.versions.aggregationPolicy.version='2.0.0';
  expect(aggregateEvidence(input).capabilities.filter(c=>c.state==='assessed').every(c=>c.confidenceLabel==='low')).toBe(true);
  const {result}=await assess({'main.go':'package main\nfunc main() {}'});
  expect(result.roles.every(r=>r.state==='unknown'&&r.coverage===null)).toBe(true);
});
