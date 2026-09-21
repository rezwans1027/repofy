import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (process.argv[2] === '--child') {
  const require = createRequire(import.meta.url);
  const { baselineTree, extractBaseline } = require('../../dist/domain/extraction/baseline.js');
  const started = performance.now(); let observations = 0;
  const inputs = [
    { path: 'app.py', language: 'python', classification: 'code', text: 'import os\nclass Example:\n def value(self):\n  return 1\ndef test_value():\n assert Example().value() == 1\n' },
    { path: 'Example.java', language: 'java', classification: 'code', text: 'class Example { @Deprecated int value() { return 1; } }' },
    { path: 'pom.xml', language: 'xml', classification: 'config', text: '<project><modelVersion>4.0.0</modelVersion><dependencies><dependency><groupId>junit</groupId><artifactId>junit</artifactId><scope>test</scope></dependency></dependencies></project>' },
  ];
  for (let i = 0; i < 100; i++) for (const input of inputs) {
    const result = extractBaseline(input, []); assert.equal(result.state, 'analyzed'); observations += result.findings.length;
    assert.doesNotMatch(JSON.stringify(result), /class Example|def test_value|<project>|import os/);
  }
  for (const [language, text] of [
    ['python', 'def invalid(:\n pass'], ['java', 'class {'], ['python', 'value=' + '['.repeat(5000) + '0' + ']'.repeat(5000)],
    ['java', 'class Many {' + 'int value;'.repeat(6000) + '}'], ['python', '# ' + 'x'.repeat(262144)],
    ['maven', '<project><modelVersion>4.0.0</project>'], ['maven', '<a>'.repeat(100) + '</a>'.repeat(100)],
  ]) assert.throws(() => baselineTree(text, language), e => ['limited', 'parse_failure'].includes(e.message));
  assert.throws(() => extractBaseline({ ...inputs[2], text: '<!DOCTYPE project SYSTEM "https://example.invalid/external">' + inputs[2].text }, []));
  const metrics = { status: 'baseline-boundaries-ok', files: 300, observations, elapsedMs: Math.ceil(performance.now() - started), maxRssMiB: Math.ceil(process.resourceUsage().maxRSS / 1024) };
  process.stdout.write(JSON.stringify(metrics) + '\n');
} else {
  const child = spawn(process.execPath, ['--max-old-space-size=256', fileURLToPath(import.meta.url), '--child'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15000);
  const capture = chunk => { output += chunk; if (output.length > 8192) child.kill('SIGKILL'); }; child.stdout.on('data', capture); child.stderr.on('data', capture);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(timedOut, false, 'Baseline parser deadline exceeded'); assert.equal(code, 0, 'Baseline parser process failed');
    const metrics = JSON.parse(output); assert.equal(metrics.status, 'baseline-boundaries-ok'); assert.equal(metrics.files, 300);
    assert.ok(metrics.maxRssMiB > 0 && metrics.maxRssMiB < 384);
    process.stdout.write(`Baseline parser verification passed (256 MiB heap; 15 second watchdog): ${JSON.stringify(metrics)}\n`);
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); }
}
