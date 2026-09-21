import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Fixed application entry, heap ceiling, independent deadline and captured output.
// Never executes a repository file, command, package script or plugin.
if (process.argv[2] === '--child') {
  const require = createRequire(import.meta.url);
  const { dataDocument, sourceFile } = require('../../dist/domain/extraction/parsers.js');
  const { EXTRACTORS } = require('../../dist/domain/extraction/pipeline.js');
  const { classify } = require('../../dist/domain/extraction/inventory.js');
  const { EXTRACTION_LIMITS } = require('../../dist/domain/extraction/policy.js');
  const execute = (path, text) => EXTRACTORS[classify(path).family].extract({ path, text, ...classify(path) });
  const dangerousConfig = "globalThis.__repositoryExecuted = true; throw new Error('TEST_ONLY_EXECUTION_SENTINEL'); export default { test: true };";
  const configured = execute('vitest.config.ts', dangerousConfig);
  assert.equal(globalThis.__repositoryExecuted, undefined);
  assert.equal(configured.findings[0].detail.claimBoundary, 'configuration_presence');
  assert.doesNotMatch(JSON.stringify(configured), /TEST_ONLY_EXECUTION_SENTINEL/);
  for (const [text, format] of [
    ['x: &x [1]\ny: *x', 'yaml'], ['{"x":'.repeat(5000) + '0' + '}'.repeat(5000), 'json'],
    ["# unclosed quote '\nx: " + '['.repeat(4000) + '0' + ']'.repeat(4000), 'yaml'],
    ['x=['.repeat(1000) + '1' + ']'.repeat(1000), 'toml'],
  ]) assert.throws(() => dataDocument(text, format));
  assert.throws(() => sourceFile('('.repeat(5000) + 'x' + ')'.repeat(5000), 'input.ts'));
  assert.throws(() => dataDocument('x'.repeat(EXTRACTION_LIMITS.fileBytes + 1), 'json'));
  assert.deepEqual(execute('package.json', '{"dependencies":{"react":"19"}}').findings[0].detail.technologies, ['react']);
  process.stdout.write('structural-parser-boundaries-ok\n');
} else {
  const child = spawn(process.execPath, ['--max-old-space-size=256', fileURLToPath(import.meta.url), '--child'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15000);
  const capture = chunk => { output += chunk; if (output.length > 8192) child.kill('SIGKILL'); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(timedOut, false, 'Parser deadline exceeded'); assert.equal(code, 0, 'Parser subprocess failed');
    assert.equal(output, 'structural-parser-boundaries-ok\n', 'Unexpected parser output');
    process.stdout.write('Structural extraction process verification passed (256 MiB heap; 15 second deadline).\n');
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); }
}
