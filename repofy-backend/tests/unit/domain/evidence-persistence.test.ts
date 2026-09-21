import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createSyntheticReportFixture } from "@repofy/contracts/testing";
import { EvidenceRepository, SnapshotBundleSchema } from "../../../src/domain/analysis/persistence";
import { fixtureCrypto, snapshotBundle, grantFacts } from "../../helpers/evidence-fixtures";

const actor = randomUUID(); const requestId = randomUUID(); const grantId = randomUUID();
function setup(data: unknown = null, error: { message: string; code: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error }); return { repository: new EvidenceRepository({ rpc }), rpc };
}
describe("evidence persistence boundary", () => {
  it("encrypts all locators/branch before database transport and ignores caller fingerprints", async () => {
    const bundle = snapshotBundle(randomUUID()); const { repository, rpc } = setup(bundle.snapshot.snapshotId);
    await repository.storeSnapshot(actor, grantId, bundle, fixtureCrypto());
    const input = rpc.mock.calls[0][1];
    expect(input.p_actor).toBe(actor); expect(input.p_grant).toBe(grantId);
    const json = JSON.stringify(input);
    expect(json).not.toContain(bundle.snapshot.branch);
    expect(json).not.toContain("tests/synthetic.test.ts");
    expect(json).not.toContain(bundle.evidence[0].fingerprint.digest);
    expect(input.p_bundle.evidence[0].observation).not.toHaveProperty("locatorId");
    expect(input.p_bundle.snapshot).not.toHaveProperty("branch");
  });
  it.each(["commit", "inventory", "coverage", "location", "eligibility", "extra_source"])("rejects inconsistent %s before storage", async kind => {
    const bundle = snapshotBundle(randomUUID());
    if (kind === "commit") bundle.evidence[0].commitSha = "c".repeat(40);
    if (kind === "inventory") bundle.inventorySummary.totalFiles = 3;
    if (kind === "coverage") bundle.coverage.snapshotId = randomUUID() as typeof bundle.coverage.snapshotId;
    if (kind === "location" && bundle.evidence[0].locator.kind === "file") bundle.evidence[0].locator.path = "missing.ts";
    if (kind === "eligibility") bundle.files[0].eligible = false;
    if (kind === "extra_source") Object.assign(bundle, { rawSource: "synthetic source sentinel" });
    const { repository, rpc } = setup();
    await expect(repository.storeSnapshot(actor, grantId, bundle, fixtureCrypto())).rejects.toThrow("INVALID_REQUEST");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects duplicate files/evidence and inventory counts with no analyzed observation", () => {
    const bundle = snapshotBundle(randomUUID());
    bundle.files[1].locatorId = bundle.files[0].locatorId;
    expect(SnapshotBundleSchema.safeParse(bundle).success).toBe(false);
    const other = snapshotBundle(randomUUID()); other.files[0].analyzed = false;
    expect(SnapshotBundleSchema.safeParse(other).success).toBe(false);
  });
  it("sends only parsed verified-provider facts with an authenticated actor", async () => {
    const binding = { githubAccountId: randomUUID(), installationId: randomUUID(), repositoryId: randomUUID(), grantId };
    const { repository, rpc } = setup(binding); const facts = grantFacts();
    expect(await repository.bindVerifiedGrant(actor, facts, requestId)).toEqual(binding);
    expect(rpc).toHaveBeenCalledWith("feature_one_bind_grant", { p_actor: actor, p_facts: facts, p_request_id: requestId });
    await expect(repository.bindVerifiedGrant(actor, { ...facts, token: "synthetic token" }, requestId)).rejects.toThrow("INVALID_REQUEST");
  });
  it("canonicalizes request hashes and never lets browser JSON choose the actor or hash", async () => {
    const { repository, rpc } = setup(randomUUID()); const ids = [randomUUID(), randomUUID()];
    const request = { contractVersion: "1.0.0", repositoryIds: ids, idempotencyKey: randomUUID() };
    await repository.createJob(actor, request, [grantId, randomUUID()], requestId);
    await repository.createJob(actor, { ...request, repositoryIds: [...ids].reverse(), idempotencyKey: randomUUID() }, [grantId, randomUUID()], requestId);
    expect(rpc.mock.calls[0][1].p_request_hash).toEqual(rpc.mock.calls[1][1].p_request_hash);
    expect(rpc.mock.calls[0][1].p_actor).toEqual(actor);
    await expect(repository.createJob(actor, { ...request, ownerUserId: randomUUID() }, [grantId], requestId)).rejects.toThrow("INVALID_REQUEST");
  });
  it("pins run versions and snapshots, and validates transaction results", async () => {
    const result = { runId: randomUUID(), attemptId: randomUUID() }; const { repository, rpc } = setup(result);
    const bundle = snapshotBundle(randomUUID()); const job = randomUUID();
    expect(await repository.createRun(actor, job, bundle.versions, [bundle.snapshot.snapshotId], requestId)).toEqual(result);
    expect(rpc.mock.calls[0][1]).toEqual({ p_actor: actor, p_job: job, p_versions: bundle.versions, p_snapshot_ids: [bundle.snapshot.snapshotId], p_request_id: requestId });
    rpc.mockResolvedValueOnce({ data: { runId: "bad" }, error: null });
    await expect(repository.createRun(actor, job, bundle.versions, [bundle.snapshot.snapshotId], requestId)).rejects.toThrow("INVALID_REQUEST");
  });
  it("parses report input and stored output and requires actor equality", async () => {
    const report = createSyntheticReportFixture(); const { repository, rpc } = setup(report.reportId);
    expect(await repository.finalizeReport(report.ownerUserId, report, requestId)).toBe(report.reportId);
    await expect(repository.finalizeReport(actor, report, requestId)).rejects.toThrow("NOT_FOUND");
    rpc.mockResolvedValueOnce({ data: report, error: null });
    expect(await repository.readReport(report.ownerUserId, report.reportId)).toEqual(report);
    rpc.mockResolvedValueOnce({ data: { ...report, source: "synthetic source" }, error: null });
    await expect(repository.readReport(report.ownerUserId, report.reportId)).rejects.toThrow("INVALID_REQUEST");
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await repository.readReport(actor, report.reportId)).toBeNull();
  });
  it("validates list metadata and sends scoped cancel/delete/revoke commands", async () => {
    const report = createSyntheticReportFixture();
    const list = [{ reportId: report.reportId, runId: report.analysisRunId, jobId: report.jobId, createdAt: report.createdAt }];
    const { repository, rpc } = setup(list);
    expect(await repository.listReports(actor)).toEqual(list);
    await repository.cancelJob(actor, report.jobId, requestId);
    await repository.deleteAnalysis(actor, report.jobId, requestId);
    await repository.revokeGrant(actor, grantId, requestId);
    expect(rpc.mock.calls.slice(1).map(([name, input]) => [name, input.p_actor])).toEqual([
      ["feature_one_cancel_job", actor], ["feature_one_delete_analysis", actor], ["feature_one_revoke_grant", actor],
    ]);
    await expect(repository.listReports("unverified-subject")).rejects.toThrow("INVALID_REQUEST");
  });
  it.each([
    ["NOT_FOUND", "P0001", "NOT_FOUND"], ["ACCESS_REVOKED", "P0001", "ACCESS_REVOKED"],
    ["synthetic private row content", "23503", "INVALID_MEMBERSHIP"], ["synthetic private row content", "XX000", "DATABASE_FAILURE"],
  ])("sanitizes database errors (%s)", async (message, code, expected) => {
    const { repository } = setup(null, { message, code });
    await expect(repository.readReport(actor, randomUUID())).rejects.toThrow(`Evidence operation failed: ${expected}`);
  });
  it("sanitizes rejected network promises", async () => {
    const { repository, rpc } = setup(); rpc.mockRejectedValue(new Error("synthetic secret-bearing URL"));
    await expect(repository.listReports(actor)).rejects.toThrow("DATABASE_FAILURE");
  });
});
