import { ROLE_IDS } from '@repofy/contracts';
type RoleId = typeof ROLE_IDS[number];

// Authored source fixtures. Extraction never executes them, and their assertion
// source is not recorded as a passing runtime test or empirical calibration.
export const roleSources: Record<string, string> = {
  'service.ts': `export function save(input){return input;} export async function fetchRecord(){return {id:'1'};} export function useCredential(value){return Boolean(value);} export function onState(state){return state;} export function dispatch(action){return action;}`,
  'boundary.ts': `import {z} from 'zod';import {save} from './service';const schema=z.object({id:z.string()});export function boundary(input){const parsed=schema.parse(input);return save(parsed);}`,
  'guard.ts': `import {save} from './service';export function guard(actor,resource){if(resource.ownerId!==actor.id)throw new Error('Forbidden');return save(resource);}`,
  'environment.ts': `import {useCredential} from './service';export function credential(){const value=process.env.SERVICE_TOKEN;if(!value)throw new Error('Missing credential');return useCredential(value);}`,
  'retry.ts': `import {fetchRecord} from './service';export async function retry(){for(let n=0;n<3;n++){try{return await fetchRecord();}catch{}}}`,
  'state.ts': `import {save} from './service';export function transition(input){if(input.state!=='ready')throw new Error('Invalid state');return save(input);}`,
  'reducer.ts': `export function reducer(state,action){switch(action.type){case 'change':return {...state,value:action.payload};default:return state;}}`,
  'Form.jsx': `import React,{useState} from 'react';import {save} from './service';export function Form(){const [name,setName]=useState('');function change(event){setName(event.target.value);}function submit(event){event.preventDefault();save(name);}return <form onSubmit={submit}><label htmlFor="name">Name</label><input id="name" value={name} onChange={change}/><button type="submit">Save</button></form>;}`,
  'Mobile.jsx': `import React from 'react';import {Pressable,Text} from 'react-native';import {save} from './service';export function Mobile(){function press(){save('request');}return <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={press}><Text>Save</Text></Pressable>;}`,
  'lifecycle.ts': `import {AppState} from 'react-native';import {onState} from './service';export function subscribe(){const subscription=AppState.addEventListener('change',onState);return ()=>{subscription.remove();};}`,
  'navigation.ts': `import {router} from 'expo-router';import {z} from 'zod';const schema=z.object({id:z.string()});export function navigate(input){const parsed=schema.parse(input);return router.push({pathname:'/items/[id]',params:parsed});}`,
  'offline.ts': `import storage from '@react-native-async-storage/async-storage';import {fetchRecord} from './service';export async function load(){try{const result=await fetchRecord();await storage.setItem('record',JSON.stringify(result));return result;}catch{const cached=await storage.getItem('record');return JSON.parse(cached);}}`,
  'secure.ts': `import {setItemAsync} from 'expo-secure-store';export async function store(value){await setItemAsync('session',value);return true;}`,
  'api.ts': `import express from 'express';import {z} from 'zod';import {save} from './service';const app=express();const schema=z.object({id:z.string()});export async function handler(req,res){const parsed=schema.parse(req.body);const stored=await save(parsed);return res.json(stored);}app.post('/records',handler);`,
  'schema.ts': `import {pgTable,text} from 'drizzle-orm/pg-core';export const records=pgTable('records',{id:text('id').unique()});`,
  'transaction.ts': `import {PrismaClient} from '@prisma/client';const prisma=new PrismaClient();export async function commit(){await prisma.$transaction(async tx=>{await tx.record.create({data:{id:'1'}});await tx.audit.create({data:{recordId:'1'}});});return true;}`,
  'model.ts': `import {generateObject} from 'ai';import {z} from 'zod';const schema=z.object({action:z.enum(['read','skip'])});export async function model(records){const prompt=records.slice(0,5).map(record=>record.content).join(' ');const result=await generateObject({model:'fixture-model',schema,prompt,maxRetries:1,abortSignal:AbortSignal.timeout(1000)});return result.object.action;}`,
  'model-guard.ts': `import {generateObject} from 'ai';import {z} from 'zod';import {dispatch} from './service';const schema=z.object({action:z.string()});const allowed=['read','skip'];export async function choose(prompt){const result=await generateObject({model:'fixture-model',schema,prompt,maxRetries:1,abortSignal:AbortSignal.timeout(1000)});if(!allowed.includes(result.object.action))throw new Error('Unsupported action');return dispatch(result.object.action);}`,
  'evaluation.ts': `import {model} from './model';export async function evaluate(){const cases=[{input:[{content:'read a record'}],expected:'read'},{input:[{content:'do nothing'}],expected:'skip'}];const results=[];for(const sample of cases){const actual=await model(sample.input);results.push(actual===sample.expected);}return results;}`,
  'health.ts': `import {fetchRecord} from './service';export async function health(){try{await fetchRecord();return {status:'ok'};}catch{return {status:'unavailable'};}}`,
  'diagnostics.ts': `import pino from 'pino';import {fetchRecord} from './service';const log=pino();export async function fetchSafely(){try{return await fetchRecord();}catch{log.error({code:'FETCH_FAILED',operation:'record'});return null;}}`,
};

const assertions: Record<string, [string, string, string]> = {
  boundary: ['boundary', "boundary({id:'1'})", "{id:'1'}"], guard: ['guard', "guard({id:'1'},{ownerId:'1'})", "{ownerId:'1'}"],
  environment: ['credential', 'credential()', 'true'], retry: ['retry', 'await retry()', "{id:'1'}"], state: ['transition', "transition({state:'ready'})", "{state:'ready'}"],
  reducer: ['reducer', "reducer({value:'old'},{type:'change',payload:'new'})", "{value:'new'}"],
  lifecycle: ['subscribe', 'subscribe()', 'expect.any(Function)'], navigation: ['navigate', "navigate({id:'1'})", 'undefined'], offline: ['load', 'await load()', "{id:'1'}"],
  secure: ['store', "await store('fixture-session')", 'true'], api: ['handler', "await handler({body:{id:'1'}},{json(value){return value;}})", "{id:'1'}"],
  transaction: ['commit', 'await commit()', 'true'], model: ['model', "await model([{content:'read'}])", "'read'"],
  'model-guard': ['choose', "await choose('read')", "'read'"], evaluation: ['evaluate', 'await evaluate()', '[true,true]'],
  health: ['health', 'await health()', "{status:'ok'}"], diagnostics: ['fetchSafely', 'await fetchSafely()', "{id:'1'}"],
};
const shared = ['service', 'boundary', 'guard', 'environment', 'retry', 'state'];
const members: Record<RoleId, string[]> = {
  frontend: [...shared, 'reducer', 'Form'], backend: [...shared, 'api', 'schema', 'transaction', 'health', 'diagnostics'],
  full_stack: [...shared, 'reducer', 'Form', 'api', 'schema', 'transaction'],
  mobile: [...shared, 'Mobile', 'lifecycle', 'navigation', 'offline', 'secure'],
  ai_application: [...shared, 'model', 'model-guard', 'evaluation', 'api', 'health', 'diagnostics'],
};
export function implementedRolePortfolio(role?: RoleId, tests = true): Record<string, string> {
  const selected = role ? members[role] : [...new Set(Object.values(members).flat())], files: Record<string, string> = {};
  for (const [path, source] of Object.entries(roleSources)) if (selected.includes(path.replace(/\.[^.]+$/, ''))) files[path] = source;
  if (!tests) return files;
  for (const name of selected) if (assertions[name]) {
    const [symbol, call, expected] = assertions[name];
    files[`${name}.test.ts`] = `import {test,expect} from 'vitest';import {${symbol}} from './${name}';test('observes ${name}',async()=>{expect(${call}).toEqual(${expected});});`;
  }
  files['guard-failure.test.ts'] = `import {test,expect} from 'vitest';import {guard} from './guard';test('rejects a different owner',()=>{expect(()=>guard({id:'other'},{ownerId:'1'})).toThrow('Forbidden');});`;
  if (selected.includes('schema')) files['schema.test.ts'] = `import {test,expect} from 'vitest';import {records} from './schema';test('declares uniqueness',()=>{expect(records.id.isUnique).toBe(true);});`;
  for (const component of ['Form','Mobile']) if (selected.includes(component)) files[`${component}.test.jsx`] = `import {test,expect} from 'vitest';import {render} from '@testing-library/${component === 'Mobile' ? 'react-native' : 'react'}';import {${component}} from './${component}';test('names its control',()=>{const view=render(<${component}/>);expect(view.getByRole('${component === 'Mobile' ? 'button' : 'textbox'}',{name:'${component === 'Mobile' ? 'Save' : 'Name'}'})).toBeDefined();});`;
  return files;
}
