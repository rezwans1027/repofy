import { randomUUID } from "node:crypto";
import { createSyntheticReportFixture, createSyntheticEvidenceFixture } from "@repofy/contracts/testing";
import { ReadinessReportResponseSchema } from "@repofy/contracts";
import { SnapshotBundleSchema } from "../../src/domain/analysis/persistence";
import { LocatorCrypto } from "../../src/domain/evidence/locator-crypto";

/** Synthetic material only; safe to use in a real, isolated PostgreSQL test database. */
export const fixtureCrypto = () => new LocatorCrypto({ activeVersion: "1.0.0", keys: {
  "1.0.0": { encryptionKey: Buffer.alloc(32, 17), fingerprintKey: Buffer.alloc(32, 29) },
} });
export const fixtureDate = "2026-09-13T12:00:00.000Z";
// Synthetic rubrics must never collide with published production role versions.
export const syntheticRubricVersion = "0.0.1";
export function grantFacts(user = "100", repository = "300") {
  return {
    providerUserId: user, login: `synthetic-${user}`, providerInstallationId: "500", providerOwnerId: "600",
    ownerType: "Organization" as const, providerRepositoryId: repository, visibility: "private" as const,
    verifiedAt: fixtureDate, attestationId: randomUUID(), statementVersion: "1.0.0", attestedAt: fixtureDate,
  };
}
export function snapshotBundle(repositoryId: string, providerRepositoryId = "300") {
  const template = createSyntheticReportFixture();
  template.versions.roleRubrics.forEach(role => { role.version = syntheticRubricVersion; });
  const evidence = createSyntheticEvidenceFixture();
  const snapshotId = randomUUID(); const locatorId = randomUUID();
  const snapshot = { ...template.snapshots[0], snapshotId, repositoryId, providerRepositoryId, branch: "fixture-sensitive-branch" };
  const { repositoryLabel: _label, ...internalSnapshot } = snapshot;
  return SnapshotBundleSchema.parse({
    snapshot: internalSnapshot, versions: template.versions,
    coverage: { ...template.coverage[0], snapshotId },
    inventorySummary: {
      contractVersion: "1.0.0", snapshotId, extractorBundle: template.versions.extractorBundle,
      totalFiles: 2, eligibleFiles: 2, excludedFiles: 0, analyzedFiles: 1,
      languages: [{ language: "typescript", files: 2 }], frameworks: [], testFiles: 1, configFiles: 0, documentationFiles: 0, ciFiles: 0,
      metadata: { commits: false, pullRequests: false, ci: false }, limitations: ["Synthetic fixture only."],
    },
    files: [
      { locatorId, locator: evidence.locator, language: "typescript", sizeBytes: 100, classification: "test", eligible: true, analyzed: true },
      { locatorId: randomUUID(), locator: { kind: "file", path: "src/synthetic.ts" }, language: "typescript", sizeBytes: 200, classification: "code", eligible: true, analyzed: false },
    ],
    evidence: [{ ...evidence, evidenceId: randomUUID(), locatorId, snapshotId, repositoryId }],
  });
}
export function multiRepositoryReport(actor: string, jobId: string, runId: string, bundles: ReturnType<typeof snapshotBundle>[]) {
  const base = createSyntheticReportFixture();
  base.versions = structuredClone(bundles[0].versions);
  base.roles.forEach(role => { role.template.version = base.versions.roleRubrics.find(item => item.roleId === role.template.roleId)!.version; });
  const evidenceIds = bundles.map(bundle => bundle.evidence[0].evidenceId);
  const report = {
    ...base, reportId: randomUUID(), ownerUserId: actor, jobId, analysisRunId: runId,
    snapshots: bundles.map(({ snapshot }) => {
      const { branch: _branch, providerRepositoryId: _provider, ...owner } = snapshot;
      return { ...owner, repositoryLabel: "Synthetic project" };
    }),
    coverage: bundles.map(bundle => bundle.coverage),
    evidence: bundles.flatMap(bundle => bundle.evidence.map(({ locator: _locator, locatorId: _id, fingerprint: _fp, ...observation }) =>
      ({ ...observation, location: { label: "Synthetic test", lines: { start: 1, end: 3 } } }))),
    capabilityGroups: structuredClone(base.capabilityGroups),
    claims: structuredClone(base.claims), gaps: structuredClone(base.gaps), improvements: structuredClone(base.improvements),
  };
  report.capabilityGroups[0].capabilities[0].evidenceIds = evidenceIds;
  report.capabilityGroups[0].capabilities[0].reasoning.evidenceIds = evidenceIds;
  report.claims[0].evidenceIds = evidenceIds;
  report.gaps[0].explanation.evidenceIds = evidenceIds;
  report.improvements[0].rationale.evidenceIds = evidenceIds;
  return ReadinessReportResponseSchema.parse(report);
}
