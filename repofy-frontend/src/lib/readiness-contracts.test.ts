import { expect, it } from "vitest";
import { InternalEvidenceObservationSchema } from "@repofy/contracts/internal";
import { createSyntheticEvidenceFixture, createSyntheticReportFixture } from "@repofy/contracts/testing";
import { parseReadinessReport } from "./readiness-contracts";

it("the frontend validates the identical shared fixture used by the backend", () => {
  const observation = InternalEvidenceObservationSchema.parse(createSyntheticEvidenceFixture());
  const report = parseReadinessReport(createSyntheticReportFixture());
  expect(report.evidence[0].evidenceId).toBe(observation.evidenceId);
  expect(report.roles.every((role) => role.state === "unknown")).toBe(true);
  expect(() => parseReadinessReport({ ...createSyntheticReportFixture(), accessToken: "synthetic" })).toThrow();
});
