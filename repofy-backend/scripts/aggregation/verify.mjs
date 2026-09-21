import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

if (process.argv[2] === '--child') {
  const require = createRequire(import.meta.url);
  const { aggregateEvidence } = require('../../dist/domain/aggregation/engine.js');
  // Old artifacts retain their original policy; current code must not silently
  // reinterpret them. Their reviewed calculations remain historical records.
  const historical = require('../../../docs/benchmarks/run11-example-input.json');
  assert.throws(() => aggregateEvidence(historical), /ANALYSIS_VALIDATION_FAILED/);
  const original = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const baseline = aggregateEvidence(original);
  const retry = baseline.capabilities.find(c => c.capabilityId === 'performance_resources');
  // Independent arithmetic for the fixed retry + linked-test fixture:
  // .55 implementation + .10 independent assertion; .05 role weight * .65.
  assert.equal(retry.strength, .65); assert.equal(retry.confidence, .55); assert.equal(retry.confidenceLabel, 'low');
  assert.equal(retry.trace.clusters[0].corroboration.length, 1);
  assert.equal(baseline.capabilities.find(c => c.capabilityId === 'framework_presence').strength, .2);
  assert.equal(baseline.roles.find(r => r.template.roleId === 'backend').coverage, .0325);
  assert.equal(baseline.capabilities.find(c => c.capabilityId === 'mobile_lifecycle').strength, null);
  assert.equal(baseline.validation.length, 0);
  const reordered = structuredClone(original);
  reordered.snapshots.reverse(); reordered.snapshots.forEach(s => s.files.reverse()); reordered.evidence.reverse();
  assert.deepEqual(aggregateEvidence(reordered), baseline);
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
  async function boundedChild(args, label) {
    const child = spawn(process.execPath, args, {
      env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '', timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30000);
    const capture = chunk => { output += chunk; if (output.length > 8192) child.kill('SIGKILL'); }; child.stdout.on('data', capture); child.stderr.on('data', capture);
    try {
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      assert.equal(timedOut, false, `${label} deadline exceeded`); assert.equal(code, 0, `${label} process failed: ${output.slice(0, 1000)}`);
      return output;
    } finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); }
  }
  const directory = await mkdtemp(join(tmpdir(), 'repofy-aggregation-'));
  try {
    const input = join(directory, 'current-synthetic-input.json');
    await boundedChild(['--max-old-space-size=384', '--import', 'tsx', fileURLToPath(new URL('./prepare.ts', import.meta.url)), input], 'Fixture preparation');
    const output = await boundedChild(['--max-old-space-size=384', fileURLToPath(import.meta.url), '--child', input], 'Aggregation');
    const metrics = JSON.parse(output); assert.equal(metrics.evidence, 20000); assert.equal(metrics.repositories, 10); assert.ok(metrics.maxRssMiB < 600);
    process.stdout.write(`Aggregation verification passed (384 MiB heap; 30 second watchdog): ${JSON.stringify(metrics)}\n`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
