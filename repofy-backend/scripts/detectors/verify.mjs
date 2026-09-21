import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

if (process.argv[2] === '--child') {
  const require = createRequire(import.meta.url);
  const { ImplementationPass } = require('../../dist/domain/detectors/pass.js');
  const { implementationProfile, DETECTOR_LIMITS } = require('../../dist/domain/detectors/registry.js');
  const { sourceFile } = require('../../dist/domain/extraction/parsers.js');
  const started = performance.now();
  const pass = new ImplementationPass(implementationProfile(), () => randomUUID());
  pass.config('tsconfig.json', '{"compilerOptions":{"baseUrl":".","paths":{"@local/*":["src/*"]}}}');
  pass.add({path:'src/service.ts',classification:'code',fileId:randomUUID(),text:`globalThis.__repositoryExecuted=true; export function save(value){return {saved:value};}`},'analyzed');
  for (let n=0;n<DETECTOR_LIMITS.files;n++) {
    pass.add({path:`src/route${String(n).padStart(3,'0')}.ts`,classification:'code',fileId:randomUUID(),text:
      `import express from 'express'; import {z} from 'zod'; import {save} from '@local/service';
       const app=express();const schema=z.object({name:z.string()});
       app.post('/example',(req,res)=>{const parsed=schema.parse(req.body);return save(parsed);});`},'analyzed');
  }
  const observations=pass.finish();
  assert.equal(globalThis.__repositoryExecuted,undefined);
  assert.equal(pass.coverage.analyzedFiles,256);assert.equal(pass.coverage.limitedFiles,1);
  assert.equal(observations.filter(o=>o.kind==='request_validation').length,255);
  assert.doesNotMatch(JSON.stringify(observations.map(o=>o.detail)),/req\.body|route[0-9]|repositoryExecuted/);
  // Recursive/malformed sources must produce fixed failures without diagnostic excerpts.
  for (const source of ['('.repeat(5000)+'x'+')'.repeat(5000), "// '\nconst x="+'['.repeat(5000)+'1'+']'.repeat(5000),
    'const broken = {', 'export const many=['+'1,'.repeat(21000)+'0];']) {
    assert.throws(()=>sourceFile(source,'fixture.ts'),e=>['limited','parse_failure'].includes(e.message));
  }
  const dense = new ImplementationPass(implementationProfile(),()=>randomUUID());
  for(let n=0;n<100;n++) dense.add({path:`dense${n}.ts`,classification:'code',fileId:randomUUID(),text:'export const values=['+'1,'.repeat(1500)+'0];'},'analyzed');
  dense.finish();assert.ok(dense.coverage.limitedFiles>0);assert.ok(dense.coverage.indexedNodes<=DETECTOR_LIMITS.nodes+1);
  const long = new ImplementationPass(implementationProfile(),()=>randomUUID());
  for(let n=0;n<12;n++) long.add({path:`large${n}.ts`,classification:'code',fileId:randomUUID(),text:'// '+'x'.repeat(200000)+'\nexport const x=1;'},'analyzed');
  long.finish();assert.ok(long.coverage.limitedFiles>0);assert.ok(long.coverage.indexedBytes<=DETECTOR_LIMITS.bytes);
  const metrics={status:'implementation-boundaries-ok',files:pass.coverage.analyzedFiles,observations:observations.length,
    nodes:pass.coverage.indexedNodes,bytes:pass.coverage.indexedBytes,elapsedMs:Math.ceil(performance.now()-started),maxRssMiB:Math.ceil(process.resourceUsage().maxRSS/1024)};
  process.stdout.write(JSON.stringify(metrics)+'\n');
} else {
  const child=spawn(process.execPath,['--max-old-space-size=256',fileURLToPath(import.meta.url),'--child'],{
    env:{PATH:process.env.PATH,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  let output='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},15000);
  const capture=chunk=>{output+=chunk;if(output.length>8192)child.kill('SIGKILL');};child.stdout.on('data',capture);child.stderr.on('data',capture);
  try{
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    assert.equal(timedOut,false,'Detector deadline exceeded');assert.equal(code,0,'Detector process failed');
    const metrics=JSON.parse(output);assert.equal(metrics.status,'implementation-boundaries-ok');assert.equal(metrics.files,256);
    assert.ok(Number.isInteger(metrics.maxRssMiB)&&metrics.maxRssMiB>0&&metrics.maxRssMiB<384);
    process.stdout.write(`TS/JS detector verification passed (256 MiB heap; 15 second watchdog): ${JSON.stringify(metrics)}\n`);
  }finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}
}
