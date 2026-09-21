import { z } from "zod";
import { SOURCE_FAMILIES, StructuralObservationSchema, type StructuralObservation, type CoverageReason } from "@repofy/contracts";

export const EXTRACTION_LIMITS = Object.freeze({ fileBytes: 256 * 1024, nodes: 20000, depth: 64, evidence: 2000,
  durationMs: 60000, metadataPageSize: 50, metadataPages: 2, metadataBytes: 1024 * 1024 });
export type Family = typeof SOURCE_FAMILIES[number];
export type ProcessingState = "analyzed" | "parse_failure" | "unsupported" | "limited";
export const structuralDetectorVersion = (family: string) => family === "schemas" ? "1.0.1" as const : "1.0.0" as const;
export interface FileInput { path: string; text: string; language: string; classification: string }
export interface Finding { sourceType: "code" | "test" | "config" | "docs" | "ci" | "dependency"; observation: string; detail: StructuralObservation }
export interface ExtractionResult { state: ProcessingState; findings: Finding[]; associations?: string[]; project?: boolean; workspacePatterns?: string[]; reasons?: CoverageReason[] }
export interface Extractor {
  readonly id: Family; readonly version: "1.0.0" | "1.0.1"; readonly supportedTypes: readonly string[];
  readonly budget: typeof EXTRACTION_LIMITS; readonly outputSchema: typeof StructuralObservationSchema;
  readonly failureBehavior: "record_coverage_without_source";
  extract(input: Readonly<FileInput>): ExtractionResult;
}
export class ParseFailure extends Error {
  constructor(readonly state: Exclude<ProcessingState, "analyzed"> = "parse_failure") { super(state); }
}
export function extractor(id: Family, supportedTypes: readonly string[], extract: Extractor["extract"]): Extractor {
  return Object.freeze({ id, version: structuralDetectorVersion(id), supportedTypes: Object.freeze([...supportedTypes]), budget: EXTRACTION_LIMITS,
    outputSchema: StructuralObservationSchema, failureBehavior: "record_coverage_without_source", extract });
}
export function detail(kind: StructuralObservation["kind"], confidenceBasis: StructuralObservation["confidenceBasis"],
  claimBoundary: StructuralObservation["claimBoundary"], counts: StructuralObservation["counts"] = {},
  technologies: StructuralObservation["technologies"] = [], limitations: string[] = []): StructuralObservation {
  return StructuralObservationSchema.parse({ kind, confidenceBasis, claimBoundary, counts, technologies: [...new Set(technologies)].sort(),
    calibration: "uncalibrated", limitations: ["Static observations do not establish execution, correctness, proficiency or authorship.", ...limitations] });
}
export function extractionProfile(disabled: readonly Family[] = []) {
  const list = z.array(z.enum(SOURCE_FAMILIES)).max(7).parse(disabled).sort();
  if (new Set(list).size !== list.length) throw new ParseFailure();
  return Object.freeze({ disabled: Object.freeze(list),
    extractorBundle: { id: "structural_inventory", version: `1.0.1${list.length ? `-disabled-${SOURCE_FAMILIES.map(id => list.includes(id) ? "1" : "0").join("")}` : ""}` },
    detectorBundle: { id: "structural_signals", version: "1.0.1" }, coverageManifest: "1.0.1" });
}
