import { z } from "zod";
import { FindingReferenceSchema, FindingFeedbackRequestSchema, FindingFeedbackSchema, ReviewQueueQuerySchema, ReviewQueueSchema, ReviewRequestSchema, ReviewItemSchema } from "@repofy/contracts";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import { JobError, JOB_CODES, type JobCode } from "../jobs/policy";
import { bounded } from "../ingestion/errors";
import { staticSecretScanner } from "../ingestion/scanner";
import { digest } from "../aggregation/input";
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const r = schema.safeParse(value); if (!r.success) throw new JobError("INVALID_REQUEST"); return r.data; }
export class FindingFeedbackService {
  constructor(private readonly db: FeatureOneRpcClient) {}
  private async call(name: string, args: Record<string, unknown>) {
    let result; try { result = await bounded(this.db.rpc(`feature_one_${name}`, args), 10000, "DATABASE_FAILURE"); } catch { throw new JobError("DATABASE_FAILURE"); }
    if (result.error) throw new JobError(JOB_CODES.includes(result.error.message as JobCode) ? result.error.message as JobCode : "DATABASE_FAILURE");
    return result.data;
  }
  async feedback(actor: string, report: string, ref: unknown, change?: unknown) {
    const finding = parse(FindingReferenceSchema, ref), body = change === undefined ? undefined : parse(FindingFeedbackRequestSchema, change);
    if (body && staticSecretScanner.isSensitive(body.comment)) throw new JobError("INVALID_REQUEST");
    return FindingFeedbackSchema.nullable().parse(await this.call("finding_feedback", { p_actor: parse(z.uuid(), actor), p_report: parse(z.uuid(), report), p_kind: finding.kind, p_finding: finding.id,
      ...(body ? { p_change: body, p_hash: digest({ report, finding, body }) } : {}) }));
  }
  async queue(reviewer: string, query: unknown) { return ReviewQueueSchema.parse(await this.call("finding_review", { p_reviewer: parse(z.uuid(), reviewer), p_query: parse(ReviewQueueQuerySchema, query) })); }
  async review(reviewer: string, feedback: string, change: unknown) {
    const body = parse(ReviewRequestSchema, change);
    return ReviewItemSchema.parse(await this.call("finding_review", { p_reviewer: parse(z.uuid(), reviewer), p_feedback: parse(z.uuid(), feedback), p_change: body, p_hash: digest({ feedback, body }) }));
  }
}
