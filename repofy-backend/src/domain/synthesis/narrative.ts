import { createHash } from "node:crypto";
import { z } from "zod";
import { AggregationResultSchema, OwnerSnapshotSchema, OwnerEvidenceSchema, AnalyzerCoverageSchema, NarrativeSelectionSchema,
  ReadinessReportResponseSchema, GeneralizedNarrativeSchema, type NarrativeSelection, type ReadinessReportResponse, type AggregatedCapability,
  type Improvement, type OwnerEvidence } from "@repofy/contracts";
import { initialRubricCatalog as catalog } from "../rubrics/catalog";
import { DETECTORS } from "../detectors/registry";
import { canonical, digest } from "../aggregation/input";
import { round } from "../aggregation/policy";
import { NARRATIVE_POLICY as P, SynthesisError, synthesisVersion } from "./policy";

export const NarrativeFactsSchema = z.strictObject({ aggregation: AggregationResultSchema,
  snapshots: z.array(OwnerSnapshotSchema).min(1).max(10), coverage: z.array(AnalyzerCoverageSchema).min(1).max(10),
  evidence: z.array(OwnerEvidenceSchema).max(500), createdAt: z.iso.datetime() });
export type NarrativeFacts = z.infer<typeof NarrativeFactsSchema>;
export function stableId(run: string, key: string) {
  const h = createHash("sha256").update(`${run}:${key}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
const structuralStatements: Record<string, readonly [string, string]> = {
  dependency_presence: ["A dependency declaration was observed.", "A declaration does not establish usage, working integration or proficiency."],
  configuration_presence: ["A static configuration declaration was observed.", "Configuration does not establish successful execution or deployment."],
  source_structure_only: ["Parsed source structure was observed.", "Structure does not establish runtime behavior, correctness or proficiency."],
  schema_structure_only: ["Static database schema structure was observed.", "This does not establish an applied migration or deployed data integrity."],
  documentation_only: ["Documentation structure was observed.", "Documentation does not establish implemented behavior or operational quality."],
  historical_context: ["Bounded repository history metadata was observed.", "This does not establish individual authorship or a result for the analyzed commit."],
  exact_commit_result: ["Provider metadata is associated with the analyzed commit.", "This does not establish comprehensive test coverage, production success or individual authorship."],
};
function statement(c: AggregatedCapability, evidence: Map<string, OwnerEvidence>) {
  const cluster = c.trace.clusters.find(x => x.clusterId === c.trace.selectedClusterId);
  if (!cluster) throw new SynthesisError("unsupported_selection");
  const base = evidence.get(cluster.baseEvidenceId);
  const support = c.support.find(s => s.evidenceId === cluster.baseEvidenceId);
  if (!base || !support) throw new SynthesisError("unsupported_selection");
  const detector = base.implementation && DETECTORS.find(d => d.kind === base.implementation!.kind && d.id === base.detector.id);
  const scope = base.implementation ? base.implementation.kind === "asserted_call" ? null : "repository_behavior"
    : ["dependency_presence", "source_structure_only"].includes(support.boundary) ? "technology_presence"
      : support.boundary === "configuration_presence" ? "configuration_observation" : support.boundary === "historical_context" ? "contribution_indicator" : null;
  // Null scope is an observation-only boundary, never upgraded to a behavioral claim.
  if (scope && !c.allowedClaimScopes.includes(scope)) throw new SynthesisError("unsupported_selection");
  const pair = detector ? [detector.observation, detector.limitation] : structuralStatements[support.boundary];
  if (!pair || (detector && !detector.capabilityIds.includes(c.capabilityId))) throw new SynthesisError("unsupported_selection");
  const evidenceIds = [cluster.baseEvidenceId, ...cluster.corroboration.map(x => x.evidenceId)].sort();
  if (evidenceIds.some(id => !evidence.has(id) || !c.support.some(s => s.evidenceId === id))) throw new SynthesisError("unsupported_selection");
  return { capabilityId: c.capabilityId, statementId: detector ? detector.id : `observation.${support.boundary}`, evidenceIds,
    observation: pair[0], limitation: pair[1] + (c.provenance.policy === "context_only_v1" ? " Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements." : ""), corroboration: cluster.corroboration.length ? "A linked test assertion is present in source; passing execution is unverified." : null,
    scope: scope ?? "observation_only", strength: c.strength, confidence: c.confidence, confidenceLabel: c.confidenceLabel };
}
export function priority(factors: { roleRelevance: number; gap: number; expectedProof: number; confidence: number; effortCost: number }) {
  if ((["roleRelevance", "gap", "expectedProof", "confidence", "effortCost"] as const).some(k => !Number.isFinite(factors[k]) || factors[k] < (k === "effortCost" ? .25 : 0) || factors[k] > 1)) throw new SynthesisError("unsupported_selection");
  return round(Math.min(1, factors.roleRelevance * factors.gap * factors.expectedProof * factors.confidence / factors.effortCost));
}
export function prepareNarrative(raw: unknown, targetRole?: string) {
  const facts = NarrativeFactsSchema.parse(raw), a = facts.aggregation;
  if (canonical(a.versions.synthesis) !== canonical(synthesisVersion()) || a.versions.disclosurePolicy.id !== "candidate_private" || a.versions.disclosurePolicy.version !== "1.0.0" ||
    a.versions.taxonomy.id !== catalog.taxonomy.id || a.versions.taxonomy.version !== catalog.taxonomy.version ||
    canonical(facts.snapshots.map(s => s.snapshotId).sort()) !== canonical([...a.snapshotIds].sort())) throw new SynthesisError("unsupported_selection");
  const evidence = new Map(facts.evidence.map(e => [e.evidenceId as string,e]));
  if (facts.evidence.some(e => e.location || !facts.snapshots.some(s => s.snapshotId === e.snapshotId && s.repositoryId === e.repositoryId && s.commitSha === e.commitSha))) throw new SynthesisError("unsupported_selection");
  const explanations = a.capabilities.filter(c => c.state === "assessed").map(c => statement(c, evidence)).sort((x,y) => x.capabilityId.localeCompare(y.capabilityId));
  const gaps = a.capabilities.flatMap(c => {
    const roles = a.roles.filter(r => r.gaps.some(g => g.capabilityIds.includes(c.capabilityId)));
    if (!roles.length) return [];
    const state = c.state === "unknown" ? "not_assessable" as const : c.state === "not_observed" ? "not_observed" as const : "limited_evidence" as const;
    const definition = catalog.taxonomy.capabilities.find(d => d.capabilityId === c.capabilityId)!;
    if (!definition) throw new SynthesisError("unsupported_selection");
    const templates = catalog.taxonomy.improvementTemplates.filter(t => (state === "not_assessable" ? t.templateId === "coverage_review" : definition.improvementTemplateIds.includes(t.templateId)) && t.gapStates.includes(state));
    if (!templates.length) throw new SynthesisError("unsupported_selection");
    const relevant = targetRole ? roles.filter(r => r.template.roleId === targetRole) : roles;
    const roleRelevance = Math.max(0, ...relevant.flatMap(r => r.requirements.filter(q => q.capabilityIds.includes(c.capabilityId)).map(q => q.weight / r.denominator)));
    return [{ gapId: stableId(a.runId, `gap:${c.capabilityId}`), capabilityId: c.capabilityId, state, roleIds: roles.map(r => r.template.roleId).sort(),
      roleRelevance: round(roleRelevance), gap: c.strength === null ? 0 : round(1 - c.strength), confidence: c.confidence ?? 0,
      templates: templates.map(t => ({ templateId: t.templateId, title: t.title, rationale: t.rationale, projectBehavior: t.projectBehavior,
        expectedEvidence: t.expectedEvidence, acceptanceCriteria: t.acceptanceCriteria, effort: t.effort })) }];
  }).sort((x,y) => x.capabilityId.localeCompare(y.capabilityId));
  // Only application-authored strings and closed structured facts cross the provider boundary.
  const input = { schemaVersion: P.schemaVersion, runId: a.runId, versions: a.versions, disclosure: "no_repository_names_paths_source_or_authorship",
    targetRole: targetRole ?? null, explanations, gaps, roles: a.roles.map(r => ({ roleId: r.template.roleId, state: r.state, coverage: r.coverage, confidence: r.confidence })) };
  if (Buffer.byteLength(canonical(input)) > P.maxInputBytes) throw new SynthesisError("unsupported_selection");
  return { facts, input, inputHash: digest(input), allowedEvidenceIds: [...new Set(explanations.flatMap(e => e.evidenceIds))].sort() };
}
export type PreparedNarrative = ReturnType<typeof prepareNarrative>;
export function validateSelection(raw: unknown, p: PreparedNarrative): NarrativeSelection {
  const parsed = NarrativeSelectionSchema.safeParse(raw);
  if (!parsed.success) throw new SynthesisError("invalid_schema");
  const v = parsed.data;
  if (v.explanations.length !== p.input.explanations.length || v.improvements.length !== p.input.gaps.length ||
    new Set(v.explanations.map(x => x.capabilityId)).size !== v.explanations.length || new Set(v.improvements.map(x => x.gapId)).size !== v.improvements.length ||
    v.explanations.some(x => !p.input.explanations.some(e => e.capabilityId === x.capabilityId && e.statementId === x.statementId && canonical(e.evidenceIds) === canonical([...x.evidenceIds].sort()))) ||
    v.improvements.some(x => !p.input.gaps.some(g => g.gapId === x.gapId && g.templates.some(t => t.templateId === x.templateId)))) throw new SynthesisError("unsupported_selection");
  return v;
}
const UNKNOWN = "This capability is not assessable in the selected snapshots. No conclusion about missing skill or implementation follows.";
const NOT_OBSERVED = "Evidence was not observed within the assessed scope of the selected snapshots. Unassessed files and behavior remain unknown.";
const LIMITED = "Observed evidence is limited relative to the role requirements. This does not establish that project behavior is missing.";
const LIMITS = ["Scores are uncalibrated static-evidence policy values; candidate skill and authorship are not inferred.",
  "Coverage gaps and unknown requirements remain in the denominator. Runtime success and production outcomes are unverified.",
  "Improvements are proposed future proof, not existing achievements. Unknown coverage has zero ranking confidence.",
  "This report includes the selected base and linked corroboration for each capability; the owner evidence query retains the full evidence index."];
export function renderNarrative(p: PreparedNarrative, raw: unknown, modelRunId: string): ReadinessReportResponse {
  const selection = validateSelection(raw,p), a = p.facts.aggregation;
  const unverified = (key: string,text: string) => ({ verification: "unverified" as const, claimId: stableId(a.runId,key), text, label: "Unverified" as const, basis: "insufficient_evidence" as const });
  const claims = selection.explanations.map(x => {
    const s = p.input.explanations.find(e => e.capabilityId === x.capabilityId)!;
    const phrases = x.style === "observation_first" ? [s.observation,s.limitation] : [s.limitation,s.observation];
    return { verification: "verified" as const, claimId: stableId(a.runId,`claim:${x.capabilityId}`), capabilityIds: [x.capabilityId], evidenceIds: s.evidenceIds,
      text: [...phrases, ...(s.corroboration ? [s.corroboration] : []), `Evidence confidence is ${s.confidenceLabel}; proficiency and authorship are unverified.`].join(" ") };
  }).sort((x,y) => x.capabilityIds[0].localeCompare(y.capabilityIds[0]));
  const gaps = p.input.gaps.map(g => ({ gapId: g.gapId, capabilityId: g.capabilityId, state: g.state, roleIds: g.roleIds,
    explanation: unverified(`gap-explanation:${g.capabilityId}`,g.state === "not_assessable" ? UNKNOWN : g.state === "not_observed" ? NOT_OBSERVED : LIMITED) }));
  const improvements = selection.improvements.map(x => {
    const g = p.input.gaps.find(g => g.gapId === x.gapId)!, t = g.templates.find(t => t.templateId === x.templateId)!;
    const c = a.capabilities.find(c => c.capabilityId === g.capabilityId)!;
    const repositoryIds = [...new Set(c.support.length ? c.support.map(s => s.repositoryId)
      : c.trace.coverage.filter(s => g.state === "not_assessable" || s.state !== "not_assessable").map(s => s.repositoryId))].sort();
    const priorityTrace = { roleRelevance: g.roleRelevance, gap: g.gap, expectedProof: g.state === "not_assessable" ? 0 : .5,
      confidence: g.confidence, effortCost: { small: .25, medium: .5, large: 1, unknown: 1 }[t.effort],
      confidenceBasis: g.state === "not_assessable" ? "unknown" as const : "assessed_evidence" as const };
    return { improvementId: stableId(a.runId,`improvement:${g.capabilityId}`), title: t.title, gapIds: [g.gapId], capabilityIds: [g.capabilityId], roleIds: g.roleIds,
      rationale: unverified(`rationale:${g.capabilityId}`,`${t.rationale} ${t.projectBehavior} ${x.focus === "proof" ? "Prioritize observable verification of the chosen project behavior." : "Keep the change focused on one relevant project behavior."}`),
      expectedProof: t.expectedEvidence.map(text => `Proposed future proof: ${text}`), acceptanceCriteria: t.acceptanceCriteria,
      effort: t.effort, priority: priority(priorityTrace), priorityTrace, proofStatus: "proposed_not_observed" as const,
      priorityReasons: [`Role relevance ${g.roleRelevance}; evidence gap ${g.gap}.`, `Expected proof ${priorityTrace.expectedProof}; confidence ${g.confidence}; effort cost ${priorityTrace.effortCost}.`,
        "Proof gain and effort are policy estimates; score improvement is not guaranteed."],
      repositoryIds, permittedLocations: [] };
  }).sort((x,y) => y.priority - x.priority || x.capabilityIds[0].localeCompare(y.capabilityIds[0]));
  const groups = [...new Set(a.capabilities.map(c => c.categoryId))].sort().map(groupId => ({ groupId,
    capabilities: a.capabilities.filter(c => c.categoryId === groupId).map(c => c.state === "assessed" ? {
      capabilityId: c.capabilityId, state: c.state, strength: c.strength, confidence: c.confidence,
      evidenceIds: claims.find(x => x.capabilityIds[0] === c.capabilityId)!.evidenceIds, reasoning: claims.find(x => x.capabilityIds[0] === c.capabilityId)!,
    } : c.state === "not_observed" ? { capabilityId: c.capabilityId, state: c.state, confidence: c.confidence,
      coverageSnapshotIds: c.trace.coverage.filter(s => s.state !== "not_assessable").map(s => s.snapshotId), explanation: NOT_OBSERVED }
      : { capabilityId: c.capabilityId, state: c.state, reasons: ["insufficient_coverage"], explanation: UNKNOWN }) }));
  return ReadinessReportResponseSchema.parse({ contractVersion: "1.0.0", reportId: stableId(a.runId,"report"), analysisRunId: a.runId, jobId: a.jobId, ownerUserId: a.ownerUserId,
    visibility: "owner_only", versions: a.versions, createdAt: p.facts.createdAt,
    narrative: { policy: "bounded_narrative_1.0.0", schemaVersion: "1.0.0", rendering: "validated_model_selection_deterministic_text", modelRunId,
      aggregationInputHash: a.inputHash, inputHash: p.inputHash, rankingPolicy: P.ranking },
    snapshots: p.facts.snapshots.map((s,i) => ({ ...s, repositoryLabel: `Repository ${i+1}` })), coverage: p.facts.coverage,
    evidence: p.facts.evidence.filter(e => p.allowedEvidenceIds.includes(e.evidenceId)), capabilityGroups: groups,
    roles: a.roles.map(r => r.state === "unknown" ? { state: "unknown", template: r.template, reasons: ["insufficient_coverage"], limitations: LIMITS }
      : { state: "assessed", template: r.template, coverage: r.coverage, confidence: r.confidence,
        assessedRequirementIds: r.requirements.filter(q => q.state !== "unknown").map(q => q.requirementId), unknownRequirementIds: r.requirements.filter(q => q.state === "unknown").map(q => q.requirementId), limitations: LIMITS }),
    claims, gaps, improvements, limitations: LIMITS });
}
// Regenerate from closed choices at every publication boundary; reject any prose/numeric/locator edits.
export function validateRendered(report: ReadinessReportResponse, p: PreparedNarrative) {
  const selection: NarrativeSelection = { schemaVersion: "1.0.0", explanations: p.input.explanations.map(e => {
    const claim = report.claims.find(c => c.verification === "verified" && c.capabilityIds[0] === e.capabilityId);
    return { capabilityId: e.capabilityId, statementId: e.statementId, evidenceIds: e.evidenceIds, style: claim?.text.startsWith(e.limitation) ? "limitation_first" : "observation_first" };
  }), improvements: p.input.gaps.map(g => {
    const improvement = report.improvements.find(i => i.gapIds.includes(g.gapId as Improvement["gapIds"][number]));
    const template = g.templates.find(t => t.title === improvement?.title);
    if (!template) throw new SynthesisError("unsupported_selection");
    return { gapId: g.gapId as NarrativeSelection["improvements"][number]["gapId"], templateId: template.templateId,
      focus: improvement!.rationale.text.endsWith("Prioritize observable verification of the chosen project behavior.") ? "proof" : "behavior" };
  }) };
  if (!report.narrative || canonical(renderNarrative(p,selection,report.narrative.modelRunId)) !== canonical(report)) throw new SynthesisError("unsupported_selection");
}
export function generalizedNarrative(report: ReadinessReportResponse, p: PreparedNarrative) {
  validateRendered(report,p);
  return GeneralizedNarrativeSchema.parse({ projection: "generalized", policy: "bounded_narrative_1.0.0",
    capabilities: p.facts.aggregation.capabilities.map(c => ({ capabilityId: c.capabilityId, state: c.state, strength: c.strength, confidence: c.confidence })) });
}
