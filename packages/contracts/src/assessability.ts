import { z } from "zod";
import { CountSchema, KeySchema, ScoreSchema, VersionSchema, uniqueArray } from "./primitives";
import { SOURCE_FAMILIES } from "./structural";

// Public labels are selected from these codes. Never render parser messages or source text.
export const CoverageReasonSchema = z.enum([
  "unsupported_depth", "no_eligible_source", "parser_failure", "parse_budget_exhausted", "parser_unavailable", "parser_disabled",
  "metadata_unavailable", "history_bounded", "security_exclusions", "reduced_scan", "dynamic_configuration", "unsupported_version",
  "evidence_budget_exhausted", "detector_disabled", "resolution_incomplete", "runtime_not_assessed", "native_mobile_not_assessed",
  "ai_runtime_not_assessed", "uncalibrated", "legacy_coverage_unknown", "generated_source", "no_observed_evidence",
]);
export type CoverageReason = z.infer<typeof CoverageReasonSchema>;
export const CoverageReasonsSchema = uniqueArray(CoverageReasonSchema, 24);
export const COVERAGE_REASON_LABELS: Readonly<Record<CoverageReason, string>> = Object.freeze({
  unsupported_depth: "Implementation analysis is not supported for part of this scope.",
  no_eligible_source: "No eligible source was available for this assessment.",
  parser_failure: "Some files could not be parsed; their contents were not assessed.",
  parse_budget_exhausted: "Some files exceeded the parser or detector budget.",
  parser_unavailable: "A required parser was unavailable. This is a service issue.",
  parser_disabled: "A parser is disabled in this analyzer version.",
  metadata_unavailable: "Optional repository history or CI results were not available.",
  history_bounded: "History covers at most two pages of 50 records per source; it is not complete history.",
  security_exclusions: "Excluded files remain in the total file count; their language and capabilities are unknown.",
  reduced_scan: "The bounded implementation pass assessed only part of the eligible source.",
  dynamic_configuration: "Dynamic build or configuration behavior was not evaluated.",
  unsupported_version: "Installed framework versions and runtime changes were not verified.",
  evidence_budget_exhausted: "Some observations were omitted at the evidence limit.",
  detector_disabled: "Some implementation detectors are disabled in this analyzer version.",
  resolution_incomplete: "Some imports or bindings could not be resolved within the static scope.",
  runtime_not_assessed: "Repository code, tests and builds were not run.",
  native_mobile_not_assessed: "Native mobile lifecycle, navigation and offline behavior are not assessed.",
  ai_runtime_not_assessed: "Model quality, retrieval quality, evaluation and runtime safety are not assessed.",
  uncalibrated: "Confidence values are conservative policy limits, not calibrated accuracy estimates.",
  legacy_coverage_unknown: "This older result did not record achieved coverage.",
  generated_source: "Generated source does not establish implementation evidence.",
  no_observed_evidence: "No evidence was observed within the assessed scope; this does not establish a missing skill.",
});
export const CoverageStateSchema = z.enum(["assessable", "partially_assessable", "not_assessable", "evidence_not_observed_within_assessed_scope"]);
export const CoverageDepthSchema = z.enum(["inventory", "baseline", "bounded_patterns", "unsupported"]);
export const BASELINE_PARSERS = ["python", "java", "maven"] as const;
export const ParserIdSchema = z.enum(BASELINE_PARSERS);
export const FileCoverageOutcomeSchema = z.strictObject({
  source: z.enum(SOURCE_FAMILIES), parser: KeySchema, reasons: CoverageReasonsSchema,
  implementation: z.enum(["not_applicable", "analyzed", "parse_failure", "unsupported", "limited", "generated"]),
});
export const CoverageSelectionPolicySchema = z.strictObject({
  id: z.literal("all_safe_files_bounded_patterns_v1"), order: z.literal("path_lexical"),
  reducedScanOffered: z.literal(false), ingestionLimitBehavior: z.literal("fail_entire_snapshot"),
  maxFileBytes: z.literal(262144), maxParserNodes: z.literal(20000), maxParserDepth: z.literal(64),
  maxImplementationFiles: z.literal(256), maxImplementationBytes: z.literal(2097152), maxObservations: z.literal(2000),
});
export const CoverageDeclarationSchema = z.strictObject({
  version: VersionSchema, selection: CoverageSelectionPolicySchema,
  disabledParsers: uniqueArray(ParserIdSchema, 3),
  parsers: z.array(z.strictObject({ id: ParserIdSchema, package: KeySchema, version: VersionSchema })).length(3),
  entries: z.array(z.strictObject({
    id: KeySchema, languages: uniqueArray(KeySchema, 20), fileTypes: uniqueArray(KeySchema, 20),
    extractors: uniqueArray(KeySchema, 10), capabilities: uniqueArray(KeySchema, 40),
    depth: CoverageDepthSchema, confidenceCeiling: ScoreSchema, reasons: CoverageReasonsSchema,
  })).min(1).max(40).refine(entries => new Set(entries.map(e => e.id)).size === entries.length),
});
const scopeCounts = { eligibleFiles: CountSchema, analyzedFiles: CountSchema, unparsedFiles: CountSchema };
const consistent = (v: { eligibleFiles: number; analyzedFiles: number; unparsedFiles: number }) => v.eligibleFiles === v.analyzedFiles + v.unparsedFiles;
export const AchievedCoverageSchema = z.strictObject({
  declaration: CoverageDeclarationSchema, state: CoverageStateSchema,
  result: z.enum(["evidence_available", "insufficient_evidence"]), reasons: CoverageReasonsSchema,
  counts: z.strictObject({ totalFiles: CountSchema, excludedFiles: CountSchema, ...scopeCounts,
    // All discovered files, including unclassified exclusions. Null means no denominator.
    analyzedFractionOfAllFiles: ScoreSchema.nullable(),
  }).refine(v => consistent(v) && v.totalFiles === v.eligibleFiles + v.excludedFiles
    && (v.totalFiles === 0 ? v.analyzedFractionOfAllFiles === null : v.analyzedFractionOfAllFiles !== null
      && Math.abs(v.analyzedFractionOfAllFiles - v.analyzedFiles / v.totalFiles) < 1e-6)),
  languages: z.array(z.strictObject({ language: KeySchema, depth: CoverageDepthSchema, ...scopeCounts,
    implementationAnalyzedFiles: CountSchema, reasons: CoverageReasonsSchema,
  }).refine(v => consistent(v) && v.implementationAnalyzedFiles <= v.analyzedFiles)).max(100)
    .refine(rows => new Set(rows.map(r => r.language)).size === rows.length),
  capabilities: z.array(z.strictObject({ capabilityId: KeySchema, state: CoverageStateSchema, depth: CoverageDepthSchema,
    ...scopeCounts, observations: CountSchema, metadataAssessed: z.boolean(), metadataRecords: CountSchema,
    confidenceCeiling: ScoreSchema, reasons: CoverageReasonsSchema,
  }).refine(v => consistent(v)
    && (v.state !== "not_assessable" || v.observations === 0)
    && (v.state !== "evidence_not_observed_within_assessed_scope" || ((v.analyzedFiles > 0 || v.metadataAssessed) && v.observations === 0))
    && (!["assessable", "partially_assessable"].includes(v.state) || v.observations > 0))).min(1).max(100)
    .refine(rows => new Set(rows.map(r => r.capabilityId)).size === rows.length),
}).refine(v => v.languages.reduce((n, row) => n + row.eligibleFiles, 0) === v.counts.eligibleFiles
  && v.languages.reduce((n, row) => n + row.analyzedFiles, 0) === v.counts.analyzedFiles);
export type CoverageDeclaration = z.infer<typeof CoverageDeclarationSchema>;
export type AchievedCoverage = z.infer<typeof AchievedCoverageSchema>;
export type FileCoverageOutcome = z.infer<typeof FileCoverageOutcomeSchema>;
export type BaselineParser = typeof BASELINE_PARSERS[number];
