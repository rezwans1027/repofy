// Offline release measurement only. All input is checked-in synthetic text; it is
// parsed by the production ingestion/extraction pipeline and is never executed.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { cpus, platform, arch, totalmem } from 'node:os';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageFixture } from '../../tests/helpers/coverage-fixtures';
import { aggregationInput } from '../../tests/helpers/aggregation-fixtures';
import { aggregateEvidence } from '../../src/domain/aggregation/engine';
import { observeProvenance } from '../../src/domain/provenance/policy';
import { prepareNarrative, renderNarrative, validateRendered, generalizedNarrative } from '../../src/domain/synthesis/narrative';
import { synthesisVersion, NARRATIVE_POLICY } from '../../src/domain/synthesis/policy';
import { DETECTORS } from '../../src/domain/detectors/registry';
import { initialRubricCatalog } from '../../src/domain/rubrics/catalog';
import { evaluateRequirement } from '../../src/domain/rubrics/policy';
import { observations, proportion, quantile, type Observation } from './metrics';
import { measureReview } from './review';

const directory = dirname(fileURLToPath(import.meta.url)), backend = resolve(directory, '../..');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export interface CorpusCase { id: string; split: 'evaluation'; roles: string[]; files: Record<string,string>;
  referenceObservations: Observation[]; validAlternatives: string[]; uncertainty: string;
  provider: { fork: boolean | null; templateOrigin: 'unknown' | 'declared' } }
export async function readCorpus() {
  const bytes = await readFile(join(directory, 'corpus.json'));
  const sha256 = hash(bytes);
  assert.equal(sha256, (await readFile(join(directory, 'corpus.sha256'), 'utf8')).trim(), 'Frozen corpus changed: version and review a new corpus explicitly');
  const corpus = JSON.parse(bytes.toString()) as { id: string; version: string; splitPolicy: string; measurementUnit: string; developmentSources: string[]; cases: CorpusCase[] };
  assert.equal(corpus.cases.length, 24); assert.equal(new Set(corpus.cases.map(c => c.id)).size, corpus.cases.length);
  for (const c of corpus.cases) {
    assert.match(c.id, /^[a-z_]+$/); assert.equal(c.split, 'evaluation');
    assert.ok(c.referenceObservations.every(e => c.files[e.path] !== undefined && DETECTORS.some(d => d.id === e.detector)));
  }
  return { corpus, sha256 };
}
export async function sourceDigest() {
  const chunks: string[] = [];
  async function visit(dir: string) {
    for (const entry of (await readdir(dir)).sort()) {
      const file = join(dir, entry); if ((await stat(file)).isDirectory()) await visit(file);
      else if (/\.(ts|json)$/.test(entry)) chunks.push(`${relative(backend, file)}:${hash(await readFile(file))}`);
    }
  }
  await visit(join(backend, 'src/domain')); return hash(chunks.join('\n'));
}
export async function benchmark() {
  const { corpus, sha256 } = await readCorpus();
  const cases: Record<string, any>[] = [], expected: Observation[] = [], actual: Observation[] = [];
  let referenceCount = 0, invalidReferences = 0, majorClaimCount = 0, invalidMajorReferences = 0, privacyFailures = 0, provenanceErrors = 0;
  const now = '2026-09-20T00:00:00.000Z';
  for (const sample of corpus.cases) {
    const started = performance.now();
    const f = await coverageFixture(sample.files);
    try {
      const { bundle } = await f.extract();
      const detected = bundle.evidence.filter(e => e.implementation && e.locator.kind === 'file').map(e => ({ detector: e.detector.id, path: e.locator.kind === 'file' ? e.locator.path : '' }));
      expected.push(...sample.referenceObservations.map(e => ({ ...e, path: `${sample.id}/${e.path}` })));
      actual.push(...detected.map(e => ({ ...e, path: `${sample.id}/${e.path}` })));
      // Verify each recorded source span against the frozen safe synthetic input.
      for (const e of bundle.evidence) if (e.locator.kind === 'file') {
        referenceCount++;
        const source = sample.files[e.locator.path], lines = e.locator.lines;
        if (source === undefined || lines && (lines.start < 1 || lines.end < lines.start || lines.end > source.split('\n').length)) invalidReferences++;
      }
      const input = aggregationInput([bundle]);
      input.versions.synthesis = synthesisVersion(); input.versions.disclosurePolicy = { id: 'candidate_private', version: '1.0.0' };
      const old = aggregateEvidence(input);
      input.versions.aggregationPolicy.version = '1.1.0';
      const snapshot = bundle.snapshot;
      const provenance = observeProvenance({ snapshotId: snapshot.snapshotId, repositoryId: snapshot.repositoryId, commitSha: snapshot.commitSha,
        providerRepositoryId: snapshot.providerRepositoryId, visibility: snapshot.repositoryVisibility, accountId: randomUUID(), installationId: randomUUID(),
        totalFiles: bundle.inventorySummary.totalFiles, generatedMarked: bundle.coverage.implementation?.generatedFiles ?? 0,
        exclusions: bundle.inventorySummary.structural?.exclusions ?? null, history: null, commits: [] },
      { state: 'available', ...sample.provider, relationship: 'current_repository_context' }, now);
      input.provenance = { policy: { id: 'provenance_context', version: '1.0.0' }, snapshots: [provenance] };
      const aggregation = aggregateEvidence(input);
      assert.deepEqual(aggregation.roles, old.roles, 'Provenance changed role arithmetic');
      assert.deepEqual(aggregation.capabilities.map(({ provenance: _p, ...c }) => c), old.capabilities.map(({ provenance: _p, ...c }) => c));
      if (provenance.contribution.state !== 'unknown' || provenance.contribution.confidence !== null || provenance.contribution.strengthModifier !== null || provenance.contribution.confidenceModifier !== null) provenanceErrors++;
      const { branch: _b, providerRepositoryId: _p, ...ownerSnapshot } = snapshot;
      const evidence = bundle.evidence.map(({ locator: _l, locatorId: _i, fingerprint: _f, ...e }) => e);
      const p = prepareNarrative({ aggregation, snapshots: [{ ...ownerSnapshot, repositoryLabel: 'Repository' }], coverage: [bundle.coverage], evidence, createdAt: now });
      const choice = { schemaVersion: '1.0.0', explanations: p.input.explanations.map(e => ({ capabilityId: e.capabilityId, statementId: e.statementId, evidenceIds: e.evidenceIds, style: 'observation_first' })),
        improvements: p.input.gaps.map(g => ({ gapId: g.gapId, templateId: g.templates[0].templateId, focus: 'proof' })) };
      const report = renderNarrative(p, choice, randomUUID()); validateRendered(report, p);
      const major = report.claims.filter(c => c.verification === 'verified');
      majorClaimCount += major.length;
      for (const c of major) {
        referenceCount++;
        if (c.verification !== 'verified' || !c.evidenceIds.length || c.evidenceIds.some(id => !report.evidence.some(e => e.evidenceId === id))) { invalidReferences++; invalidMajorReferences++; }
      }
      const projected = generalizedNarrative(report, p);
      if (/RUN16_(?:PRIVATE|HIDDEN|EXECUTION)|PRIVATE_RECORDS|ghp_Z{10}/.test(JSON.stringify({ input: p.input, report, projected }))) privacyFailures++;
      if (/"(?:repositoryId|snapshotId|evidenceId|ownerUserId|commitSha|path|source|text)"/.test(JSON.stringify(projected))) privacyFailures++;
      cases.push({ id: sample.id, roles: sample.roles, result: bundle.coverage.assessment!.result,
        counts: bundle.coverage.assessment!.counts, metrics: observations(sample.referenceObservations, detected),
        validAlternatives: sample.validAlternatives, signals: provenance.signals, contribution: provenance.contribution,
        elapsedMs: Math.ceil(performance.now() - started),
        capabilities: aggregation.capabilities.map(c => ({ id: c.capabilityId, state: c.state, strength: c.strength, confidence: c.confidence, confidenceLabel: c.confidenceLabel })),
        rolesResult: aggregation.roles.map(r => ({ role: r.template.roleId, state: r.state, coverage: r.coverage, unknownWeight: r.unknownWeight })),
        // All text is application-authored; no source, paths or private identifiers.
        claims: major.map(c => ({ capability: c.verification === 'verified' ? c.capabilityIds[0] : null, text: c.text,
          statementId: p.input.explanations.find(e => c.verification === 'verified' && e.capabilityId === c.capabilityIds[0])!.statementId })),
        versions: input.versions });
    } finally { await f.cleanup(); }
  }
  const totals = observations(expected, actual);
  const byDetector = DETECTORS.map(d => ({ detector: d.id, ...observations(expected.filter(e => e.detector === d.id), actual.filter(e => e.detector === d.id)) }));
  const rubricBytes = await readFile(join(directory, 'rubric-cases.json'));
  const rubricSha256 = hash(rubricBytes);
  assert.equal(rubricSha256, (await readFile(join(directory, 'rubric-cases.sha256'), 'utf8')).trim());
  const rubricCases = JSON.parse(rubricBytes.toString());
  const rubricResults = rubricCases.cases.map((c: any) => {
    const role = initialRubricCatalog.rubrics.find(r => r.roleId === c.role)!;
    const requirement = role.requirements.find(r => r.requirementId === c.requirement)!;
    const result = evaluateRequirement(requirement, c.inputs);
    const measured = { state: result.state, strength: result.state === 'unknown' ? null : result.strength,
      weightedContribution: result.state === 'satisfied' ? Math.round(requirement.weight * result.strength * 1e6) / 1e6 : 0,
      unknownWeightRetained: result.state === 'unknown' ? requirement.weight : 0 };
    assert.deepEqual(measured, c.expected, `Rubric boundary mismatch: ${c.id}`);
    return { id: c.id, role: c.role, requirement: c.requirement, measured };
  });
  // Persist the actual reviewed rendering. Fresh synthetic UUIDs may choose a
  // different equally ranked observation; never transfer a prior label to it.
  const review = JSON.parse(await readFile(resolve(backend, '../docs/benchmarks/run16-human-review.json'), 'utf8'));
  const reviewedBytes = await readFile(resolve(backend, '../docs/benchmarks/run16-reviewed-rendering.json'));
  const reviewed = JSON.parse(reviewedBytes.toString()), domainSourceSha256 = await sourceDigest();
  assert.equal(reviewed.corpusSha256, sha256);
  assert.equal(reviewed.domainSourceSha256, domainSourceSha256, 'Reviewed rendering predates a domain change; review the new version');
  const humanReview = measureReview(review, { corpusSha256: sha256, rubricCasesSha256: rubricSha256,
    renderingSha256: hash(reviewedBytes), cases: reviewed.cases, rubricCases: rubricCases.cases });
  const differingReviewCards = review.claimCards.filter((c: any) => c.majorClaim && !cases.find(r => r.id === c.caseId)!.claims.some((claim: any) => claim.text === c.claim && claim.statementId === c.statementId)).map((c: any) => c.id);
  return {
    corpus: { id: corpus.id, version: corpus.version, sha256, splitPolicy: corpus.splitPolicy, measurementUnit: corpus.measurementUnit },
    measuredAt: new Date().toISOString(), domainSourceSha256,
    developmentSources: await Promise.all(corpus.developmentSources.map(async path => ({ path, sha256: hash(await readFile(join(backend, path))) }))),
    environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem() / 2 ** 30), concurrency: 1, host: 'shared_local_development_machine' },
    metrics: { knownDetectorObservations: totals, byDetector, validReferences: proportion(referenceCount - invalidReferences, referenceCount),
      validMajorClaimReferences: proportion(majorClaimCount - invalidMajorReferences, majorClaimCount),
      privateDisclosureFailures: privacyFailures, contributionConfidenceErrors: provenanceErrors,
      humanClaimSupport: humanReview.humanClaimSupport, unsupportedMajorClaimRate: humanReview.unsupportedMajorClaimRate, roleRubricCalibration: null,
      extractionThroughRenderingMs: { p50: quantile(cases.map(c => c.elapsedMs), .5), p95: quantile(cases.map(c => c.elapsedMs), .95) },
      syntheticCasesCompleted: proportion(cases.length, corpus.cases.length), peakRssMiB: Math.ceil(process.resourceUsage().maxRSS / 1024),
      actualProviderCostUsd: 0, providerCalls: 0, modelQualityMeasured: false, configuredJobCostCapUsd: NARRATIVE_POLICY.jobBudgetUsd },
    limitations: ['Authored synthetic evaluation, not independent calibration', 'Small per-detector counts; empty denominators are null',
      'No provider/network/queue/database cost or latency in this component benchmark', 'Human semantics, role weights and production workload targets require separate evidence'],
    humanReview, reviewedRendering: { sha256: hash(reviewedBytes), renderedAt: reviewed.renderedAt, differingReviewCards,
      scope: 'Human rates describe the frozen reviewed output only. Fresh identity tie selections listed here are not newly human-approved.' },
    rubricBoundaries: { sha256: rubricSha256, passed: rubricResults.length, results: rubricResults, empiricallyCalibrated: false }, cases,
  };
}
async function main() {
  const result = await benchmark();
  if (process.argv.includes('--record')) await writeFile(resolve(directory, '../../../docs/benchmarks/run16-results.json'), JSON.stringify(result, null, 2) + '\n');
  const m = result.metrics;
  console.log(JSON.stringify({ corpus: result.corpus, metrics: m }, null, 2));
  assert.equal(m.validReferences.rate, 1); assert.equal(m.privateDisclosureFailures, 0); assert.equal(m.contributionConfidenceErrors, 0);
  assert.equal(m.knownDetectorObservations.fp, 0, 'Frozen evaluation found unexpected detector observations');
  // Keep measured false negatives in the result. Only the documented exact
  // omission is accepted by the regression gate; novel omissions still fail CI.
  const known = JSON.parse(await readFile(join(directory, 'known-limitations.json'), 'utf8'));
  assert.equal(known.corpusVersion, result.corpus.version);
  assert.deepEqual(m.knownDetectorObservations.missing, known.missing, 'Evaluation omissions changed; review the evidence before updating a baseline');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : 'Release benchmark failed; inspect synthetic fixture locally'); process.exitCode = 1;
});
