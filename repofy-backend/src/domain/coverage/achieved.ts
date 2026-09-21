import { AchievedCoverageSchema, type AchievedCoverage, type CoverageReason, type FileCoverageOutcome, type StructuralCoverage,
  type ImplementationCoverage, type InventorySummary } from "@repofy/contracts";
import type { InternalEvidenceObservation } from "@repofy/contracts/internal";
import { initialRubricCatalog } from "../rubrics/catalog";
import { DETECTORS } from "../detectors/registry";
import { coverageDeclaration, type coverageProfile } from "./manifest";

interface FileFact { language: string; classification: string; analyzed: boolean; structure?: { depth: string; coverage?: FileCoverageOutcome } }
export interface AssessmentInput { files: readonly FileFact[]; evidence: readonly InternalEvidenceObservation[]; inventorySummary: InventorySummary;
  coverage: { structural?: StructuralCoverage; implementation?: ImplementationCoverage } }
const reasons = (items: readonly CoverageReason[]) => [...new Set(items)].sort();
const meaningful = (e: InternalEvidenceObservation) => !!e.implementation || !!e.structural && (!!e.structural.provider || e.structural.technologies.length > 0
  || Object.values(e.structural.counts).some(n => n && n > 0));

/** Facts for Run 11. No role scores, proficiency inference or replacement of unknowns with zero. */
export function achievedCoverage(input: AssessmentInput, profile: ReturnType<typeof coverageProfile>): AchievedCoverage {
  const { files, evidence, inventorySummary: inventory, coverage } = input;
  const structural = coverage.structural!; const implementation = coverage.implementation!;
  const useful = evidence.filter(meaningful);
  const global: CoverageReason[] = ["runtime_not_assessed", "uncalibrated"];
  if (inventory.excludedFiles) global.push("security_exclusions");
  if (!files.some(f => ["code", "test"].includes(f.classification))) global.push("no_eligible_source");
  if (structural.metadata.some(m => !["available", "no_signal"].includes(m.state))) global.push("metadata_unavailable");
  if (structural.metadata.some(m => m.state !== "not_requested")) global.push("history_bounded");
  if (structural.evidenceTruncated || implementation.evidenceTruncated) global.push("evidence_budget_exhausted");
  if (implementation.disabledDetectors.length) global.push("detector_disabled");
  if (implementation.limitedFiles) global.push("reduced_scan", "parse_budget_exhausted");
  if (implementation.unresolvedImports || implementation.dynamicReferences || implementation.ambiguousBindings || implementation.aliasConfigurationsRejected) global.push("resolution_incomplete");
  for (const f of files) global.push(...f.structure!.coverage!.reasons);
  if (!useful.length) global.push("no_observed_evidence");
  const counts = { totalFiles: inventory.totalFiles, excludedFiles: inventory.excludedFiles, eligibleFiles: files.length,
    analyzedFiles: inventory.analyzedFiles, unparsedFiles: files.length - inventory.analyzedFiles,
    analyzedFractionOfAllFiles: inventory.totalFiles ? inventory.analyzedFiles / inventory.totalFiles : null };
  const languages = [...new Set(files.map(f => f.language))].sort().map(language => {
    const selected = files.filter(f => f.language === language), analyzed = selected.filter(f => f.analyzed);
    const impl = selected.filter(f => f.structure!.coverage!.implementation === "analyzed");
    return { language, eligibleFiles: selected.length, analyzedFiles: analyzed.length, unparsedFiles: selected.length - analyzed.length,
      implementationAnalyzedFiles: impl.length, depth: impl.length ? "bounded_patterns" as const : analyzed.some(f => f.structure?.depth === "structural") ? "baseline" as const : "inventory" as const,
      reasons: reasons([...selected.flatMap(f => f.structure!.coverage!.reasons), ...(!impl.length && selected.some(f => ["code", "test"].includes(f.classification)) ? ["unsupported_depth" as const] : [])]) };
  });
  const capabilities = initialRubricCatalog.taxonomy.capabilities.map(({ capabilityId }) => {
    const detectors = DETECTORS.filter(d => d.capabilityIds.includes(capabilityId));
    const structuralKinds: Record<string, string[]> = { language_presence: ["structure"], framework_presence: ["dependency", "configuration"],
      data_modeling: ["schema"], delivery_automation: ["workflow"], delivery_reproducibility: ["container"],
      documentation_operability: ["documentation"], documentation_decisions: ["documentation"] };
    const families: Record<string, string[]> = { language_presence: ["source", "tests"], framework_presence: ["manifests", "configuration"],
      data_modeling: ["schemas"], delivery_automation: ["ci"], delivery_reproducibility: ["configuration"],
      documentation_operability: ["documentation"], documentation_decisions: ["documentation"] };
    const enabled = detectors.some(d => !implementation.disabledDetectors.includes(d.kind));
    const selected = files.filter(f => (detectors.length > 0 && ["code", "test"].includes(f.classification) && ["source", "tests"].includes(f.structure!.coverage!.source))
      || families[capabilityId]?.includes(f.structure!.coverage!.source));
    const analyzed = selected.filter(f => families[capabilityId]?.includes(f.structure!.coverage!.source) ? f.analyzed && f.structure?.depth === "structural"
      : enabled && f.structure!.coverage!.implementation === "analyzed");
    const observed = useful.filter(e => e.implementation ? enabled && e.capabilityIds.includes(capabilityId)
      : structuralKinds[capabilityId]?.includes(e.structural!.kind) && (capabilityId !== "framework_presence" || e.structural!.technologies.length > 0)
        && (capabilityId !== "documentation_decisions" || (e.structural!.counts.architectureHeadings ?? 0) > 0));
    const history = capabilityId === "provenance_history" ? structural.metadata.filter(m => ["commits", "pullRequests"].includes(m.source)) : [];
    const metadataAssessed = history.some(m => ["available", "no_signal", "truncated"].includes(m.state));
    const metadataRecords = history.reduce((n, m) => n + m.records, 0);
    const observations = observed.length + (capabilityId === "provenance_history" ? useful.filter(e => e.structural?.provider && ["commit", "pull_request"].includes(e.structural.kind)).length : 0);
    const supported = !!detectors.length || !!families[capabilityId] || !!history.length;
    const why: CoverageReason[] = ["runtime_not_assessed", "uncalibrated", ...selected.flatMap(f => f.structure!.coverage!.reasons)];
    if (!supported || capabilityId !== "language_presence") why.push("unsupported_depth");
    if (!selected.length && !metadataAssessed) why.push("no_eligible_source");
    if (inventory.excludedFiles) why.push("security_exclusions");
    if (detectors.some(d => implementation.disabledDetectors.includes(d.kind))) why.push("detector_disabled");
    if (detectors.length) why.push("unsupported_version", ...(global.filter(r => ["resolution_incomplete", "reduced_scan", "evidence_budget_exhausted"].includes(r))));
    if (capabilityId.startsWith("mobile_")) why.push("native_mobile_not_assessed");
    if (capabilityId.startsWith("ai_")) why.push("ai_runtime_not_assessed");
    if (history.length) why.push("history_bounded", ...(!metadataAssessed ? ["metadata_unavailable" as const] : []));
    if (!observations && (analyzed.length || metadataAssessed)) why.push("no_observed_evidence");
    return { capabilityId, eligibleFiles: selected.length, analyzedFiles: analyzed.length, unparsedFiles: selected.length - analyzed.length,
      observations, metadataAssessed, metadataRecords,
      state: !analyzed.length && !metadataAssessed ? "not_assessable" as const : !observations ? "evidence_not_observed_within_assessed_scope" as const
        : capabilityId === "language_presence" && analyzed.length === selected.length && !inventory.excludedFiles ? "assessable" as const : "partially_assessable" as const,
      depth: detectors.length ? "bounded_patterns" as const : supported ? "baseline" as const : "unsupported" as const,
      confidenceCeiling: !analyzed.length && !metadataAssessed ? 0 : detectors.length ? 0.55 : 0.5, reasons: reasons(why) };
  });
  return AchievedCoverageSchema.parse({ declaration: coverageDeclaration(profile.coverage.disabledParsers), counts, languages, capabilities,
    state: !counts.analyzedFiles ? "not_assessable" : !useful.length ? "evidence_not_observed_within_assessed_scope"
      : counts.unparsedFiles || counts.excludedFiles || global.some(r => ["reduced_scan", "resolution_incomplete", "evidence_budget_exhausted", "dynamic_configuration", "unsupported_depth"].includes(r)) ? "partially_assessable" : "assessable",
    result: useful.length ? "evidence_available" : "insufficient_evidence", reasons: reasons(global) });
}
