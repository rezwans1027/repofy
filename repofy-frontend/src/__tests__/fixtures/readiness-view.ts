import { AggregationResultSchema, ReadinessReportResponseSchema, ReportViewSchema, type AggregatedCapability } from '@repofy/contracts';
import { createSyntheticReportFixture } from '@repofy/contracts/testing';
export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function readinessView() {
  const report = ReadinessReportResponseSchema.parse(createSyntheticReportFixture());
  report.versions.aggregationPolicy = { id: 'evidence_aggregation', version: '1.0.0' };
  report.snapshots[0].repositoryLabel = 'Repository 1'; report.evidence[0].strength = .65; report.evidence[0].confidence = .55;
  report.evidence[0].location = undefined;
  const assessment = report.capabilityGroups[0].capabilities[0]; if (assessment.state === 'assessed') { assessment.strength = .65; assessment.confidence = .55; }
  report.capabilityGroups[0].capabilities.push({ state: 'unknown', capabilityId: 'mobile', reasons: ['unsupported_language'], explanation: 'Mobile behavior is not assessable.' },
    { state: 'not_observed', capabilityId: 'api', confidence: .55, coverageSnapshotIds: [report.snapshots[0].snapshotId], explanation: 'API behavior was not observed in the assessed scope.' });
  report.roles[0] = { state: 'assessed', template: report.roles[0].template, coverage: .0325, confidence: .0275, assessedRequirementIds: ['testing'], unknownRequirementIds: ['mobile'], limitations: ['Unknown scope remains in the denominator.'] };
  const coverage = { snapshotId: report.snapshots[0].snapshotId, repositoryId: report.snapshots[0].repositoryId,
    state: 'assessable' as const, analyzedFiles: 1, eligibleFiles: 1, excludedFiles: 0, metadataAssessed: false, fraction: 1, confidenceCeiling: .55, reasons: [] };
  const support = { evidenceId: report.evidence[0].evidenceId, snapshotId: coverage.snapshotId, repositoryId: coverage.repositoryId,
    clusterId: 'test_cluster', sourceType: 'test' as const, basis: 'implementation' as const, detector: report.evidence[0].detector, boundary: 'assertion_source' as const };
  const cap: AggregatedCapability = { capabilityId: 'testing', categoryId: 'quality', state: 'assessed', strength: .65, strengthBand: 'strong', confidence: .55, confidenceLabel: 'low',
    provenance: { state: 'unknown', value: null, policy: 'not_inferred_v1' }, evidenceIds: [support.evidenceId], support: [support], allowedClaimScopes: ['tested_behavior'], uncertainty: ['uncalibrated', 'static_only'],
    trace: { coverage: [coverage], clusters: [{ clusterId: 'test_cluster', repositoryId: coverage.repositoryId, baseEvidenceId: support.evidenceId, evidenceIds: [support.evidenceId], baseStrength: .65,
      presenceCeiling: 1, corroboration: [], strength: .65 }], selectedClusterId: 'test_cluster', combination: 'maximum_cluster_no_repository_bonus', confidence: { reliability: .55, coverageFraction: 1, coverageFactor: 1, independentSupportBonus: 0, ceiling: .55, provenanceMultiplier: null } } };
  const unknown = { ...cap, capabilityId: 'mobile', state: 'unknown', strength: null, confidence: null, strengthBand: 'unknown', confidenceLabel: null, evidenceIds: [], support: [], allowedClaimScopes: [],
    trace: { ...cap.trace, clusters: [], selectedClusterId: null, confidence: null, coverage: [{ ...coverage, state: 'not_assessable', fraction: 0 }] } };
  const req = { requirementId: 'mobile', capabilityIds: ['mobile'], required: true, weight: 1, minimumEvidence: .5, minimumConfidence: 'low', state: 'unknown', strength: null, confidence: null, satisfaction: 0, weightedContribution: 0, assessableFraction: 0, failures: [{ capabilityId: 'mobile', reasons: ['not_assessable'] }] };
  const aggregation = AggregationResultSchema.parse({ contractVersion: '1.0.0', policy: report.versions.aggregationPolicy, runId: report.analysisRunId, jobId: report.jobId, ownerUserId: report.ownerUserId, visibility: 'owner_only', versions: report.versions,
    snapshotIds: [coverage.snapshotId], inputHash: 'sha256:' + 'a'.repeat(64), capabilities: [cap, unknown, { ...unknown, capabilityId: 'api', state: 'not_observed', strength: 0, strengthBand: 'not_observed', confidence: .55, confidenceLabel: 'low', trace: { ...unknown.trace, coverage: [coverage] } }],
    roles: report.roles.map((r, i) => ({ template: r.template, state: i === 0 ? 'assessed' : 'unknown', coverage: i === 0 ? .0325 : null, confidence: i === 0 ? .0275 : null,
      denominator: 1, numerator: i === 0 ? .0325 : 0, assessableFraction: i === 0 ? .05 : 0, unknownWeight: i === 0 ? .95 : 1,
      requirements: i === 0 ? [{ ...req, requirementId: 'testing', capabilityIds: ['testing'], weight: .05, state: 'satisfied', strength: .65, confidence: .55, satisfaction: .65, weightedContribution: .0325, assessableFraction: 1, failures: [] }, { ...req, weight: .95 }] : [req],
      strongestCapabilityIds: i === 0 ? ['testing'] : [], gaps: [], leadingRepositories: i === 0 ? [{ repositoryId: coverage.repositoryId, contribution: .0325, capabilityIds: ['testing'] }] : [], limitations: ['uncalibrated'] })), validation: [], limitations: ['uncalibrated'] });
  return ReportViewSchema.parse({ report, aggregation, repositories: [{ repositoryId: coverage.repositoryId, snapshotId: coverage.snapshotId, visibility: 'private', access: 'active' }], categories: [{ categoryId: 'quality', label: 'Quality' }],
    capabilities: ['testing', 'mobile', 'api'].map(id => ({ capabilityId: id, taxonomyVersion: '1.0.0', groupId: 'quality', label: `${id[0].toUpperCase()}${id.slice(1)}`, description: 'Synthetic capability.' })),
    roleDefinitions: report.roles.map(r => ({ roleId: r.template.roleId, name: r.template.roleId, requirements: [{ requirementId: 'testing', label: 'Testing' }, { requirementId: 'mobile', label: 'Mobile' }] })) });
}
