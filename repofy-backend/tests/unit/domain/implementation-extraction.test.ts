import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { implementationFixture } from '../../helpers/implementation-fixtures';
import { implementationProfile, DETECTORS, DETECTOR_LIMITS } from '../../../src/domain/detectors/registry';
import { ImplementationPass } from '../../../src/domain/detectors/pass';
import { SnapshotBundleSchema, EvidenceRepository } from '../../../src/domain/analysis/persistence';
import { detectorCases, service } from '../../fixtures/evidence/implementation';
import { indexed } from '../../helpers/detector-index';
import { detect } from '../../../src/domain/detectors/rules';

it('emits all supported kinds with bounded confidence, exact locations, stable concepts and safe references',async()=>{
  const f=await implementationFixture();try{
    const {bundle}=await f.extract();const repeat=(await f.extract()).bundle;
    expect(repeat).toEqual(bundle);
    const items=bundle.evidence.filter(e=>e.implementation);
    expect(new Set(items.map(e=>e.implementation!.kind))).toEqual(new Set(DETECTORS.map(d=>d.kind)));
    expect(items.every(e=>e.confidence<=0.55&&e.strength>=0.4&&e.locator.kind==='file'&&!!e.locator.lines)).toBe(true);
    expect(items.every(e=>e.repositoryId===f.input.pin.repositoryId&&e.commitSha===f.input.pin.commitSha)).toBe(true);
    expect(bundle.coverage.implementation).toMatchObject({eligibleFiles:32,analyzedFiles:32,parseFailures:0,scope:'bounded_patterns_only',calibration:'uncalibrated'});
    const route=items.filter(e=>e.locator.kind==='file'&&e.locator.path==='request_validation/route.ts');
    expect(new Set(route.map(e=>e.implementation!.conceptId)).size).toBe(1);
    const captured:unknown[]=[];const repo=new EvidenceRepository({async rpc(_name,args){captured.push(args);return{data:bundle.snapshot.snapshotId,error:null};}});
    await repo.storeSnapshot(randomUUID(),randomUUID(),bundle,f.input.crypto);
    expect(JSON.stringify(captured)).not.toMatch(/function read|req\.body|SELECT id|\/route\.ts|\bSave\b/);
  }finally{await f.cleanup();}
});
it('quarantines a detector through a distinct immutable bundle/artifact, never rewriting earlier output',async()=>{
  const f=await implementationFixture();try{
    const previous=(await f.extract()).bundle;const profile=implementationProfile(['request_validation']);
    const {bundle}=await f.extract({profile,versions:{...f.input.versions,detectorBundle:profile.detectorBundle}});
    expect(bundle.snapshot.snapshotId).not.toBe(previous.snapshot.snapshotId);
    expect(bundle.evidence.some(e=>e.implementation?.kind==='request_validation')).toBe(false);
    expect(previous.evidence.some(e=>e.implementation?.kind==='request_validation')).toBe(true);
    expect(bundle.coverage.implementation!.detectors.find(d=>d.kind==='request_validation')).toMatchObject({state:'quarantined',observations:0});
    await expect(f.extract({profile})).rejects.toMatchObject({code:'ANALYSIS_VALIDATION_FAILED'});
    expect(()=>implementationProfile(['request_validation','request_validation'])).toThrow();
  }finally{await f.cleanup();}
});
it('records parse, size, generated, unsupported and no-signal states without inventing implementation',async()=>{
  const f=await implementationFixture({'broken.ts':'function {','large.ts':' '.repeat(256*1024+1),'marked.ts':'// auto-generated\nexport const x=1;',
    'empty.ts':'export const x=1;','eval.ts':'eval("nothing");','types.d.ts':'export declare function x():void;','node_modules/hidden.js':'x();'});
  try{const {bundle}=await f.extract();expect(bundle.coverage.implementation).toMatchObject({eligibleFiles:6,analyzedFiles:1,parseFailures:1,limitedFiles:1,generatedFiles:1,unsupportedFiles:2,noSignalFiles:1});
    expect(bundle.evidence.filter(e=>e.implementation)).toHaveLength(0);expect(bundle.inventorySummary.excludedFiles).toBe(1);
  }finally{await f.cleanup();}
});
it('rejects foreign relation targets, inflated strength, unregistered capabilities and forged detector counts',async()=>{
  const f=await implementationFixture();try{
    const {bundle}=await f.extract();const index=bundle.evidence.findIndex(e=>e.implementation?.kind==='asserted_call');
    for(const change of [
      (b:any)=>b.evidence[index].implementation.relations[0].fileId=randomUUID(),
      (b:any)=>b.evidence[index].strength=0.99,
      (b:any)=>b.evidence[index].capabilityIds=['security_authorization'],
      (b:any)=>b.coverage.implementation.detectors[0].observations++,
      (b:any)=>b.evidence[index].implementation.span.lines.end=999999,
      (b:any)=>delete b.coverage.implementation,
    ]){const bad=structuredClone(bundle);change(bad);expect(SnapshotBundleSchema.safeParse(bad).success).toBe(false);}
  }finally{await f.cleanup();}
});
it('marks intercepted tests as weak non-independent assertions and excludes skipped, empty and disconnected assertions',async()=>{
  const sample=detectorCases.find(c=>c.kind==='asserted_call')!;
  const f=await implementationFixture({'service.ts':service,'service.test.ts':sample.positive.replace("test('example'", "vi.mock('./service');test('example'").replace('{test,expect}','{test,expect,vi}')});
  try{const {bundle}=await f.extract();const test=bundle.evidence.find(e=>e.implementation?.kind==='asserted_call')!;
    expect(test).toMatchObject({strength:0.35,confidence:0.4,implementation:{testBoundary:'mocked_or_intercepted',relations:[{independence:'mocked_test'}]}});
  }finally{await f.cleanup();}
  for(const variant of [sample.positive.replace("test('example'", "describe.skip('outer',()=>{test('example'")+'});',
    sample.positive.replace('expect(add(1)).toBe(2);','return;expect(add(1)).toBe(2);'),sample.positive.replace("test('example'","if(false) test('example'"),
    sample.positive.replace('expect(add(1)).toBe(2);','')]){
    const project=indexed({'service.ts':service,'service.test.ts':variant});expect(detect(project.files.get('service.test.ts')!)).toHaveLength(0);
  }
});
it('uses literal aliases, rejects ambiguous and inherited resolution, and supports bounded CommonJS imports',()=>{
  const positive=detectorCases.find(c=>c.kind==='request_validation')!.positive;
  const p=indexed({'src/service.ts':service,'src/route.ts':positive.replace("'./service'","'@local/service'")},
    {'tsconfig.json':'{"compilerOptions":{"baseUrl":".","paths":{"@local/*":["src/*"]}}}'});
  expect(detect(p.files.get('src/route.ts')!).some(f=>f.kind==='request_validation')).toBe(true);
  const ambiguous=indexed({'src/service.ts':service,'src/service.js':service,'src/route.ts':positive});
  expect(detect(ambiguous.files.get('src/route.ts')!).some(f=>f.kind==='request_validation')).toBe(false);
  const inherited=indexed({'service.ts':service,'route.ts':positive},{'tsconfig.json':'{"extends":"./base.json"}'});
  expect(detect(inherited.files.get('route.ts')!)).toHaveLength(0);expect(inherited.stats.aliasConfigurationsRejected).toBe(1);
  const cjs=indexed({'service.cjs':'function save(x){return x;}exports.save=save;','route.cjs':positive.replace("import express from 'express'", "const express=require('express')")
    .replace("import { save, load } from './service'","const {save}=require('./service.cjs')").replace("import { z } from 'zod'","const {z}=require('zod')")});
  expect(detect(cjs.files.get('route.cjs')!).some(f=>f.kind==='request_validation')).toBe(true);
});
it('invalidates shadowed, reassigned and type-only API identities',()=>{
  const positive=detectorCases.find(c=>c.kind==='parameterized_query')!.positive;
  for(const source of [positive.replace('async function read(id)','async function read(id,db)'),positive.replace('export async','db.query=other; export async'),
    positive.replace("import {Pool}","import type {Pool}"),positive.replace('const db','let db'),
    positive.replace('export async','Object.assign(db,{query:other}); export async'),
    positive.replace('export async','const alias=db;alias.query=other; export async')]){
    const p=indexed({'query.ts':source});expect(detect(p.files.get('query.ts')!).some(f=>f.kind==='parameterized_query')).toBe(false);
  }
});
it('does not extend guards to neighboring routes, and requires real SQL placeholders',()=>{
  const sample=detectorCases.find(c=>c.kind==='authentication_guard')!.positive;
  const p=indexed({'service.ts':service,'route.ts':sample+"\napp.post('/other',(req,res)=>{return save(req.body);});"});
  expect(detect(p.files.get('route.ts')!).filter(f=>f.kind==='authentication_guard')).toHaveLength(1);
  const query=detectorCases.find(c=>c.kind==='parameterized_query')!.positive;
  for(const sql of ["SELECT '$1'",'SELECT id -- $1','SELECT id WHERE id=$2','SELECT id WHERE id=$1 OR name=$2']){
    const source=query.replace("'SELECT id FROM things WHERE id=$1'",JSON.stringify(sql));
    const project=indexed({'query.ts':source});expect(detect(project.files.get('query.ts')!).some(f=>f.kind==='parameterized_query')).toBe(false);
  }
});
it('resolves declared ORM relationships and rejects spread overrides of constraints',()=>{
  const source="import {pgTable,integer} from 'drizzle-orm/pg-core';export const parent=pgTable('parent',{id:integer()});export const child=pgTable('child',{parentId:integer().references(()=>parent.id)});";
  const p=indexed({'schema.ts':source});expect(detect(p.files.get('schema.ts')!).filter(f=>f.kind==='schema_constraint')).toHaveLength(1);
  const q=indexed({'schema.ts':source.replace('parentId:integer().references(()=>parent.id)','parentId:integer().unique(),...overrides')});
  expect(detect(q.files.get('schema.ts')!).some(f=>f.kind==='schema_constraint')).toBe(false);
});
it('keeps dynamic references uncertain and resolves ESM export aliases without executing modules',()=>{
  const source=detectorCases.find(c=>c.kind==='asserted_call')!.positive;
  const p=indexed({'service.ts':'function increment(x){return x+1;}export {increment as add};','service.test.ts':source,'dynamic.ts':'const m=require(variable);import(variable);'});
  expect(detect(p.files.get('service.test.ts')!).some(f=>f.kind==='asserted_call')).toBe(true);expect(p.stats.dynamicReferences).toBe(2);
  const q=indexed({'service.ts':service,'service.test.ts':source.replace("import {test,expect} from 'vitest'","function require(){return {};};const {test,expect}=require('vitest')")});
  expect(detect(q.files.get('service.test.ts')!)).toHaveLength(0);
});
it('bounds repository indexing deterministically and fails a wall deadline without sealing timing-dependent evidence',()=>{
  const pass=new ImplementationPass(implementationProfile(),()=>randomUUID());
  for(let n=0;n<DETECTOR_LIMITS.files+1;n++)pass.add({path:`file${n}.ts`,text:'export const x=1;',fileId:randomUUID(),classification:'code'},'analyzed');
  pass.finish();expect(pass.coverage).toMatchObject({eligibleFiles:257,analyzedFiles:256,limitedFiles:1});
  const clock=vi.spyOn(performance,'now');try{let t=0;clock.mockImplementation(()=>t+=2000);
    const slow=new ImplementationPass(implementationProfile(),()=>randomUUID());
    expect(()=>slow.add({path:'file.ts',text:'export const x=1;',fileId:randomUUID(),classification:'code'},'analyzed')).toThrow('WORKER_EXPIRED');
  }finally{clock.mockRestore();}
});
it('shares clone-pattern keys for copied implementation without labeling its author',async()=>{
  const source=detectorCases.find(c=>c.kind==='state_guard')!.positive;
  const f=await implementationFixture({'service.ts':service,'first.ts':source,'second.ts':source});
  try{const {bundle}=await f.extract();const found=bundle.evidence.filter(e=>e.implementation?.kind==='state_guard');expect(found).toHaveLength(2);
    expect(found[0].implementation!.patternId).toBe(found[1].implementation!.patternId);
    expect(found[0].implementation!.conceptId).not.toBe(found[1].implementation!.conceptId);
    expect(found.every(e=>e.contribution.state==='unknown')).toBe(true);
  }finally{await f.cleanup();}
});
