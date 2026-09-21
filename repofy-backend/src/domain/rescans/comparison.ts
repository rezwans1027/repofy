import { z } from "zod";
import { ComparisonSchema, OwnerEvidenceSchema, EVIDENCE_CHANGES, type Comparison, type ComparisonEvidence, type ComparisonQuery, type ReportView } from "@repofy/contracts";
import { canonical } from "../aggregation/input";
import { JobError } from "../jobs/policy";

export const ComparisonFactSchema = z.strictObject({ observation: OwnerEvidenceSchema, contentKey: z.string().max(120).nullable(), pathKey: z.string().max(120).nullable() });
export type ComparisonFact = z.infer<typeof ComparisonFactSchema>;
export interface ComparisonInput { baseline: ReportView; target: ReportView; baselineFacts: ComparisonFact[]; targetFacts: ComparisonFact[];
  baselineInventory: Array<{ snapshotId: string; exclusions: unknown }>; targetInventory: Array<{ snapshotId: string; exclusions: unknown }> }
const delta = (a: number | null | undefined, b: number | null | undefined) => a == null || b == null ? null : Math.round((b - a) * 1e6) / 1e6;
function concept(f: ComparisonFact) {
  const e = f.observation;
  return canonical([e.repositoryId, e.detector.id, e.sourceType, e.implementation?.kind ?? e.structural?.kind ?? "legacy",
    e.implementation?.claimBoundary ?? e.structural?.claimBoundary, e.implementation?.testBoundary]);
}
function meaning(f: ComparisonFact) {
  const e = f.observation, s = e.structural, i = e.implementation;
  // Exclude prose, source positions, snapshot-scoped symbol IDs and provider fetch time.
  return canonical({ strength: e.strength, confidence: e.confidence, detector: e.detector, capabilities: [...e.capabilityIds].sort(),
    structural: s && { counts: s.counts, technologies: [...s.technologies].sort(), boundary: s.claimBoundary,
      provider: s.provider && { result: s.provider.result, relationship: s.provider.relationship, authorMatch: s.provider.authorMatch, authorType: s.provider.authorType } },
    implementation: i && { boundary: i.testBoundary, relations: i.relations.map(r => [r.relationship, r.independence]).sort() } });
}
function grouped(facts: ComparisonFact[], key: (f: ComparisonFact) => string | null) {
  const groups = new Map<string, ComparisonFact[]>();
  for (const fact of facts) { const k = key(fact); if (k !== null) { if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(fact); } }
  return groups;
}
function scope(coverage: ReportView["report"]["coverage"][number] | undefined) {
  return coverage && { truncated: coverage.structural?.evidenceTruncated || coverage.implementation?.evidenceTruncated,
    sources: coverage.structural?.sources.map(s => [s.source, s.parseFailures, s.limitedFiles, s.unsupportedFiles]),
    disabled: coverage.structural?.disabledExtractors, detectors: coverage.implementation?.disabledDetectors,
    parsers: coverage.assessment?.declaration.disabledParsers };
}
export function compareReports(input: ComparisonInput, query: ComparisonQuery): Comparison {
  const { baseline: a, target: b } = input;
  if (a.report.ownerUserId !== b.report.ownerUserId || b.report.reportId !== query.targetReportId) throw new JobError("NOT_FOUND");
  for (const [view, facts] of [[a, input.baselineFacts], [b, input.targetFacts]] as const) {
    if (facts.length > 20000 || new Set(facts.map(f => f.observation.evidenceId)).size !== facts.length || facts.some(f => !view.report.snapshots.some(s =>
      s.snapshotId === f.observation.snapshotId && s.repositoryId === f.observation.repositoryId && s.commitSha === f.observation.commitSha))) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  }
  const causes = new Set<Comparison["causes"][number]>(), notes = ["Differences describe stored repository observations, not candidate skill, authorship or a developer regression. Narrative wording is excluded from evidence counts."];
  const av = a.report.versions, bv = b.report.versions;
  for (const [key, before, after] of [
    ["security_policy_changed", av.ingestionPolicyHash, bv.ingestionPolicyHash], ["extractor_changed", av.extractorBundle, bv.extractorBundle],
    ["detector_changed", av.detectorBundle, bv.detectorBundle], ["coverage_policy_changed", av.coverageManifest, bv.coverageManifest],
    ["rubric_changed", [av.taxonomy, av.roleRubrics], [bv.taxonomy, bv.roleRubrics]], ["aggregation_changed", av.aggregationPolicy, bv.aggregationPolicy],
    ["narrative_policy_changed", [av.synthesis, av.disclosurePolicy], [bv.synthesis, bv.disclosurePolicy]],
  ] as const) if (canonical(before) !== canonical(after)) causes.add(key);
  const repositoryIds = [...new Set([...a.report.snapshots, ...b.report.snapshots].map(s => s.repositoryId))].sort();
  if (query.repositoryId && !repositoryIds.includes(query.repositoryId as never)) throw new JobError("NOT_FOUND");
  const repositories = repositoryIds.map((repositoryId, index) => {
    const left = a.report.snapshots.find(s => s.repositoryId === repositoryId), right = b.report.snapshots.find(s => s.repositoryId === repositoryId);
    if (!left) causes.add("repository_added"); else if (!right) causes.add("repository_removed"); else {
      if (left.commitSha !== right.commitSha) causes.add("commit_changed");
      const ac = a.report.coverage.find(c => c.snapshotId === left.snapshotId), bc = b.report.coverage.find(c => c.snapshotId === right.snapshotId);
      if (canonical(scope(ac)) !== canonical(scope(bc)) || canonical(input.baselineInventory.find(i => i.snapshotId === left.snapshotId)?.exclusions) !== canonical(input.targetInventory.find(i => i.snapshotId === right.snapshotId)?.exclusions)) causes.add("scope_changed");
      if (canonical(ac?.structural?.metadata.map(m => [m.source, m.state])) !== canonical(bc?.structural?.metadata.map(m => [m.source, m.state]))) {
        causes.add("scope_changed");
        if (canonical(ac?.structural?.metadata.filter(m => m.state === "permission_denied").map(m => m.source)) !== canonical(bc?.structural?.metadata.filter(m => m.state === "permission_denied").map(m => m.source))) causes.add("metadata_permission_changed");
      }
    }
    function projected(view: ReportView, s: typeof left) {
      if (!s) return null;
      const access = view.repositories.find(r => r.snapshotId === s.snapshotId)!;
      if (access.access !== "active") causes.add("permission_unavailable");
      return { snapshotId: s.snapshotId, commitSha: s.commitSha, capturedAt: s.createdAt, access: access.access, visibility: access.visibility };
    }
    return { repositoryId, label: `Repository ${index + 1}`, baseline: projected(a, left), target: projected(b, right) };
  });
  if ([...input.baselineFacts, ...input.targetFacts].some(f => !f.pathKey && !f.observation.structural?.provider)) causes.add("locator_unavailable");
  const limited = [...causes].some(c => !["commit_changed", "narrative_policy_changed", "locator_unavailable"].includes(c));
  if (limited) notes.push("Scope, access or measurement versions differ. Gained/lost observations and numeric deltas cannot by themselves establish improvement or regression; each side retains its own coverage and rubric.");
  if (causes.has("commit_changed")) notes.push("The pinned commit changed. A commit alone does not establish that a supported behavior improved.");
  if (causes.has("scope_changed")) notes.push("Exclusions, parser limits, metadata availability or assessability changed. A missing observation may be outside the new scan scope; excluded source is not reconstructed.");
  if (causes.has("rubric_changed") || causes.has("detector_changed") || causes.has("coverage_policy_changed") || causes.has("extractor_changed")) notes.push("Recorded analyzer or rubric versions differ. Values are displayed as recorded; old source and old analyzers are not rerun.");
  if (causes.has("permission_unavailable") || causes.has("metadata_permission_changed")) notes.push("Current repository access or captured metadata availability differs. Saved observations remain owner-only; no prior source permission is inferred.");
  if (causes.has("narrative_policy_changed")) notes.push("Narrative/model policy differs. Wording changes do not count as evidence gained.");
  const remainingA = new Map(input.baselineFacts.map(f => [f.observation.evidenceId, f])), remainingB = new Map(input.targetFacts.map(f => [f.observation.evidenceId, f]));
  const rows: ComparisonEvidence[] = [];
  const add = (left: ComparisonFact | undefined, right: ComparisonFact | undefined, change: ComparisonEvidence["change"], basis: ComparisonEvidence["basis"]) => {
    const e = (right ?? left)!.observation;
    rows.push({ repositoryId: e.repositoryId, change, baselineEvidenceId: left?.observation.evidenceId ?? null, targetEvidenceId: right?.observation.evidenceId ?? null,
      detector: e.detector.id, sourceType: e.sourceType, capabilityIds: [...new Set([...(left?.observation.capabilityIds ?? []), ...(right?.observation.capabilityIds ?? [])])].sort(), basis,
      interpretation: change === "uncertain" ? "uncertain_identity" : limited ? "limited_by_scope_or_versions" : "comparable_observation" });
    if (left) remainingA.delete(left.observation.evidenceId); if (right) remainingB.delete(right.observation.evidenceId);
  };
  const pair = (left: ComparisonFact, right: ComparisonFact, basis: ComparisonEvidence["basis"]) => add(left, right,
    meaning(left) !== meaning(right) || (left.contentKey && right.contentKey && left.contentKey !== right.contentKey) ? "changed"
      : left.pathKey && right.pathKey && left.pathKey !== right.pathKey ? "relocated" : "unchanged", basis);
  for (const [id, fact] of remainingA) { const right = remainingB.get(id); if (right) pair(fact, right, "identity"); }
  for (const field of ["contentKey", "pathKey"] as const) {
    const key = (f: ComparisonFact) => f[field] ? `${concept(f)}:${f[field]}` : null;
    const left = grouped([...remainingA.values()], key), right = grouped([...remainingB.values()], key);
    for (const [key, items] of left) { const candidates = right.get(key); if (items.length === 1 && candidates?.length === 1) pair(items[0], candidates[0], field === "contentKey" ? "content_and_concept" : "path_and_concept"); }
  }
  const leftGroups = grouped([...remainingA.values()], concept), rightGroups = grouped([...remainingB.values()], concept);
  for (const [key, items] of leftGroups) for (const item of items) add(item, undefined, rightGroups.has(key) ? "uncertain" : "lost", rightGroups.has(key) ? "ambiguous" : "unmatched");
  for (const [key, items] of rightGroups) for (const item of items) add(undefined, item, leftGroups.has(key) ? "uncertain" : "gained", leftGroups.has(key) ? "ambiguous" : "unmatched");
  if (rows.some(r => r.change === "uncertain")) notes.push("Some observations have several plausible matches. They remain uncertain rather than being counted as lost and gained; line offsets never establish identity.");
  const capIds = [...new Set([...a.report.capabilityGroups, ...b.report.capabilityGroups].flatMap(g => g.capabilities.map(c => c.capabilityId)))].sort();
  function measure(view: ReportView, id: string) {
    const cap = view.report.capabilityGroups.flatMap(g => g.capabilities).find(c => c.capabilityId === id), trace = view.aggregation?.capabilities.find(c => c.capabilityId === id);
    return cap ? { state: cap.state, strength: cap.state === "assessed" ? cap.strength : cap.state === "not_observed" ? 0 : null,
      confidence: cap.state === "unknown" ? null : cap.confidence, assessableFraction: trace ? Math.min(...trace.trace.coverage.map(c => c.fraction)) : null } : null;
  }
  const capabilities = capIds.map(id => { const left = measure(a, id), right = measure(b, id); return { capabilityId: id,
    label: b.capabilities.find(c => c.capabilityId === id)?.label ?? a.capabilities.find(c => c.capabilityId === id)?.label ?? id,
    baseline: left, target: right, strengthDelta: delta(left?.strength, right?.strength), confidenceDelta: delta(left?.confidence, right?.confidence),
    assessabilityChanged: (left?.state === "unknown") !== (right?.state === "unknown") || left?.assessableFraction !== right?.assessableFraction }; });
  const roles = b.report.roles.map(right => { const left = a.report.roles.find(r => r.template.roleId === right.template.roleId);
    const baseline = left?.state === "assessed" ? left.coverage : null, target = right.state === "assessed" ? right.coverage : null;
    return { roleId: right.template.roleId, baseline, target, coverageDelta: delta(baseline, target), confidenceDelta: delta(left?.state === "assessed" ? left.confidence : null, right.state === "assessed" ? right.confidence : null),
      baselineUnknownWeight: a.aggregation?.roles.find(r => r.template.roleId === right.template.roleId)?.unknownWeight ?? null,
      targetUnknownWeight: b.aggregation?.roles.find(r => r.template.roleId === right.template.roleId)?.unknownWeight ?? null }; });
  const counts = Object.fromEntries(EVIDENCE_CHANGES.map(key => [key, rows.filter(r => r.change === key).length]));
  // Support-derived capability mappings matter too (for example a linked test).
  const support = new Map<string, Set<string>>();
  for (const view of [a, b]) for (const cap of view.aggregation?.capabilities ?? []) for (const fact of cap.support) {
    if (!support.has(fact.evidenceId)) support.set(fact.evidenceId, new Set()); support.get(fact.evidenceId)!.add(cap.capabilityId);
  }
  for (const row of rows) row.capabilityIds = [...new Set([...row.capabilityIds, ...support.get(row.baselineEvidenceId ?? "") ?? [], ...support.get(row.targetEvidenceId ?? "") ?? []])].sort();
  const filtered = rows.filter(r => (!query.repositoryId || r.repositoryId === query.repositoryId) && (!query.change || r.change === query.change) && (!query.capabilityId || r.capabilityIds.includes(query.capabilityId)))
    .sort((x, y) => x.repositoryId.localeCompare(y.repositoryId) || (x.baselineEvidenceId ?? x.targetEvidenceId!).localeCompare(y.baselineEvidenceId ?? y.targetEvidenceId!));
  return ComparisonSchema.parse({ algorithm: "evidence-diff-1.0.0", baseline: { reportId: a.report.reportId, createdAt: a.report.createdAt, versions: av },
    target: { reportId: b.report.reportId, createdAt: b.report.createdAt, versions: bv }, comparability: limited ? "limited" : "comparable", causes: [...causes].sort(), notes,
    repositories, counts, capabilities, roles, evidence: filtered.slice(query.offset, query.offset + query.limit), filteredCount: filtered.length,
    nextOffset: query.offset + query.limit < filtered.length ? query.offset + query.limit : null });
}
