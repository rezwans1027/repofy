import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus, sourceDigest } from './benchmark';
import { humanBoundaryGate, measureSourceBoundReview } from './review';
import { rolloutDecision, type Gate } from './metrics';
// @ts-expect-error Shared operational ESM digest, also used without a TS loader.
import { implementationDigest } from './source-digest.mjs';

const directory = dirname(fileURLToPath(import.meta.url)), root = resolve(directory, '../../..');
const externalIds = ['independent_calibration','live_github','live_model','deployment_operations','representative_capacity',
  'manual_assistive_technology','hosted_app_regression','required_ci_protection'];
const requiredChecks = ['contracts_typecheck','contracts','backend_typecheck','release_typecheck','backend_tests','postgres','ingestion','worker','extraction',
  'detectors','coverage','aggregation','rubrics','benchmark','load','frontend_lint','frontend_typecheck','frontend_tests','frontend_build','readiness_routes','selection_browser','report_browser'];
async function main() {
  const read = async (name: string) => JSON.parse(await readFile(resolve(root, `docs/benchmarks/run16-${name}.json`),'utf8'));
  const [benchmark, load, verification, preflight, review, external] = await Promise.all(['results','load','verification','preflight','human-review','external-gates'].map(read));
  const { sha256 } = await readCorpus();
  assert.equal(benchmark.corpus.sha256, sha256); assert.equal(load.corpus.sha256, sha256);
  assert.equal(benchmark.domainSourceSha256, await sourceDigest(), 'Benchmark predates current domain implementation');
  const rubricBytes = await readFile(resolve(directory,'rubric-cases.json'));
  const rubricSha = createHash('sha256').update(rubricBytes).digest('hex');
  assert.equal(rubricSha, (await readFile(resolve(directory,'rubric-cases.sha256'),'utf8')).trim());
  const reviewedBytes = await readFile(resolve(root,'docs/benchmarks/run16-reviewed-rendering.json'));
  const reviewed = JSON.parse(reviewedBytes.toString());
  assert.equal(reviewed.corpusSha256, sha256);
  const human = measureSourceBoundReview(review, { corpusSha256: sha256, rubricCasesSha256: rubricSha,
    renderingSha256: createHash('sha256').update(reviewedBytes).digest('hex'), cases: reviewed.cases, rubricCases: JSON.parse(rubricBytes.toString()).cases },
  { reviewedDomainSourceSha256: reviewed.domainSourceSha256, currentDomainSourceSha256: benchmark.domainSourceSha256 });
  assert.deepEqual(benchmark.humanReview, human, 'Benchmark must be regenerated after review updates');
  assert.deepEqual(benchmark.metrics.humanClaimSupport, human.humanClaimSupport, 'Benchmark human metrics must reflect the current implementation');
  assert.deepEqual(benchmark.metrics.unsupportedMajorClaimRate, human.unsupportedMajorClaimRate, 'Benchmark human metrics must reflect the current implementation');
  const localPassed = verification.allPassed === true && verification.sourceSha256 === await implementationDigest()
    && new Set(verification.checks.map((c: any) => c.id)).size === requiredChecks.length
    && requiredChecks.every(id => verification.checks.some((c: any) => c.id === id && c.status === 'passed' && c.exitCode === 0));
  const m = benchmark.metrics, api = load.latencyMs.api;
  const localPerformance = load.completion.rate >= .95 && load.latencyMs.endToEnd.p50 < 240000 && load.latencyMs.endToEnd.p95 < 720000
    && ['job_read','report_view','history','evidence'].every(id => api[id]?.samples > 0 && api[id].p95 < 500);
  const known = JSON.parse(await readFile(resolve(directory,'known-limitations.json'),'utf8'));
  const detectorPassed = m.knownDetectorObservations.fp === 0 && JSON.stringify(m.knownDetectorObservations.missing) === JSON.stringify(known.missing);
  const gates: Gate[] = [
    { id: 'local_verification', status: localPassed ? 'passed' : 'failed', evidence: 'run16-verification.json: all 22 required checks must pass against the current implementation digest' },
    { id: 'major_references', status: m.validMajorClaimReferences.total > 0 && m.validMajorClaimReferences.rate === 1 ? 'passed' : 'failed', evidence: 'run16-results.json: major claim evidence membership; file spans checked separately' },
    { id: 'local_privacy_recovery', status: localPassed && m.privateDisclosureFailures === 0 && m.contributionConfidenceErrors === 0 && load.cleanup.terminalWorkspacesRemaining === 0 ? 'passed' : 'failed', evidence: 'Corpus, real PostgreSQL concurrency/ownership, process cleanup and browser sentinel checks; external surfaces remain pending' },
    { id: 'detector_regression', status: detectorPassed ? 'passed' : 'failed', evidence: '24 TP, 0 FP, 1 documented FN against frozen references; R16-Q01 remains a measured limitation' },
    humanBoundaryGate(human),
    { id: 'local_workload', status: localPerformance ? 'passed' : 'failed', evidence: 'run16-load.json: synthetic loopback workload, separate queue/stage/API timings; no population or deployed SLA claim' },
    { id: 'local_intake_disabled', status: Object.keys(preflight.flags).length === 6 && Object.values(preflight.flags).every((f: any) => f.value === false) && preflight.allowlistEntries === 0 ? 'passed' : 'failed', evidence: 'run16-preflight.json: local configuration only; no flags or remote resources changed' },
  ];
  for (const gate of external.gates) {
    assert.ok(externalIds.includes(gate.id));
    assert.ok(gate.owner?.trim() && gate.evidence?.trim());
    assert.ok(['passed','failed','pending'].includes(gate.status));
    if (gate.status === 'passed') assert.ok(gate.reviewedAt && gate.reviewer && gate.artifact, 'External pass needs an attributable dated artifact');
    gates.push({ id: gate.id, status: gate.status, evidence: gate.evidence });
  }
  const result = { assessedAt: new Date().toISOString(), scope: 'Feature 1 private internal rollout; no authorization to deploy or enable',
    ...rolloutDecision(gates, ['local_verification','major_references','local_privacy_recovery','detector_regression','human_boundary_sample','local_workload','local_intake_disabled', ...externalIds]),
    gates, sourceSha256: verification.sourceSha256, corpusSha256: sha256,
    deferred: ['ANA-020 GitHub issue creation', 'Features 2–6 and public/employer disclosure workflows'],
    note: 'Local implementation and verification can be complete while rollout remains on hold. Missing checks and credentials are never passes.' };
  if (process.argv.includes('--record')) await writeFile(resolve(root,'docs/benchmarks/run16-release-decision.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if (process.argv.includes('--require-ready') && result.decision === 'hold') process.exitCode = 1;
}
void main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : 'Release evidence missing or invalid; rollout remains on hold'); process.exitCode = 1; });
