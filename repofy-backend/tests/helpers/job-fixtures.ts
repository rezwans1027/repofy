import { randomUUID, randomInt } from "node:crypto";
import { EvidenceRepository, type FeatureOneRpcClient } from "../../src/domain/analysis/persistence";
import { ExecutionPolicySchema } from "../../src/domain/jobs/policy";
import { JobRepository } from "../../src/domain/jobs/repository";
import { securityPolicy, policyHash } from "../../src/domain/ingestion/policy";
import { fixtureCrypto, grantFacts, snapshotBundle } from "./evidence-fixtures";
import { GitHubVault } from "../../src/domain/github-app/crypto";
import { testKey } from "./github-app-fixtures";

export const analysisPolicy = () => {
  const versions = snapshotBundle(randomUUID()).versions; const security = securityPolicy();
  versions.ingestionPolicyHash = policyHash(security);
  return ExecutionPolicySchema.parse({ workflow: "durable-analysis-1.0.0", failurePolicy: "fail_all_v1", versions, security, billing: "internal_free_v1" });
};
export async function seedAnalysisFixture(db: { query(sql: string, args?: any[]): Promise<any> }, rpc: FeatureOneRpcClient, count = 1) {
  const actor = randomUUID(); const provider = String(randomInt(100000000, 900000000));
  await db.query('INSERT INTO auth.users(id) VALUES($1)', [actor]);
  await db.query('INSERT INTO public.repository_selections(user_id) VALUES($1)', [actor]);
  const evidence = new EvidenceRepository(rpc); const bindings = []; const bundles = []; const policy = analysisPolicy();
  for (let n = 0; n < count; n++) {
    const providerRepo = `${provider}${n}`;
    const facts = { ...grantFacts(provider, providerRepo), providerInstallationId: provider, providerOwnerId: provider,
      ownerType: 'User', visibility: 'public', verifiedAt: new Date().toISOString(), attestedAt: new Date().toISOString() };
    const binding = await evidence.bindVerifiedGrant(actor, facts, randomUUID()); bindings.push(binding);
    const display = new GitHubVault(testKey).seal({}, `selection:${actor}:${binding.repositoryId}`);
    await db.query('INSERT INTO feature_one_private.repository_selection_items(user_id,repository_id,grant_id,display_encrypted) VALUES($1,$2,$3,$4)', [actor, binding.repositoryId, binding.grantId, display]);
    const bundle = snapshotBundle(binding.repositoryId, providerRepo);
    bundle.versions = structuredClone(policy.versions); bundle.snapshot.securityPolicyHash = policyHash(policy.security);
    bundle.snapshot.repositoryVisibility = 'public'; bundle.evidence.forEach(item => { item.repositoryVisibility = 'public'; });
    bundles.push(bundle);
  }
  const jobs = new JobRepository(rpc);
  const body = { contractVersion: '1.0.0' as const, repositoryIds: bindings.map(b => b.repositoryId), idempotencyKey: randomUUID() };
  return { actor, bindings, bundles, policy, jobs, body, evidence, crypto: fixtureCrypto() };
}

export async function seedJobRubrics(db: { query(sql: string, args?: any[]): Promise<any> }) {
  await db.query("INSERT INTO capability_definitions VALUES ('synthetic','1.0.0','testing','quality','{\"synthetic\":true}')");
  for (const role of ['backend','frontend','full_stack','mobile','ai_application']) {
    await db.query("INSERT INTO role_templates(role_id,version,taxonomy_id,taxonomy_version,name) VALUES($1,'0.0.1','synthetic','1.0.0','Synthetic fixture')",[role]);
    await db.query("INSERT INTO role_requirements(role_id,role_version,taxonomy_id,taxonomy_version,capability_id,weight,minimum_evidence,required) VALUES($1,'0.0.1','synthetic','1.0.0','testing',1,0.5,true)",[role]);
  }
}
