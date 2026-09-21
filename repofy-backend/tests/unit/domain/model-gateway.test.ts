import { beforeAll, expect, it, vi } from 'vitest';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { OpenAIResponsesGateway } from '../../../src/domain/synthesis/gateway';
import { MODEL, NARRATIVE_POLICY } from '../../../src/domain/synthesis/policy';
let f: Awaited<ReturnType<typeof narrativeFixture>>;
beforeAll(async()=>{f=await narrativeFixture();});
const wire=(selection:unknown)=>({status:'completed',model:MODEL.version,usage:{input_tokens:200,output_tokens:100},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(selection)}]}]});
it('uses the fixed Responses endpoint, strict schema, no storage/tools and only approved input',async()=>{
  const fetch=vi.fn(async()=>Response.json(wire(f.selection)));
  const result=await new OpenAIResponsesGateway('secret-fixture',fetch).generate(f.p.input,new AbortController().signal);
  expect(result.selection).toEqual(f.selection);expect(result.usage.inputTokens).toBe(200);
  const [url,options]=fetch.mock.calls[0] as unknown as [string,RequestInit]; const body=JSON.parse(options.body as string);
  expect(url).toBe('https://api.openai.com/v1/responses'); expect(options.redirect).toBe('error');
  expect(body).toMatchObject({store:false,background:false,tools:[],model:MODEL.version,max_output_tokens:8192,text:{format:{strict:true,type:'json_schema'}}});
  expect(body.input[1].content).toBe(JSON.stringify(f.p.input));expect(body).not.toHaveProperty('previous_response_id');
  expect(body.text.format.schema.properties.schemaVersion).toMatchObject({type:'string',enum:['1.0.0']});
  expect(body.text.format.schema).not.toHaveProperty('$schema');
});
it.each([
  ['malformed JSON',()=>new Response('{bad'),'provider_malformed'],
  ['wrong model',()=>Response.json({...wire({}),model:'other'}),'provider_malformed'],
  ['incomplete',()=>Response.json({...wire({}),status:'incomplete'}),'provider_incomplete'],
  ['refusal',()=>Response.json({...wire({}),output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'SECRET_PRIVATE_SENTINEL'}]}]}),'provider_refusal'],
  ['no usage',()=>Response.json({...wire({}),usage:null}),'provider_malformed'],
  ['oversized response',()=>new Response('SECRET_PRIVATE_SENTINEL'.repeat(NARRATIVE_POLICY.maxResponseBytes)),'response_limit'],
  ['rate limit',()=>new Response('SECRET_API_KEY',{status:429}),'provider_rate_limit'],
  ['rejected key',()=>new Response('SECRET_API_KEY',{status:401}),'provider_rejected'],
  ['uncertain 503',()=>new Response('SECRET_API_KEY',{status:503}),'outcome_unknown'],
  ['uncertain HTTP timeout',()=>new Response('SECRET_API_KEY',{status:408}),'outcome_unknown'],
])('redacts %s and preserves a closed outcome',async(_name,response,code)=>{
  try{await new OpenAIResponsesGateway('fixture',async()=>response()).generate(f.p.input,new AbortController().signal);throw Error('expected failure');}
  catch(error){expect(error).toMatchObject({validationCode:code});expect(JSON.stringify(error)).not.toMatch(/SECRET/);}
});
it('aborts a repeated slow provider without retrying or retaining provider exception text',async()=>{
  const request=vi.fn((_url:any,opts:any)=>new Promise<Response>((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('SECRET_PRIVATE_SENTINEL')))));
  for(let n=0;n<2;n++) await expect(new OpenAIResponsesGateway('fixture',request,10).generate(f.p.input,new AbortController().signal)).rejects.toMatchObject({validationCode:'outcome_unknown'});
  expect(request).toHaveBeenCalledTimes(2); // Exactly one HTTP attempt per independent invocation; service ledger bars duplicate job calls.
});
