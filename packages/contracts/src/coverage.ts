import { z } from "zod";
import { StructuralCoverageSchema, StructuralInventorySchema } from "./structural";
import { ImplementationCoverageSchema } from "./implementation";
import { AchievedCoverageSchema } from "./assessability";
import {
  ContractVersionSchema, CountSchema, KeySchema, LimitationsSchema, ScoreSchema, ShortTextSchema,
  SnapshotIdSchema, UnknownReasonsSchema, VersionReferenceSchema, VersionSchema,
} from "./primitives";

export const LanguageCoverageSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("assessed"), language: KeySchema,
    depth: z.enum(["inventory", "structural", "semantic"]),
    eligibleFiles: CountSchema.min(1), analyzedFiles: CountSchema,
    coverage: ScoreSchema, limitations: LimitationsSchema,
  }).refine((value) => value.analyzedFiles <= value.eligibleFiles &&
    Math.abs(value.coverage - value.analyzedFiles / value.eligibleFiles) < 1e-6 &&
    (value.analyzedFiles === value.eligibleFiles || value.limitations.length > 0),
  "Coverage must match its denominator and describe incomplete processing"),
  z.strictObject({ state: z.literal("unknown"), language: KeySchema, reasons: UnknownReasonsSchema, limitations: LimitationsSchema }),
]);
export const AnalyzerCoverageSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  snapshotId: SnapshotIdSchema,
  manifestVersion: VersionSchema,
  detectorBundle: VersionReferenceSchema,
  languages: z.array(LanguageCoverageSchema).min(1).max(100).refine(
    (values) => new Set(values.map((value) => value.language)).size === values.length, "Duplicate language"),
  limitations: LimitationsSchema,
  structural: StructuralCoverageSchema.optional(),
  implementation: ImplementationCoverageSchema.optional(),
  // Absent on legacy results. Absence is unknown, never retroactively inferred.
  assessment: AchievedCoverageSchema.optional(),
}).refine(v => !v.assessment || (!!v.structural && !!v.implementation && v.assessment.declaration.version === v.manifestVersion
  && v.structural.sources.reduce((n, row) => n + row.eligibleFiles, 0) === v.assessment.counts.eligibleFiles
  && v.structural.sources.reduce((n, row) => n + row.analyzedFiles, 0) === v.assessment.counts.analyzedFiles), "Achieved coverage must match the version and recorded processing scope");
export const InventorySummarySchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  snapshotId: SnapshotIdSchema,
  extractorBundle: VersionReferenceSchema,
  totalFiles: CountSchema,
  eligibleFiles: CountSchema,
  excludedFiles: CountSchema,
  analyzedFiles: CountSchema,
  languages: z.array(z.strictObject({ language: KeySchema, files: CountSchema })).max(100),
  frameworks: z.array(z.strictObject({ name: ShortTextSchema, basis: z.enum(["dependency", "configuration", "implementation"]) })).max(100),
  testFiles: CountSchema, configFiles: CountSchema, documentationFiles: CountSchema, ciFiles: CountSchema,
  metadata: z.strictObject({ commits: z.boolean(), pullRequests: z.boolean(), ci: z.boolean() }),
  limitations: LimitationsSchema,
  structural: StructuralInventorySchema.optional(),
}).refine((value) => value.totalFiles === value.eligibleFiles + value.excludedFiles &&
  value.analyzedFiles <= value.eligibleFiles &&
  [value.testFiles, value.configFiles, value.documentationFiles, value.ciFiles].every((count) => count <= value.totalFiles),
"Inventory counts are inconsistent").refine(value => !value.structural ||
  (Object.values(value.structural.exclusions).reduce((a, b) => a + b, 0) === value.excludedFiles
    && value.languages.reduce((n, language) => n + language.files, 0) === value.eligibleFiles
    && new Set(value.languages.map(l => l.language)).size === value.languages.length), "Structural denominators must include security exclusions");
export type AnalyzerCoverage = z.infer<typeof AnalyzerCoverageSchema>;
export type LanguageCoverage = z.infer<typeof LanguageCoverageSchema>;
export type InventorySummary = z.infer<typeof InventorySummarySchema>;
