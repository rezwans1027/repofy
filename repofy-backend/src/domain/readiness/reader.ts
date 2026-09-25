import { z } from "zod";
import { ReportViewSchema, ReportHistorySchema, ReportHistoryQuerySchema, ReportEvidenceQuerySchema, ReportEvidencePageSchema,
  ReportEventSchema, EvidenceLocationResponseSchema, ReadinessReportResponseSchema, roleAvailability, type ReportView } from "@repofy/contracts";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import type { GitHubConnectionService } from "../github-app/service";
import { GitHubAppError } from "../github-app/errors";

export class ReportReadError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_REQUEST" | "DATABASE_FAILURE" | "REPOSITORY_ACCESS_REVOKED") { super(code); }
}
const locatorSchema = z.strictObject({ evidenceId: z.uuid(), snapshotId: z.uuid(), repositoryId: z.uuid(), commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  visibility: z.enum(["public", "private"]), grantId: z.uuid(), accessRevision: z.uuid(), accountId: z.uuid(), installationId: z.uuid(),
  providerRepositoryId: z.string(), locatorId: z.uuid(), locatorEncrypted: z.string(),
});
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value); if (!parsed.success) throw new ReportReadError("INVALID_REQUEST"); return parsed.data;
}

export function projectReportView(raw: ReportView): ReportView {
  const report = ReadinessReportResponseSchema.parse(raw.report);
  const repositories = z.array(ReportViewSchema.shape.repositories.element).parse(raw.repositories);
  const access = new Map(repositories.map(s => [s.snapshotId, s]));
  report.snapshots = report.snapshots.map((s, i) => ({ ...s, repositoryLabel: `Repository ${i + 1}`,
    repositoryVisibility: access.get(s.snapshotId)?.visibility ?? "private" }));
  report.evidence = report.evidence.map(({ location: _location, ...e }) => ({ ...e,
    repositoryVisibility: access.get(e.snapshotId)?.visibility ?? "private" }));
  report.improvements = report.improvements.map(i => ({ ...i, permittedLocations: [] }));
  return ReportViewSchema.parse({ ...raw, report, repositories, roleAvailability: roleAvailability(report) });
}

/** No provider or model calls in ordinary reads. Every RPC checks report ownership. */
export class ReadinessReader {
  constructor(private readonly db: FeatureOneRpcClient, private readonly crypto: () => LocatorCrypto,
    private readonly github: Pick<GitHubConnectionService, "verifyRepository">) {}
  private async call(name: string, actor: string, args: Record<string, unknown>) {
    input(z.uuid(), actor);
    let result;
    try { result = await this.db.rpc(`feature_one_report_${name}`, { p_actor: actor, ...args }); }
    catch { throw new ReportReadError("DATABASE_FAILURE"); }
    if (result.error) {
      const code = result.error.message;
      throw new ReportReadError(code === "NOT_FOUND" ? code : code === "ACCESS_REVOKED" || code === "NOT_AUTHORIZED" ? "REPOSITORY_ACCESS_REVOKED"
        : code === "INVALID_REQUEST" ? code : "DATABASE_FAILURE");
    }
    return result.data;
  }
  async history(actor: string, query: unknown) {
    return ReportHistorySchema.parse(await this.call("history", actor, { p_query: input(ReportHistoryQuerySchema, query) }));
  }
  async view(actor: string, reportId: string): Promise<ReportView> {
    const raw = await this.call("view", actor, { p_report: input(z.uuid(), reportId) }) as ReportView;
    // Stored content is never rewritten. Current stricter privacy controls this projection.
    return projectReportView(raw);
  }
  async evidence(actor: string, reportId: string, query: unknown) {
    return ReportEvidencePageSchema.parse(await this.call("evidence", actor, {
      p_report: input(z.uuid(), reportId), p_query: input(ReportEvidenceQuerySchema, query),
    }));
  }
  async improvement(actor: string, reportId: string, improvementId: string) {
    input(z.uuid(), improvementId);
    const view = await this.view(actor, reportId);
    const item = view.report.improvements.find(i => i.improvementId === improvementId);
    if (!item) throw new ReportReadError("NOT_FOUND"); return item;
  }
  async remove(actor: string, reportId: string, requestId: string) {
    return z.strictObject({ deleted: z.literal(true) }).parse(await this.call("delete", actor, {
      p_report: input(z.uuid(), reportId), p_request_id: input(z.uuid(), requestId),
    }));
  }
  async event(actor: string, reportId: string, event: unknown, requestId: string) {
    await this.call("event", actor, { p_report: input(z.uuid(), reportId), p_event: input(ReportEventSchema, event), p_request_id: requestId });
    return { recorded: true as const };
  }
  async location(actor: string, reportId: string, evidenceId: string) {
    const args = { p_report: input(z.uuid(), reportId), p_evidence: input(z.uuid(), evidenceId) };
    const unavailable = (state: "access_revoked" | "unavailable" | "not_retained") => EvidenceLocationResponseSchema.parse({ state, evidenceId });
    try {
      const before = locatorSchema.parse(await this.call("locator", actor, args));
      const verified = await this.github.verifyRepository(actor, before.accountId, before.installationId, before.repositoryId);
      if (verified.item.id !== before.providerRepositoryId) return unavailable("access_revoked");
      const after = locatorSchema.parse(await this.call("locator", actor, args));
      if (before.grantId !== after.grantId || before.accessRevision !== after.accessRevision) return unavailable("access_revoked");
      const locator = this.crypto().decryptLocator(after.locatorEncrypted, after);
      if (locator.kind !== "file") return unavailable("not_retained");
      const visibility = before.visibility === "private" || after.visibility === "private" || verified.item.private ? "private" : "public";
      const repositoryLabel = `${verified.item.owner.login}/${verified.item.name}`;
      const lines = locator.lines;
      const url = `https://github.com/${encodeURIComponent(verified.item.owner.login)}/${encodeURIComponent(verified.item.name)}/blob/${after.commitSha}/${locator.path.split("/").map(encodeURIComponent).join("/")}${lines ? `#L${lines.start}-L${lines.end}` : ""}`;
      return EvidenceLocationResponseSchema.parse({ state: "available", evidenceId, commitSha: after.commitSha,
        label: locator.path, repositoryLabel, visibility, ...(lines ? { lines } : {}), ...(visibility === "public" ? { url } : {}) });
    } catch (error) {
      if (error instanceof ReportReadError && error.code === "NOT_FOUND") throw error;
      if (error instanceof ReportReadError && error.code === "REPOSITORY_ACCESS_REVOKED" || error instanceof GitHubAppError &&
        ["access_changed", "not_found", "reconnect_required", "installation_missing", "installation_suspended", "insufficient_permissions"].includes(error.code)) return unavailable("access_revoked");
      // Never log decryption failures, provider bodies, source or retained locator data.
      return unavailable("unavailable");
    }
  }
}
