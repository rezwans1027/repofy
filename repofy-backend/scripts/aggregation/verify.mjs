import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (process.argv[2] === '--child') {
  const require = createRequire(import.meta.url);
  const { aggregateEvidence } = require('../../dist/domain/aggregation/engine.js');
  const original = require('../../../docs/benchmarks/run11-example-input.json');
  const expected = require('../../../docs/benchmarks/run11-example-result.json');
  assert.deepEqual(aggregateEvidence(original), expected);
  const input = structuredClone(original);
  // Maximum cardinality, adversarial repeated weak declarations, ten selected repositories.
  // Synthetic UUIDs and file IDs are scoped to each new snapshot; there is no source or model call.
  const weak = original.evidence.find(e => e.observation.sourceType === 'dependency');
  const uuid = n => `10000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
  input.snapshots = []; input.evidence = [];
  for (let repo = 0; repo < 10; repo++) {
    const s = structuredClone(original.snapshots[0]); s.snapshotId = uuid(30000 + repo); s.repositoryId = uuid(40000 + repo); s.coverage.snapshotId = s.snapshotId;
    input.snapshots.push(s);
    for (let i = 0; i < 2000; i++) {
      const e = structuredClone(weak); Object.assign(e.observation, { evidenceId: uuid(repo * 2000 + i), snapshotId: s.snapshotId, repositoryId: s.repositoryId }); input.evidence.push(e);
    }
  }
  const started = performance.now(); const result = aggregateEvidence(input);
  assert.equal(result.capabilities.find(c => c.capabilityId === 'framework_presence').strength, .2);
  assert.ok(result.roles.every(r => r.coverage === null || r.coverage === 0));
  assert.equal(result.validation.length, 0);
  assert.throws(() => aggregateEvidence({ ...input, evidence: [...input.evidence, input.evidence[0]] }));
  const metrics = { status: 'aggregation-boundaries-ok', evidence: input.evidence.length, repositories: input.snapshots.length,
    elapsedMs: Math.ceil(performance.now() - started), maxRssMiB: Math.ceil(process.resourceUsage().maxRSS / 1024),
    resultBytes: Buffer.byteLength(JSON.stringify(result)) };
  process.stdout.write(JSON.stringify(metrics) + '\n');
} else {
  const child = spawn(process.execPath, ['--max-old-space-size=384', fileURLToPath(import.meta.url), '--child'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30000);
  const capture = chunk => { output += chunk; if (output.length > 8192) child.kill('SIGKILL'); }; child.stdout.on('data', capture); child.stderr.on('data', capture);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(timedOut, false, 'Aggregation deadline exceeded'); assert.equal(code, 0, `Aggregation process failed: ${output.slice(0, 1000)}`);
    const metrics = JSON.parse(output); assert.equal(metrics.evidence, 20000); assert.equal(metrics.repositories, 10); assert.ok(metrics.maxRssMiB < 600);
    process.stdout.write(`Aggregation verification passed (384 MiB heap; 30 second watchdog): ${JSON.stringify(metrics)}\n`);
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); }
}
