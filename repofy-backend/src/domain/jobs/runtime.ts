import { env } from "../../config/env";
import { getSupabaseAdmin } from "../../config/supabase";
import { locatorCryptoFromEnvironment } from "../evidence/locator-crypto";
import { githubConnectionService } from "../github-app/runtime";
import { IngestionRepository } from "../ingestion/repository";
import { SnapshotIngestionService } from "../ingestion/service";
import { GitHubSnapshotSource } from "../ingestion/source";
import { WorkspaceManager } from "../ingestion/workspace";
import { JobRepository } from "./repository";
import type { ExecutionPolicy } from "./policy";
import { logger } from "../../lib/logger";
import { AnalysisWorker, handlersComplete, type AnalysisHandlers } from "./worker";

// Lazy construction keeps flags-off/read/maintenance processes independent of model credentials.
// No environment switch can install a synthetic adapter or change the provider host.
export function productionHandlers(pinned?: ExecutionPolicy): AnalysisHandlers | null {
  if (process.env.FEATURE_ONE_SYNTHESIS_ENABLED !== "true") return null;
  const { synthesisConfiguration } = require("../synthesis/policy") as typeof import("../synthesis/policy");
  const config = synthesisConfiguration(process.env); if (!config) return null;
  const { narrativeExecutionPolicy } = require("../synthesis/composition") as typeof import("../synthesis/composition");
  const { OpenAIResponsesGateway } = require("../synthesis/gateway") as typeof import("../synthesis/gateway");
  const { NarrativeService } = require("../synthesis/service") as typeof import("../synthesis/service");
  const narrative = new NarrativeService(jobRepository(),new OpenAIResponsesGateway(config.apiKey));
  // Rollout changes intake only. Supported queued versions retain their frozen policy.
  const provenance = pinned ? pinned.versions.aggregationPolicy.version === "1.1.0" : env.featureOne?.provenanceEnabled === true;
  return { policy: narrativeExecutionPolicy(provenance), extract: (...args) => productionExtraction().extract(...args),
    aggregate: c => productionAggregation().aggregate(c), synthesize: c => narrative.synthesize(c), validate: (r,c) => narrative.validate(r,c) };
}
/** Run 10 extraction, lazily installed by the Run 12 composition. */
export function productionExtraction() {
  // Fixed application modules, loaded only by the extraction composition. Flags-off
  // API/maintenance processes need neither parser heaps nor provider credentials.
  const { AuthorizedMetadataSource } = require("../github-app/metadata-client") as typeof import("../github-app/metadata-client");
  const { createCoverageExtraction } = require("../extraction/pipeline") as typeof import("../extraction/pipeline");
  return createCoverageExtraction(locatorCryptoFromEnvironment(process.env), new AuthorizedMetadataSource(githubConnectionService()), [],
    metrics => logger.info("Evidence extraction completed", metrics));
}
/** Run 11 deterministic stage used by the complete, gated composition. */
export function productionAggregation() {
  const { createAggregation } = require("../aggregation/repository") as typeof import("../aggregation/repository");
  const { ProvenanceService } = require("../provenance/service") as typeof import("../provenance/service");
  const jobs = jobRepository();
  return createAggregation(jobs, new ProvenanceService(jobs, { verifyRepository: (...args) => githubConnectionService().verifyRepository(...args) }));
}
export function analysisAvailable(actor: string) {
  return !!env.featureOne?.flags.featureOneEnabled && !!env.featureOne?.flags.githubAppRepositoriesEnabled
    && handlersComplete(productionHandlers()) && (process.env.FEATURE_ONE_ANALYSIS_ALLOWLIST ?? "").split(",").map(s => s.trim()).includes(actor);
}
export function jobRepository() { return new JobRepository(getSupabaseAdmin()); }
export function workspaceManager() { return new WorkspaceManager(process.env.FEATURE_ONE_WORKSPACE_ROOT); }
export function analysisWorker() {
  const jobs = jobRepository();
  const crypto = () => locatorCryptoFromEnvironment(process.env);
  return new AnalysisWorker(jobs, claim => productionHandlers(claim.policy), claim => new SnapshotIngestionService(
    new IngestionRepository(jobs.ingestionClient(claim), crypto()), new GitHubSnapshotSource(githubConnectionService()), crypto(), workspaceManager(), claim.policy.security), crypto);
}
