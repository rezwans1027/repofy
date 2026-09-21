// Sequential local CI parity. Logs stay in a temporary directory; the durable
// artifact contains commands, actual exit codes and timestamps, never test text.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { implementationDigest } from './source-digest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const definitions = [
  ['contracts_typecheck','packages/contracts',['run','typecheck']],
  ['contracts','packages/contracts',['test']],
  ['backend_typecheck','repofy-backend',['run','typecheck']],
  ['release_typecheck','repofy-backend',['run','release:typecheck']],
  ['backend_tests','repofy-backend',['test','--','--coverage','--maxWorkers=1']],
  ['postgres','repofy-backend',['run','test:postgres']],
  ['ingestion','repofy-backend',['run','ingestion:verify']],
  ['worker','repofy-backend',['run','worker:verify']],
  ['extraction','repofy-backend',['run','extraction:verify']],
  ['detectors','repofy-backend',['run','detectors:verify']],
  ['coverage','repofy-backend',['run','coverage:verify']],
  ['aggregation','repofy-backend',['run','aggregation:verify']],
  ['rubrics','repofy-backend',['run','rubrics:validate']],
  ['benchmark','repofy-backend',['run','release:benchmark','--','--record']],
  ['load','repofy-backend',['run','release:load','--','--record']],
  ['frontend_lint','repofy-frontend',['run','lint']],
  ['frontend_typecheck','repofy-frontend',['run','typecheck']],
  ['frontend_tests','repofy-frontend',['test','--','--coverage','--maxWorkers=1']],
  ['frontend_build','repofy-frontend',['run','build']],
  ['readiness_routes','repofy-frontend',['run','test:e2e:readiness']],
  ['selection_browser','repofy-frontend',['run','test:e2e:selection']],
  ['report_browser','repofy-frontend',['run','test:e2e:report']],
];
const logs = await mkdtemp(join(tmpdir(), 'repofy-run16-verification-'));
console.log(`Synthetic verification logs: ${logs}`);
const startedAt = new Date().toISOString(), sourceSha256 = await implementationDigest(), checks = [];
for (const [id, directory, args] of definitions) {
  const began = performance.now(), started = new Date().toISOString();
  const log = createWriteStream(join(logs, `${id}.log`), { mode: 0o600 });
  const child = spawn('npm', args, { cwd: resolve(root, directory), env: { ...process.env,
    LC_ALL: 'C', NEXT_TELEMETRY_DISABLED: '1', API_BACKEND_URL: 'http://127.0.0.1:3191/api' }, stdio: ['ignore','pipe','pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('close', code => done(code ?? 1)); });
  log.end();
  checks.push({ id, command: `npm --prefix ${directory} ${args.join(' ')}`, status: exitCode === 0 ? 'passed' : 'failed', exitCode,
    startedAt: started, finishedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - began) });
  console.log(`${id}: ${exitCode === 0 ? 'PASS' : 'FAIL'} (${checks.at(-1).durationMs} ms)`);
  const sourceUnchanged = sourceSha256 === await implementationDigest();
  const result = { startedAt, updatedAt: new Date().toISOString(), node: process.version, sourceSha256, sourceUnchanged,
    expectedChecks: definitions.map(([id]) => id), checks, allPassed: sourceUnchanged && checks.length === definitions.length && checks.every(c => c.status === 'passed'),
    scope: 'Local synthetic CI parity; no live provider, hosted account, human assistive-technology or deployed infrastructure verification' };
  await writeFile(resolve(root, 'docs/benchmarks/run16-verification.json'), JSON.stringify(result, null, 2)+'\n');
  if (exitCode !== 0 || !sourceUnchanged) { if (!sourceUnchanged) console.error('Implementation changed during verification; results are incomplete.'); process.exitCode = 1; break; }
}
