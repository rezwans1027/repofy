// Explicit local smoke command; never part of CI. One synthetic request, maximum $0.05.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { narrativeFixture } from '../../tests/helpers/narrative-fixtures';
import { OpenAIResponsesGateway } from '../../src/domain/synthesis/gateway';
import { MODEL,NARRATIVE_POLICY as P,SynthesisError } from '../../src/domain/synthesis/policy';
import { renderNarrative,validateRendered } from '../../src/domain/synthesis/narrative';
async function main(){
  let local: Record<string,string>={};
  for(const name of ['.env','.env.local']){try{local={...local,...parse(await readFile(resolve(name)))};}catch{ /* Optional local environment. */ }}
  const key=process.env.OPENAI_API_KEY||local.OPENAI_API_KEY;
  const base={checkedAt:new Date().toISOString(),purpose:'readiness_synthesis',provider:MODEL.provider,model:MODEL.version,
    promptVersion:P.version,policy:'bounded_narrative_1.0.0',schemaVersion:P.schemaVersion,pricing:P.pricing,
    data:'synthetic application-authored facts only; no user repository or source',maxRequests:1,reservedUsd:P.reserveUsd,store:false};
  let record: Record<string,unknown>;
  if(!key) record={...base,status:'blocked',code:'missing_api_key',requests:0};
  else{
    const access=await fetch(`https://api.openai.com/v1/models/${MODEL.version}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000),redirect:'error'});
    await access.body?.cancel();
    if(!access.ok){
      record={...base,status:'blocked',code:'pinned_model_unavailable',providerStatus:access.status,requests:0};
      await writeFile(resolve('../docs/benchmarks/run12-provider-smoke.json'),JSON.stringify(record,null,2)+'\n');
      process.stdout.write(JSON.stringify(record)+'\n');process.exitCode=1;return;
    }
    const f=await narrativeFixture(); const gateway=new OpenAIResponsesGateway(key);const id=randomUUID();
    let output: Awaited<ReturnType<OpenAIResponsesGateway['generate']>> | undefined;
    try{
      output=await gateway.generate(f.p.input,new AbortController().signal);
      const report=renderNarrative(f.p,output.selection,id);validateRendered(report,f.p);
      record={...base,status:'passed',requests:1,modelRunId:id,inputHash:f.p.inputHash,allowedEvidenceCount:f.p.allowedEvidenceIds.length,
        ...output.usage,estimatedCostUsd:((output.usage.inputTokens??0)*P.inputUsdPerMillion+(output.usage.outputTokens??0)*P.outputUsdPerMillion)/1000000,
        validatedClaims:report.claims.length,validatedImprovements:report.improvements.length};
    }catch(error){record={...base,status:'failed',requests:1,modelRunId:id,inputHash:f.p.inputHash,
      code:error instanceof SynthesisError?error.validationCode:'validation_failed',...(output?{usage:output.usage}:error instanceof SynthesisError?{usage:error.usage}:{})};}
  }
  await writeFile(resolve('../docs/benchmarks/run12-provider-smoke.json'),JSON.stringify(record,null,2)+'\n');
  process.stdout.write(JSON.stringify(record)+'\n'); if(record.status!=='passed')process.exitCode=1;
}
void main().catch(()=>{process.stderr.write('SMOKE_SETUP_FAILED\n');process.exitCode=1;});
