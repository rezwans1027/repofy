// Synthetic fixtures only. Import this subpath from tests, never from a production route.
import { CONTRACT_VERSION, ROLE_IDS } from "./primitives";

function id(index: number) { return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`; }
const createdAt = "2026-09-13T12:00:00.000Z";

export function createSyntheticEvidenceFixture() {
  return {
    contractVersion: CONTRACT_VERSION,
    evidenceId: id(1), snapshotId: id(2), repositoryId: id(3), commitSha: "a".repeat(40),
    sourceType: "test", repositoryVisibility: "private", visibility: "owner_only",
    detector: { id: "synthetic.fixture", version: "1.0.0" }, capabilityIds: ["testing"],
    observations: ["Synthetic fixture records a test assertion; no repository was analyzed."],
    relevance: 0.7, confidence: 0.8, strength: 0.4,
    contribution: { state: "unknown", reasons: ["metadata_unavailable"], signals: [], limitations: ["Synthetic contribution history is unavailable."] },
    createdAt, locatorId: id(4),
    locator: { kind: "file", path: "tests/synthetic.test.ts", lines: { start: 1, end: 3 } },
    fingerprint: { algorithm: "hmac-sha256", keyVersion: "1.0.0", digest: `sha256:${"b".repeat(64)}` },
  };
}

export function createSyntheticReportFixture() {
  const internal = createSyntheticEvidenceFixture();
  const { locatorId: _locatorId, locator: _locator, fingerprint: _fingerprint, ...evidence } = internal;
  const claim = {
    verification: "verified", claimId: id(9), capabilityIds: ["testing"], evidenceIds: [id(1)],
    text: "This synthetic fixture contains limited evidence of test assertions.",
  };
  return {
    contractVersion: CONTRACT_VERSION, reportId: id(5), analysisRunId: id(6), jobId: id(7), ownerUserId: id(8),
    visibility: "owner_only", createdAt,
    versions: {
      contract: CONTRACT_VERSION, snapshotIdentity: "1.0.0",
      extractorBundle: { id: "synthetic", version: "1.0.0" }, detectorBundle: { id: "synthetic", version: "1.0.0" },
      coverageManifest: "1.0.0", aggregationPolicy: { id: "synthetic", version: "1.0.0" },
      taxonomy: { id: "synthetic", version: "1.0.0" }, roleRubrics: ROLE_IDS.map((roleId) => ({ roleId, version: "1.0.0" })),
      disclosurePolicy: { id: "owner_only", version: "1.0.0" }, synthesis: { kind: "not_used" },
    },
    snapshots: [{
      contractVersion: CONTRACT_VERSION, snapshotId: id(2), repositoryId: id(3), provider: "github",
      commitSha: "a".repeat(40), repositoryVisibility: "private", repositoryLabel: "Synthetic project",
      snapshotIdentityVersion: "1.0.0", extractionPolicyVersion: "1.0.0", createdAt,
    }],
    coverage: [{
      contractVersion: CONTRACT_VERSION, snapshotId: id(2), manifestVersion: "1.0.0", detectorBundle: { id: "synthetic", version: "1.0.0" },
      languages: [{ state: "assessed", language: "typescript", depth: "structural", eligibleFiles: 2, analyzedFiles: 1, coverage: 0.5,
        limitations: ["Only one synthetic file is represented."] }], limitations: ["Fixture only."],
    }],
    evidence: [{ ...evidence, location: { label: "Synthetic test", lines: { start: 1, end: 3 } } }],
    capabilityGroups: [{ groupId: "quality", capabilities: [{
      state: "assessed", capabilityId: "testing", strength: 0.4, confidence: 0.8, evidenceIds: [id(1)], reasoning: claim,
    }] }],
    roles: ROLE_IDS.map((roleId) => ({ state: "unknown", template: { roleId, version: "1.0.0" },
      reasons: ["insufficient_evidence"], limitations: ["A single synthetic assertion does not assess role readiness."] })),
    claims: [claim],
    gaps: [{ gapId: id(10), capabilityId: "testing", state: "limited_evidence", roleIds: ["backend"], explanation: claim }],
    improvements: [{
      improvementId: id(11), title: "Demonstrate failure handling in a synthetic test", gapIds: [id(10)], capabilityIds: ["testing"],
      roleIds: ["backend"], rationale: claim, expectedProof: ["An assertion for a controlled failure case."],
      acceptanceCriteria: ["The fixture describes the expected error response."], effort: "small", priority: 0.5,
      priorityReasons: ["Adds a second kind of test evidence."], permittedLocations: [],
    }], limitations: ["Synthetic compatibility fixture; this is not a functioning readiness report."],
  };
}
