import { ExecutionPolicySchema } from "../jobs/policy";
import { structuralSecurityPolicy, policyHash } from "../ingestion/policy";
import { coverageProfile } from "../coverage/manifest";
import { initialRubricCatalog } from "../rubrics/catalog";
import { ROLE_AGGREGATION_POLICY } from "../aggregation/policy";
import type { AggregationResult } from "@repofy/contracts";
import { synthesisVersion } from "./policy";

/** Fixed release composition. New pointers affect new jobs; existing job versions are immutable. */
export function narrativeExecutionPolicy(provenance = false, version: AggregationResult["policy"]["version"] = provenance ? "3.1.0" : "3.0.0") {
  const security = structuralSecurityPolicy(), profile = coverageProfile([], [], version.startsWith("3."));
  return ExecutionPolicySchema.parse({ workflow: "durable-analysis-1.0.0", failurePolicy: "fail_all_v1", billing: "internal_free_v1", security,
    versions: { contract: "1.0.0", snapshotIdentity: "1.0.0", ingestionPolicyHash: policyHash(security), extractorBundle: profile.extractorBundle,
      detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest,
      aggregationPolicy: { id: ROLE_AGGREGATION_POLICY.id, version },
      taxonomy: { id: initialRubricCatalog.taxonomy.id, version: initialRubricCatalog.taxonomy.version },
      roleRubrics: initialRubricCatalog.rubrics.map(r => ({ roleId: r.roleId, version: r.version })),
      disclosurePolicy: { id: "candidate_private", version: "1.0.0" }, synthesis: synthesisVersion() } });
}
