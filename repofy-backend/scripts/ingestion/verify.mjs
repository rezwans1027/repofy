import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// Only this checked-in fixture entry point is executable. No repository path,
// package.json command, shell, lifecycle hook, or app environment is consulted.
async function run(args = []) {
  const child = spawn(process.execPath, ['--max-old-space-size=256', '--import', 'tsx', 'scripts/ingestion/fixture.ts', ...args],
    { env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
  child.stdout.on('data', data => { output += data; if (output.length > 16384) child.kill('SIGKILL'); });
  child.stderr.resume();
  try { return { code: await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); }), output }; }
  finally { clearTimeout(timer); }
}
const root = await mkdtemp(join(tmpdir(), 'repofy-ingestion-crash-'));
try {
  const normal = await run(); assert.equal(normal.code, 0); assert.equal(JSON.parse(normal.output).cleanup, 'passed');
  const crash = await run(['--crash', root]); assert.equal(crash.code, 23); assert.equal((await readdir(root)).length, 1);
  const recovered = await run(['--sweep', root]); assert.equal(recovered.code, 0);
  assert.deepEqual(JSON.parse(recovered.output), { removed: 1, failed: 0 }); assert.deepEqual(await readdir(root), []);
  console.log('Synthetic worker process, bounded heap, crash recovery and source cleanup passed.');
} finally { await rm(root, { recursive: true, force: true }); }
