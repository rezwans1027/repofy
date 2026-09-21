const { test } = require("node:test");
const assert = require("node:assert/strict");
const c = require("../dist/index.js");
const internal = require("../dist/internal.js");
const { createSyntheticEvidenceFixture, createSyntheticReportFixture } = require("../dist/testing.js");

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const start = () => ({ contractVersion: "1.0.0", repositoryIds: [uuid(3)], idempotencyKey: "synthetic-request-1" });

test("timestamps accept canonical UTC seconds/fractions and reject local or invalid dates", () => {
  for (const value of ["2026-09-13T12:00:00Z", "2026-09-13T12:00:00.000Z"]) assert.equal(c.TimestampSchema.safeParse(value).success, true);
  for (const value of ["2026-09-13T12:00:00", "2026-02-30T12:00:00Z", "2026-09-13T12:00Z"]) assert.equal(c.TimestampSchema.safeParse(value).success, false);
});

test("UUID normalization prevents case variants from duplicating selected repositories", () => {
  const lower = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.equal(c.RepositoryIdSchema.parse(lower.toUpperCase()), lower);
  assert.equal(c.StartAnalysisRequestSchema.safeParse({ ...start(), repositoryIds: [lower, lower.toUpperCase()] }).success, false);
});

test("verified identities are provider references, not customizable display names", () => {
  const identity = { githubAccountId: uuid(13), userId: uuid(8), provider: "github", providerUserId: "123",
    verifiedAt: "2026-09-13T12:00:00Z" };
  assert.equal(c.VerifiedIdentityReferenceSchema.safeParse(identity).success, true);
  for (const overrides of [{ providerUserId: 123 }, { providerUserId: "username" }, { displayName: "Synthetic user" }, { verifiedAt: undefined }]) {
    assert.equal(c.VerifiedIdentityReferenceSchema.safeParse({ ...identity, ...overrides }).success, false);
  }
});

test("attestations bind a server-stamped user, installation, selected repositories and grants", () => {
  const attestation = { contractVersion: "1.0.0", attestationId: uuid(14), userId: uuid(8), githubAccountId: uuid(13),
    installationId: uuid(15), repositoryIds: [uuid(3)], accessGrantIds: [uuid(16)], statementVersion: "1.0.0",
    authorized: true, attestedAt: "2026-09-13T12:00:00Z" };
  assert.equal(c.AccessAttestationSchema.safeParse(attestation).success, true);
  assert.equal(c.AccessAttestationSchema.safeParse({ ...attestation, authorized: false }).success, false);
  assert.equal(c.AccessAttestationSchema.safeParse({ ...attestation, accessGrantIds: [] }).success, false);
});

test("snapshots retain exact provider identity and versioned commit pinning", () => {
  const { repositoryLabel: _label, ...owner } = createSyntheticReportFixture().snapshots[0];
  const snapshot = { ...owner, providerRepositoryId: "456", branch: "main" };
  assert.equal(c.RepositorySnapshotSchema.safeParse(snapshot).success, true);
  for (const overrides of [{ provider: "gitlab" }, { commitSha: "main" }, { branch: "main..old" }, { extractionPolicyVersion: undefined }, { archiveUrl: "synthetic" }]) {
    assert.equal(c.RepositorySnapshotSchema.safeParse({ ...snapshot, ...overrides }).success, false);
  }
});

test("CommonJS and ESM consumers load the same compiled runtime", async () => {
  const esm = await import("../dist/index.js");
  assert.equal(esm.ReadinessReportResponseSchema, c.ReadinessReportResponseSchema);
  const evidence = internal.InternalEvidenceObservationSchema.parse(createSyntheticEvidenceFixture());
  const report = c.ReadinessReportResponseSchema.parse(createSyntheticReportFixture());
  assert.equal(report.evidence[0].evidenceId, evidence.evidenceId);
  assert.equal(report.roles.length, 5);
  assert.equal(report.roles.every((role) => role.state === "unknown"), true);
});

for (const [label, mutate] of [
  ["unsupported contract", (v) => { v.contractVersion = "2.0.0"; }],
  ["invalid identifier", (v) => { v.evidenceId = "ev_123"; }],
  ["short commit SHA", (v) => { v.commitSha = "a".repeat(7); }],
  ["unsupported provider SHA length", (v) => { v.commitSha = "a".repeat(64); }],
  ["confidence greater than one", (v) => { v.confidence = 1.01; }],
  ["negative strength", (v) => { v.strength = -0.1; }],
  ["NaN score", (v) => { v.relevance = NaN; }],
  ["infinite score", (v) => { v.confidence = Infinity; }],
  ["inverted lines", (v) => { v.locator.lines = { start: 4, end: 3 }; }],
  ["line zero", (v) => { v.locator.lines.start = 0; }],
  ["partial line range", (v) => { delete v.locator.lines.end; }],
  ["absolute locator", (v) => { v.locator.path = "/tmp/private.ts"; }],
  ["parent traversal", (v) => { v.locator.path = "src/../private.ts"; }],
  ["metadata with file locator", (v) => { v.sourceType = "pull_request"; }],
  ["invalid timestamp", (v) => { v.createdAt = "yesterday"; }],
  ["missing detector version", (v) => { delete v.detector.version; }],
  ["excessive text", (v) => { v.observations = ["a".repeat(2001)]; }],
  ["blank text", (v) => { v.observations = ["   "]; }],
  ["excessive observations", (v) => { v.observations = Array(21).fill("synthetic"); }],
  ["unknown contribution scored zero", (v) => { v.contribution.confidence = 0; }],
  ["access token", (v) => { v.accessToken = "synthetic-sentinel"; }],
  ["raw archive", (v) => { v.archiveUrl = "https://example.invalid/archive"; }],
  ["source blob", (v) => { v.rawSource = "synthetic-sentinel"; }],
  ["nested credential", (v) => { v.detector.workerCredential = "synthetic-sentinel"; }],
]) {
  test(`internal evidence rejects ${label}`, () => {
    const value = createSyntheticEvidenceFixture();
    mutate(value);
    assert.equal(internal.InternalEvidenceObservationSchema.safeParse(value).success, false);
  });
}

test("public repository origin, owner visibility, source type and independent scores coexist", () => {
  const value = createSyntheticEvidenceFixture();
  value.repositoryVisibility = "public";
  value.confidence = 1;
  value.strength = 0;
  assert.equal(internal.InternalEvidenceObservationSchema.parse(value).visibility, "owner_only");
});

test("verified claims require evidence and unverified statements require a label", () => {
  const claim = createSyntheticReportFixture().claims[0];
  assert.equal(c.ClaimSchema.safeParse({ ...claim, evidenceIds: [] }).success, false);
  assert.equal(c.ClaimSchema.safeParse({ ...claim, evidenceIds: [uuid(1), uuid(1)] }).success, false);
  const unverified = { verification: "unverified", claimId: uuid(12), text: "Candidate-reported statement.", label: "Unverified", basis: "candidate_reported" };
  assert.equal(c.ClaimSchema.safeParse(unverified).success, true);
  assert.equal(c.ClaimSchema.safeParse({ ...unverified, label: undefined }).success, false);
  assert.equal(c.ClaimSchema.safeParse({ ...unverified, evidenceIds: [uuid(1)] }).success, false);
});

test("unknown, not-observed and assessed are distinct states", () => {
  const unknown = { state: "unknown", capabilityId: "testing", reasons: ["unsupported_language"], explanation: "Analyzer cannot assess this language." };
  assert.equal(c.CapabilityAssessmentSchema.safeParse(unknown).success, true);
  assert.equal(c.CapabilityAssessmentSchema.safeParse({ ...unknown, strength: 0, confidence: 0 }).success, false);
  const assessed = createSyntheticReportFixture().capabilityGroups[0].capabilities[0];
  assert.equal(c.CapabilityAssessmentSchema.safeParse({ ...assessed, strength: 0 }).success, false);
  assert.equal(c.CapabilityAssessmentSchema.safeParse({ ...assessed, evidenceIds: [] }).success, false);
  assert.equal(c.CapabilityAssessmentSchema.safeParse({ state: "not_observed", capabilityId: "testing", confidence: 0.8,
    coverageSnapshotIds: [uuid(2)], explanation: "Not observed in the analyzed scope." }).success, true);
});

test("coverage ratios require a denominator and partial-processing limitations", () => {
  const coverage = createSyntheticReportFixture().coverage[0].languages[0];
  for (const overrides of [{ coverage: 1 }, { eligibleFiles: 0 }, { analyzedFiles: 3 }, { limitations: [] }]) {
    assert.equal(c.LanguageCoverageSchema.safeParse({ ...coverage, ...overrides }).success, false);
  }
  assert.equal(c.LanguageCoverageSchema.safeParse({ state: "unknown", language: "rust", reasons: ["unsupported_language"], limitations: [], coverage: 0 }).success, false);
});

test("inventory counts and role weights cannot contradict their totals", () => {
  const inventory = { contractVersion: "1.0.0", snapshotId: uuid(2), extractorBundle: { id: "synthetic", version: "1.0.0" },
    totalFiles: 2, eligibleFiles: 1, excludedFiles: 1, analyzedFiles: 1, languages: [{ language: "typescript", files: 1 }],
    frameworks: [], testFiles: 1, configFiles: 0, documentationFiles: 0, ciFiles: 0,
    metadata: { commits: false, pullRequests: false, ci: false }, limitations: [] };
  assert.equal(c.InventorySummarySchema.safeParse(inventory).success, true);
  assert.equal(c.InventorySummarySchema.safeParse({ ...inventory, excludedFiles: 2 }).success, false);
  const rubric = { contractVersion: "1.0.0", roleId: "backend", version: "1.0.0", taxonomyVersion: "1.0.0", name: "Synthetic",
    requirements: [{ capabilityId: "testing", weight: 1, minimumEvidence: 0.5, required: true }] };
  assert.equal(c.RoleRubricSchema.safeParse(rubric).success, true);
  assert.equal(c.RoleRubricSchema.safeParse({ ...rubric, requirements: [{ ...rubric.requirements[0], weight: 0.5 }] }).success, false);
});

for (const [label, mutate] of [
  ["unknown report fields", (v) => { v.rawSource = "synthetic-sentinel"; }],
  ["foreign evidence", (v) => { v.claims[0].evidenceIds = [uuid(99)]; }],
  ["foreign snapshot", (v) => { v.evidence[0].snapshotId = uuid(99); }],
  ["cross-repository evidence", (v) => { v.evidence[0].repositoryId = uuid(99); }],
  ["commit drift", (v) => { v.evidence[0].commitSha = "b".repeat(40); }],
  ["duplicate evidence", (v) => { v.evidence.push(v.evidence[0]); }],
  ["missing coverage", (v) => { v.coverage = []; }],
  ["duplicate roles", (v) => { v.roles[1] = v.roles[0]; }],
  ["missing role", (v) => { v.roles.pop(); }],
  ["role version mismatch", (v) => { v.roles[0].template.version = "2.0.0"; }],
  ["coverage version mismatch", (v) => { v.coverage[0].manifestVersion = "2.0.0"; }],
  ["missing version dependency", (v) => { delete v.versions.aggregationPolicy; }],
  ["unversioned model", (v) => { v.versions.synthesis = { kind: "model", prompt: { id: "synthetic", version: "1.0.0" }, model: { provider: "synthetic", identifier: "synthetic" } }; }],
  ["unsupported contract dependency", (v) => { v.versions.contract = "2.0.0"; }],
  ["foreign improvement gap", (v) => { v.improvements[0].gapIds = [uuid(99)]; }],
  ["missing improvement proof", (v) => { v.improvements[0].expectedProof = []; }],
  ["private fingerprint in owner evidence", (v) => { v.evidence[0].fingerprint = createSyntheticEvidenceFixture().fingerprint; }],
]) {
  test(`report rejects ${label}`, () => {
    const report = createSyntheticReportFixture();
    mutate(report);
    assert.equal(c.ReadinessReportResponseSchema.safeParse(report).success, false);
  });
}

test("owner and generalized responses reject internal locators and identifiers", () => {
  assert.equal(c.OwnerEvidenceSchema.safeParse(createSyntheticEvidenceFixture()).success, false);
  const generalized = { contractVersion: "1.0.0", projection: "generalized", sourceType: "test", capabilityIds: ["testing"],
    summary: "Limited evidence of test assertions.", confidence: 0.8, strength: 0.4 };
  assert.equal(c.GeneralizedEvidenceSchema.safeParse(generalized).success, true);
  for (const field of ["path", "symbol", "repositoryId", "snapshotId", "commitSha", "lines", "locator", "evidenceId", "accessToken", "contentHash"]) {
    assert.equal(c.GeneralizedEvidenceSchema.safeParse({ ...generalized, [field]: "synthetic" }).success, false);
  }
});

test("start request allows only bounded, user-selectable inputs", () => {
  assert.deepEqual(c.StartAnalysisRequestSchema.parse(start()).includeMetadata, { commits: false, pullRequests: false, ci: false });
  for (const field of ["userId", "price", "status", "evidence", "confidence", "accessToken", "commitSha", "requestHash"]) {
    assert.equal(c.StartAnalysisRequestSchema.safeParse({ ...start(), [field]: "synthetic" }).success, false);
  }
  for (const overrides of [{ repositoryIds: [] }, { repositoryIds: [uuid(3), uuid(3)] },
    { repositoryIds: Array.from({ length: 11 }, (_, i) => uuid(i)) }, { idempotencyKey: "tiny" },
    { includeMetadata: { commits: true, token: "synthetic" } }, { contractVersion: "2.0.0" }]) {
    assert.equal(c.StartAnalysisRequestSchema.safeParse({ ...start(), ...overrides }).success, false);
  }
});

test("progress and terminal jobs are coherent and never contain raw failure messages", () => {
  const progress = { kind: "measured", stage: "inventory", completedUnits: 1, totalUnits: 2, fraction: 0.5 };
  assert.equal(c.AnalysisProgressSchema.safeParse(progress).success, true);
  assert.equal(c.AnalysisProgressSchema.safeParse({ ...progress, fraction: 1 }).success, false);
  const job = { contractVersion: "1.0.0", jobId: uuid(7), createdAt: "2026-09-13T12:00:00.000Z", updatedAt: "2026-09-13T12:01:00.000Z",
    status: "failed", stage: "validation", attempt: null, finishedAt: "2026-09-13T12:01:00.000Z", failureCode: "ANALYSIS_VALIDATION_FAILED", retryable: false };
  assert.equal(c.AnalysisJobResponseSchema.safeParse(job).success, true);
  assert.equal(c.AnalysisJobResponseSchema.safeParse({ ...job, message: "synthetic private path" }).success, false);
  assert.equal(c.AnalysisJobResponseSchema.safeParse({ ...job, updatedAt: "2026-09-12T12:00:00.000Z" }).success, false);
  assert.equal(c.AnalysisJobResponseSchema.safeParse({ ...job, status: "completed" }).success, false);
});

test("capabilities and machine-readable errors expose only safe contract fields", () => {
  assert.equal(c.ClientCapabilitiesSchema.safeParse(c.DISABLED_CLIENT_CAPABILITIES).success, true);
  assert.equal(c.ClientCapabilitiesSchema.safeParse({ ...c.DISABLED_CLIENT_CAPABILITIES, privateKey: "synthetic" }).success, false);
  assert.equal(c.ClientCapabilitiesSchema.safeParse({ ...c.DISABLED_CLIENT_CAPABILITIES, readinessAvailability: "available" }).success, false);
  const error = { success: false, error: "Unavailable", code: "FEATURE_DISABLED", retryable: false, requestId: "synthetic-request" };
  assert.equal(c.ApiErrorEnvelopeSchema.safeParse(error).success, true);
  assert.equal(c.ApiErrorEnvelopeSchema.safeParse({ ...error, debug: "synthetic" }).success, false);
});
