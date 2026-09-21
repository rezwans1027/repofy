import { z } from "zod";
import { OwnerEvidenceSchema, AggregationResultSchema, type OwnerEvidence, type AggregatedCapability, type AggregationResult,
  type AggregationSupport, type AggregationValidationCode, type ClusterCalculation } from "@repofy/contracts";
import { DETECTORS } from "../detectors/registry";
import { coverageProfile, coverageDeclaration } from "../coverage/manifest";
import { initialRubricCatalog } from "../rubrics/catalog";
import { strengthBand } from "../rubrics/policy";
import { JobError } from "../jobs/policy";
import { AGGREGATION_POLICY as P, round, calculateStrength } from "./policy";
import { AggregationInputSchema, AggregationEvidenceInputSchema, canonical, digest, clusterKey, type AggregationInput } from "./input";
import { matchRole } from "./roles";

type Snapshot = AggregationInput["snapshots"][number];
type Fact = { observation: OwnerEvidence; fileId: string | null; contentFingerprint: string | null; snapshot: Snapshot; capabilityIds: string[]; basis: "presence" | "implementation" };
const fail = () => { throw new JobError("ANALYSIS_VALIDATION_FAILED"); };
const sorted = <T extends string>(items: T[]) => [...new Set(items)].sort();
function presenceCapabilities(e: OwnerEvidence): string[] {
  const s = e.structural;
  if (!s || (!s.provider && !s.technologies.length && !Object.values(s.counts).some(n => n && n > 0))) return [];
  const kinds: Record<string, string[]> = { structure: ["language_presence"], dependency: s.technologies.length ? ["framework_presence"] : [],
    configuration: s.technologies.length ? ["framework_presence"] : [], schema: ["data_modeling"], workflow: ["delivery_automation"],
    container: ["delivery_reproducibility"], documentation: ["documentation_operability", ...((s.counts.architectureHeadings ?? 0) > 0 ? ["documentation_decisions"] : [])],
    commit: ["provenance_history"], pull_request: ["provenance_history"] };
  return kinds[s.kind] ?? [];
}
function coverageFor(s: Snapshot, id: string): AggregatedCapability["trace"]["coverage"][number] {
  const achieved = s.coverage.assessment, c = achieved?.capabilities.find(c => c.capabilityId === id);
  const excludedFiles = achieved?.counts.excludedFiles ?? 0;
  const denominator = (c?.eligibleFiles ?? 0) + excludedFiles;
  const fraction = !c || c.state === "not_assessable" ? 0 : denominator ? c.analyzedFiles / denominator : c.metadataAssessed ? 1 : 0;
  return { snapshotId: s.snapshotId, repositoryId: s.repositoryId, state: c?.state ?? "not_assessable",
    analyzedFiles: c?.analyzedFiles ?? 0, eligibleFiles: c?.eligibleFiles ?? 0, excludedFiles, metadataAssessed: c?.metadataAssessed ?? false,
    fraction: round(fraction), confidenceCeiling: c?.confidenceCeiling ?? 0, reasons: sorted(c?.reasons ?? ["legacy_coverage_unknown"]) };
}
function supported(f: Fact, clusterId: string, basis: AggregationSupport["basis"] = f.basis): AggregationSupport {
  const e = f.observation;
  return { evidenceId: e.evidenceId, snapshotId: e.snapshotId, repositoryId: e.repositoryId, clusterId, sourceType: e.sourceType,
    basis, detector: e.detector, boundary: (e.implementation ?? e.structural)!.claimBoundary };
}
function groups(facts: Fact[]): Fact[][] {
  // Union related concepts, same AST shapes, normalized source locations and keyed content.
  // Keys never leave this module. Source and summaries collapse conservatively; count adds no score.
  const parent = facts.map((_, i) => i), keys = new Map<string, number>();
  const root = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  facts.forEach((f, i) => {
    const e = f.observation, d = e.implementation;
    const prefix = `${e.repositoryId}:${f.basis}:${d ? "tsjs" : e.structural!.kind}:`;
    const related = d ? [`concept:${d.conceptId}`, `pattern:${d.patternId}`, `location:${f.fileId}:${canonical(d.span)}`]
      : [`location:${f.fileId ?? e.evidenceId}`];
    if (f.contentFingerprint) related.push(`content:${f.contentFingerprint}`);
    for (const key of related) { const k = prefix + key, prev = keys.get(k); if (prev === undefined) keys.set(k, i); else parent[root(i)] = root(prev); }
  });
  const result = new Map<number, Fact[]>(); facts.forEach((f, i) => { const k = root(i); if (!result.has(k)) result.set(k, []); result.get(k)!.push(f); });
  return [...result.values()];
}
function linkedTest(test: Fact, members: Fact[]): boolean {
  const t = test.observation.implementation;
  return t?.kind === "asserted_call" && t.testBoundary === "local_implementation" && members.some(m => {
    const d = m.observation.implementation;
    return !!d && d.kind !== "asserted_call" && m.observation.snapshotId === test.observation.snapshotId && m.fileId !== test.fileId &&
      t.relations.some(r => r.independence === "separate_test" && r.relationship === "asserted_call" && r.fileId === m.fileId
        && r.conceptId === d.conceptId && r.symbolId === d.symbolId && r.lines.start <= d.span.lines.start && r.lines.end >= d.span.lines.end);
  });
}

export function aggregateEvidence(raw: unknown): AggregationResult {
  if (Buffer.byteLength(canonical(raw)) > P.maxBytes) fail();
  const parsed = AggregationInputSchema.safeParse(raw); if (!parsed.success) fail();
  const input = parsed.data!;
  const provenanceEnabled = input.versions.aggregationPolicy.id === P.id && input.versions.aggregationPolicy.version === "1.1.0";
  if ((!provenanceEnabled && canonical(input.versions.aggregationPolicy) !== canonical({ id: P.id, version: P.version })) || canonical(input.catalog) !== canonical(initialRubricCatalog)
    || input.versions.taxonomy.id !== input.catalog.taxonomy.id || input.versions.taxonomy.version !== input.catalog.taxonomy.version
    || input.catalog.rubrics.some(r => !input.versions.roleRubrics.some(v => v.roleId === r.roleId && v.version === r.version))) fail();
  input.snapshots.sort((a, b) => a.snapshotId.localeCompare(b.snapshotId));
  const snapshots = new Map(input.snapshots.map(s => [s.snapshotId, s]));
  if (provenanceEnabled ? !input.provenance || input.provenance.snapshots.length !== snapshots.size || input.provenance.snapshots.some(p => {
    const s = snapshots.get(p.snapshotId); return !s || s.repositoryId !== p.repositoryId || s.commitSha !== p.commitSha;
  }) : !!input.provenance) fail();
  if (snapshots.size !== input.snapshots.length || new Set(input.snapshots.map(s => s.repositoryId)).size !== input.snapshots.length) fail();
  for (const s of input.snapshots) {
    s.files.sort((a, b) => a.fileId.localeCompare(b.fileId));
    if (s.coverage.snapshotId !== s.snapshotId || s.coverage.manifestVersion !== input.versions.coverageManifest ||
      canonical(s.coverage.detectorBundle) !== canonical(input.versions.detectorBundle) || new Set(s.files.map(f => f.fileId)).size !== s.files.length) fail();
    if (s.coverage.assessment) {
      const expected = coverageProfile(s.coverage.assessment.declaration.disabledParsers, s.coverage.implementation?.disabledDetectors ?? []);
      if (canonical(expected.detectorBundle) !== canonical(input.versions.detectorBundle) || canonical(expected.extractorBundle) !== canonical(input.versions.extractorBundle)
        || expected.coverageManifest !== input.versions.coverageManifest || canonical(s.coverage.assessment.declaration) !== canonical(coverageDeclaration(expected.coverage.disabledParsers))) fail();
    }
  }
  const filesBySnapshot = new Map(input.snapshots.map(s => [s.snapshotId, new Map(s.files.map(f => [f.fileId as string, f]))]));
  const counts = new Map<AggregationValidationCode, number>();
  const exclude = (code: AggregationValidationCode) => counts.set(code, (counts.get(code) ?? 0) + 1);
  const rows: { item: z.infer<typeof AggregationEvidenceInputSchema>; e: OwnerEvidence }[] = [];
  for (const rawItem of input.evidence) {
    const item = AggregationEvidenceInputSchema.safeParse(rawItem);
    const e = item.success && OwnerEvidenceSchema.safeParse(item.data.observation);
    if (!item.success || !e || !e.success || e.data.location) { exclude("invalid_shape"); continue; }
    rows.push({ item: item.data, e: e.data });
  }
  const identity = new Map<string, Set<string>>();
  for (const r of rows) { const k = r.e.evidenceId; if (!identity.has(k)) identity.set(k, new Set()); identity.get(k)!.add(canonical(r.item)); }
  const seen = new Set<string>(), facts: Fact[] = [];
  for (const { item, e } of rows.sort((a, b) => a.e.evidenceId.localeCompare(b.e.evidenceId) || canonical(a.item).localeCompare(canonical(b.item)))) {
    if (seen.has(e.evidenceId)) continue; seen.add(e.evidenceId);
    if (identity.get(e.evidenceId)!.size > 1) { exclude("duplicate_id_conflict"); continue; }
    const s = snapshots.get(e.snapshotId);
    if (!s || e.repositoryId !== s.repositoryId || e.commitSha !== s.commitSha || e.repositoryVisibility !== s.repositoryVisibility) { exclude("foreign_evidence"); continue; }
    const file = item.fileId ? filesBySnapshot.get(s.snapshotId)!.get(item.fileId) : undefined;
    if (item.fileId !== null && !file?.analyzed || e.implementation && !file) { exclude("foreign_evidence"); continue; }
    const d = e.implementation, structural = e.structural;
    if (d) {
      const definition = DETECTORS.find(x => x.kind === d.kind)!;
      if (s.coverage.implementation?.disabledDetectors.includes(d.kind)) { exclude("quarantined_detector"); continue; }
      const mocked = d.testBoundary === "mocked_or_intercepted";
      if (!s.coverage.implementation || file?.outcome?.implementation !== "analyzed" || e.detector.version !== definition.version
        || canonical(e.capabilityIds) !== canonical(definition.capabilityIds) || e.strength > (mocked ? .35 : definition.strength)
        || e.confidence > (mocked ? .4 : definition.confidence) || d.span.lines.end > file!.lines) { exclude("version_mismatch"); continue; }
      if ((d.kind === "asserted_call" && !d.relations.length) || d.relations.some(r => {
        const target = filesBySnapshot.get(s.snapshotId)!.get(r.fileId);
        return !target?.analyzed || target.classification !== "code" || r.lines.end > target.lines ||
          (d.kind === "asserted_call" ? r.relationship !== "asserted_call" || r.independence !== (mocked ? "mocked_test" : "separate_test") || r.fileId === item.fileId
            : r.relationship !== "local_call" || r.independence !== "same_source");
      })) { exclude("invalid_relation"); continue; }
    } else if (structural) {
      const providerFamily: Record<string, string> = { commit: "commits", pull_request: "pull_requests", check: "checks", status: "statuses", action: "actions" };
      const family = structural.provider ? `provider.${providerFamily[structural.kind]}` : file?.outcome?.source;
      if (!family || e.detector.id !== `structural.${family}.${structural.kind}` || e.detector.version !== "1.0.0" || e.capabilityIds.length
        || e.strength > (e.sourceType === "dependency" || structural.confidenceBasis === "filename_only" ? .2 : .3)
        || e.confidence > (structural.confidenceBasis === "filename_only" ? .2 : .5)) { exclude("unsupported_mapping"); continue; }
      if (structural.provider && item.fileId !== null || structural.provider?.relationship === "exact_commit" && structural.provider.subjectSha !== s.commitSha) { exclude("foreign_evidence"); continue; }
      if (structural.associatedFileIds?.some(id => !filesBySnapshot.get(s.snapshotId)!.has(id))) { exclude("invalid_relation"); continue; }
    } else { exclude("unsupported_mapping"); continue; }
    const ids = d ? e.capabilityIds : presenceCapabilities(e);
    const covered = ids.filter(id => s.coverage.assessment?.capabilities.some(c => c.capabilityId === id && c.state !== "not_assessable"));
    if (covered.length !== ids.length) exclude("unassessable_source");
    if (e.strength > 0) facts.push({ ...item, observation: e, snapshot: s, capabilityIds: covered, basis: d && d.testBoundary !== "mocked_or_intercepted" ? "implementation" : "presence" });
  }
  const factsById = new Map(facts.map(f => [f.observation.evidenceId, f]));
  const testIndex = new Map<string, Fact[]>();
  const linkKey = (snapshot: string, file: string, concept: string, symbol: string) => `${snapshot}:${file}:${concept}:${symbol}`;
  for (const fact of facts) {
    const d = fact.observation.implementation;
    if (d?.kind !== "asserted_call" || d.testBoundary !== "local_implementation") continue;
    for (const relation of d.relations) {
      const key = linkKey(fact.observation.snapshotId, relation.fileId, relation.conceptId, relation.symbolId);
      if (!testIndex.has(key)) testIndex.set(key, []); testIndex.get(key)!.push(fact);
    }
  }
  for (const candidates of testIndex.values()) candidates.sort((a, b) => b.observation.confidence - a.observation.confidence || a.observation.evidenceId.localeCompare(b.observation.evidenceId));
  const conflictingMetadata = input.snapshots.some(s => {
    const results = facts.filter(f => f.observation.snapshotId === s.snapshotId && f.observation.structural?.provider?.relationship === "exact_commit").map(f => f.observation.structural!.provider!.result);
    return results.includes("success") && results.some(r => ["failure", "timed_out", "startup_failure"].includes(r));
  });
  const capabilities: AggregatedCapability[] = [...input.catalog.taxonomy.capabilities].sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)).map(definition => {
    const coverage = input.snapshots.map(s => coverageFor(s, definition.capabilityId));
    const support: AggregationSupport[] = [], calculations: ClusterCalculation[] = [];
    const candidates = facts.filter(f => f.capabilityIds.includes(definition.capabilityId));
    for (const members of groups(candidates)) {
      const linked = new Map<string, Fact | undefined>();
      const strongest = Math.max(...members.map(m => m.observation.strength));
      for (const member of members.filter(m => m.observation.strength === strongest && m.basis === "implementation")) {
        const d = member.observation.implementation!;
        const candidates = testIndex.get(linkKey(member.observation.snapshotId, member.fileId!, d.conceptId, d.symbolId)) ?? [];
        linked.set(member.observation.evidenceId, candidates.find(t => linkedTest(t, [member])));
      }
      // A test must link to the chosen base itself, not merely another same-shape member.
      members.sort((a, b) => b.observation.strength - a.observation.strength || Number(!!linked.get(b.observation.evidenceId)) - Number(!!linked.get(a.observation.evidenceId))
        || b.observation.confidence - a.observation.confidence || a.observation.evidenceId.localeCompare(b.observation.evidenceId));
      const base = members[0], e = base.observation;
      const id = clusterKey([e.repositoryId, definition.capabilityId, sorted(members.map(m => m.observation.implementation?.conceptId ?? m.contentFingerprint ?? m.observation.evidenceId))]);
      // Only a semantically linked, non-mocked, different-file test is enabled in v1.
      const test = linked.get(e.evidenceId);
      members.forEach(m => support.push(supported(m, id)));
      const corroboration: ClusterCalculation["corroboration"] = test ? [{ sourceType: "test", evidenceId: test.observation.evidenceId, rank: 1, bonus: .1 }] : [];
      if (test) support.push(supported(test, clusterKey(["test", test.observation.repositoryId, test.observation.implementation!.conceptId]), "corroboration"));
      calculations.push({ clusterId: id, repositoryId: e.repositoryId, baseEvidenceId: e.evidenceId, evidenceIds: sorted(members.map(m => m.observation.evidenceId)),
        baseStrength: e.strength, presenceCeiling: base.basis === "presence" ? P.presenceCeiling : 1, corroboration,
        strength: calculateStrength(e.strength, base.basis === "presence", corroboration.length) });
    }
    calculations.sort((a, b) => b.strength - a.strength || a.clusterId.localeCompare(b.clusterId));
    const winner = calculations[0], base = winner && factsById.get(winner.baseEvidenceId)!;
    const state = winner ? "assessed" : coverage.some(c => c.state !== "not_assessable") && !counts.size ? "not_observed" : "unknown";
    const fraction = Math.min(...coverage.map(c => c.fraction));
    const baseScope = base && coverage.find(c => c.snapshotId === base.observation.snapshotId)!;
    const ceiling = baseScope ? baseScope.confidenceCeiling : Math.max(...coverage.map(c => c.confidenceCeiling));
    const reliability = base ? Math.min(base.observation.confidence, ...(winner.corroboration.map(c => factsById.get(c.evidenceId)!.observation.confidence))) : ceiling;
    const bonus = winner?.corroboration.length ? P.confidenceSupportBonus : 0;
    const confidence = state === "unknown" ? null : round(Math.min(ceiling, reliability * round(.5 + .5 * fraction) + bonus));
    // Numeric values are conservative indices, not empirically calibrated probabilities.
    const label = confidence === null ? null : coverage.every(c => c.state === "assessable" && c.fraction === 1) && confidence >= .5 ? "moderate" : "low";
    const scopes: AggregatedCapability["allowedClaimScopes"] = [];
    if (base?.basis === "implementation" && base.observation.implementation?.kind !== "asserted_call") scopes.push("repository_behavior");
    if (base?.observation.structural?.claimBoundary === "configuration_presence") scopes.push("configuration_observation");
    if (base && ["language_presence", "framework_presence"].includes(definition.capabilityId)) scopes.push("technology_presence");
    if (base?.observation.structural?.provider && definition.capabilityId === "provenance_history") scopes.push("contribution_indicator");
    return { capabilityId: definition.capabilityId, categoryId: definition.groupId, state,
      strength: winner?.strength ?? (state === "unknown" ? null : 0),
      strengthBand: strengthBand(input.catalog.taxonomy.strengthPolicy, state === "unknown" ? { state: "unknown" } : { state: "assessed", strength: winner?.strength ?? 0 }).key as AggregatedCapability["strengthBand"],
      confidence, confidenceLabel: label, provenance: { state: "unknown", value: null, policy: provenanceEnabled ? "context_only_v1" : "not_inferred_v1" },
      evidenceIds: sorted(support.map(s => s.evidenceId)), support: [...new Map(support.map(s => [`${s.evidenceId}:${s.clusterId}:${s.basis}`, s])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId) || a.clusterId.localeCompare(b.clusterId)),
      allowedClaimScopes: scopes.filter(scope => definition.allowedClaimScopes.some(s => s.scope === scope)),
      uncertainty: sorted(["uncalibrated", "static_only", "provenance_unknown", "cross_repository_independence_unknown", "unlinked_context_not_corroboration",
        ...(coverage.some(c => c.state !== "assessable" || c.fraction !== 1) ? ["partial_coverage" as const] : []),
        ...(counts.size ? ["invalid_evidence_excluded" as const] : []), ...(conflictingMetadata ? ["conflicting_metadata" as const] : []),
        ...(candidates.some(c => c.observation.contribution.state === "assessed") ? ["provenance_not_applied" as const] : [])]),
      trace: { coverage, clusters: calculations, selectedClusterId: winner?.clusterId ?? null, combination: P.crossRepository,
        confidence: confidence === null ? null : { reliability, coverageFraction: fraction, coverageFactor: round(.5 + .5 * fraction), independentSupportBonus: bonus, ceiling, provenanceMultiplier: null } },
    };
  });
  const result = AggregationResultSchema.parse({ contractVersion: "1.0.0", policy: { id: P.id, version: provenanceEnabled ? "1.1.0" : P.version },
    ...(provenanceEnabled ? { provenance: input.provenance } : {}),
    runId: input.runId, jobId: input.jobId, ownerUserId: input.ownerUserId, visibility: "owner_only", versions: input.versions,
    snapshotIds: input.snapshots.map(s => s.snapshotId), inputHash: digest({ ...input, evidence: input.evidence.map(value => ({ value, key: canonical(value) })).sort((a, b) => a.key.localeCompare(b.key)).map(item => item.value) }),
    capabilities, roles: [...input.catalog.rubrics].sort((a, b) => a.roleId.localeCompare(b.roleId)).map(r => matchRole(r, capabilities)),
    validation: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => ({ code, count })),
    limitations: sorted(capabilities.flatMap(c => c.uncertainty)),
  });
  if (Buffer.byteLength(canonical(result)) > P.maxBytes) fail();
  return result;
}
