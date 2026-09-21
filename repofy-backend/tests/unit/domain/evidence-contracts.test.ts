import { expect, it } from "vitest";
import { createSyntheticEvidenceFixture, createSyntheticReportFixture } from "@repofy/contracts/testing";
import { parseEvidenceObservation, parseReadinessReport } from "../../../src/domain/evidence/contracts";
import { canonicalAnalysisRequest } from "../../../src/domain/analysis/request";

it("the backend consumes the shared internal fixture and owner report", () => {
  const evidence = parseEvidenceObservation(createSyntheticEvidenceFixture());
  const report = parseReadinessReport(createSyntheticReportFixture());
  expect(report.evidence[0].evidenceId).toBe(evidence.evidenceId);
  expect(report.roles.every((role) => role.state === "unknown")).toBe(true);
  expect(() => parseEvidenceObservation({ ...createSyntheticEvidenceFixture(), rawSource: "synthetic" })).toThrow();
});

const request = {
  contractVersion: "1.0.0", repositoryIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
  idempotencyKey: "synthetic-key-1",
};

it("canonical hashes ignore set/key ordering and normalize omitted metadata", () => {
  const first = canonicalAnalysisRequest(request);
  const reordered = canonicalAnalysisRequest({ idempotencyKey: "synthetic-key-2", repositoryIds: [...request.repositoryIds].reverse(),
    includeMetadata: { ci: false, commits: false, pullRequests: false }, contractVersion: "1.0.0" });
  expect(first.requestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(first.requestHash).toBe(reordered.requestHash);
});

it("material request changes produce different hashes and server-owned fields are rejected", () => {
  const baseline = canonicalAnalysisRequest(request).requestHash;
  expect(canonicalAnalysisRequest({ ...request, includeMetadata: { commits: true } }).requestHash).not.toBe(baseline);
  expect(canonicalAnalysisRequest({ ...request, targetRoleTemplate: { roleId: "backend", version: "1.0.0" } }).requestHash).not.toBe(baseline);
  expect(canonicalAnalysisRequest({ ...request, repositoryIds: [request.repositoryIds[0]] }).requestHash).not.toBe(baseline);
  expect(() => canonicalAnalysisRequest({ ...request, userId: "forged" })).toThrow();
});
