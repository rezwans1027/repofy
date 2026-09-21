import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

// Fixed application entry only; never repository code. No inherited application environment.
const entry=resolve('dist/workers/analysis.js');const supervisor=resolve('dist/workers/analysis-supervisor.js');const base=await mkdtemp(join(tmpdir(),'repofy-worker-process-'));
const root=join(base,'workspaces');await mkdir(root,{mode:0o700});
const orphan=randomUUID();await mkdir(join(root,orphan),{mode:0o700});
await writeFile(join(root,orphan,'manifest.json'),JSON.stringify({version:1,workspaceId:orphan,jobId:randomUUID(),createdAt:0,deadline:1}),{mode:0o600});
await writeFile(join(root,orphan,'archive.tgz'),'synthetic-source',{mode:0o600});
let requests=[];let ready;
const server=createServer((req,res)=>{
  const fn=req.url?.split('/').at(-1);requests.push(fn);res.setHeader('Content-Type','application/json');
  if(!['feature_one_job_maintain','feature_one_prune_retention','feature_one_feedback_prune','feature_one_job_claim','feature_one_ingestion_claim_expired'].includes(fn)){res.statusCode=400;res.end('{}');return;}
  res.end(JSON.stringify(fn==='feature_one_job_maintain'||fn==='feature_one_feedback_prune'?0:fn==='feature_one_ingestion_claim_expired'?true:null));ready?.(fn);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
try {
  for(const mode of ['--maintenance','worker']) {
    requests=[];
    let mark;const observed=new Promise(resolve=>{mark=resolve;});ready=fn=>{if(fn===(mode==='--maintenance'?'feature_one_job_maintain':'feature_one_job_claim'))mark();};
    const env={PATH:process.env.PATH,NODE_ENV:'test',SUPABASE_URL:`http://127.0.0.1:${port}`,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_ANON_KEY:'fixture-anon',
      TOKEN_ENCRYPTION_KEY:'17'.repeat(32),ADMIN_SECRET:'fixture',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'fixture',RESEND_API_KEY:'fixture',
      FEEDBACK_NOTIFICATION_EMAIL:'fixture@example.test',ENGINE_INTERNAL_KEY:'fixture',GITHUB_APP_CLIENT_ID:'fixture',GITHUB_APP_CLIENT_SECRET:'fixture',
      FEATURE_ONE_ENABLED:'false',GITHUB_APP_REPOSITORIES_ENABLED:'false',FEATURE_ONE_WORKSPACE_ROOT:root};
    const child=spawn(process.execPath,['--max-old-space-size=128',mode==='worker'?supervisor:entry,...(mode==='worker'?[]:[mode])],{cwd:base,env,stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',bytes=>{output+=bytes.toString().slice(0,8192);});child.stderr.on('data',bytes=>{output+=bytes.toString().slice(0,8192);});
    let timer;const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
    const watchdog=new Promise((_,reject)=>{timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Worker process deadline exceeded'));},15000);});
    try {
      await Promise.race([observed,exited.then(()=>{throw new Error('Worker exited before its first operation');}),watchdog]);
      child.kill('SIGTERM');assert.equal(await Promise.race([exited,watchdog]),0);
      assert.ok(requests.includes('feature_one_job_maintain'));assert.ok(requests.includes('feature_one_prune_retention'));assert.ok(requests.includes('feature_one_feedback_prune'));
      assert.doesNotMatch(output,/synthetic-source|fixture-service|fixture-sensitive/);
    } finally {clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}
  }
  assert.deepEqual(await readdir(root),[]);
  process.stdout.write('Analysis and maintenance entry points: flags-off startup, separate process, orphan cleanup, safe output, SIGTERM shutdown passed.\n');
} finally {await new Promise(resolve=>server.close(resolve));await rm(base,{recursive:true,force:true});}
