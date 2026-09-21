import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { ReadinessReportResponse } from "@repofy/contracts";
import type { StageContext } from "../jobs/worker";
import { JobRepository } from "../jobs/repository";
import { JobError } from "../jobs/policy";
import { canonical } from "../aggregation/input";
import { prepareNarrative, renderNarrative, validateRendered } from "./narrative";
import { NARRATIVE_POLICY as P, SynthesisError, ModelOutcomeSchema } from "./policy";
import type { ModelGateway } from "./gateway";

export class NarrativeService {
  constructor(private readonly jobs: JobRepository, private readonly gateway: ModelGateway) {}
  private async prepare(c: StageContext) {
    await c.checkpoint();
    const p = prepareNarrative(await this.jobs.call("narrative_input", { ...this.jobs.args(c.claim), p_run: c.runId }), c.claim.request.targetRoleTemplate?.roleId);
    const a = p.facts.aggregation;
    if (a.runId !== c.runId || a.jobId !== c.claim.jobId || a.ownerUserId !== c.claim.actor || canonical(a.versions) !== canonical(c.claim.policy.versions) ||
      canonical(a.snapshotIds) !== canonical([...c.snapshotIds].sort())) throw new JobError("ANALYSIS_VALIDATION_FAILED");
    return p;
  }
  async synthesize(c: StageContext) {
    const p = await this.prepare(c);
    for (let attempt = 0; attempt < P.maxCallsPerJob; attempt++) {
      await c.checkpoint();
      const id = z.uuid().parse(await this.jobs.call("model_reserve", { ...this.jobs.args(c.claim), p_run: c.runId, p_hash: p.inputHash, p_refs: p.allowedEvidenceIds }));
      let output: Awaited<ReturnType<ModelGateway["generate"]>> | undefined;
      try {
        output = await this.gateway.generate(p.input,c.signal);
        const report = renderNarrative(p,output.selection,id); validateRendered(report,p);
        await c.checkpoint();
        await this.jobs.call("model_finish", { ...this.jobs.args(c.claim), p_model: id, p_outcome: ModelOutcomeSchema.parse(output.usage), p_report: report });
        return report;
      } catch (error) {
        // Do not translate lease/database failures to model validation outcomes or retry paid calls.
        if (!(error instanceof SynthesisError)) throw error;
        const outcome = { ...(output?.usage ?? error.usage), code: error.validationCode };
        await this.jobs.call("model_finish", { ...this.jobs.args(c.claim), p_model: id, p_outcome: ModelOutcomeSchema.parse(outcome) });
        if (error.validationCode === "provider_rate_limit" && attempt + 1 < P.maxCallsPerJob) {
          await delay(250,undefined,{ signal: c.signal }); continue;
        }
        throw error;
      }
    }
    throw new SynthesisError("budget_exhausted");
  }
  async validate(report: ReadinessReportResponse,c: StageContext) {
    validateRendered(report,await this.prepare(c));
    await this.jobs.call("narrative_validate", { ...this.jobs.args(c.claim), p_report: report });
  }
}
