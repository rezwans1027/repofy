import { ImplementationObservationSchema, type ImplementationCoverage, type ImplementationObservation, type ImplementationKind } from "@repofy/contracts";
import * as ts from "typescript";
import type { ProcessingState } from "../extraction/policy";
import { ParseFailure } from "../extraction/policy";
import { JobError } from "../jobs/policy";
import { COMMON_LIMITATIONS, DETECTORS, DETECTOR_LIMITS as LIMIT, implementationProfile } from "./registry";
import { ProjectIndex, type IndexedFile, type SourceInput } from "./project";
import { detect } from "./rules";

export interface ImplementationFinding { file: SourceInput; kind: ImplementationKind; detail: ImplementationObservation }
export class ImplementationPass {
  readonly project = new ProjectIndex();
  readonly coverage: ImplementationCoverage;
  readonly outcomes = new Map<string, "analyzed" | "parse_failure" | "unsupported" | "limited" | "generated">();
  private elapsed = 0;
  private eligible = 0;
  constructor(private readonly profile: Pick<ReturnType<typeof implementationProfile>, "detectorBundle" | "implementation">, private readonly id: (kind: string, key: unknown) => string) {
    this.coverage = { bundle: profile.detectorBundle, calibration: "uncalibrated", scope: "bounded_patterns_only", eligibleFiles: 0,
      analyzedFiles: 0, parseFailures: 0, limitedFiles: 0, unsupportedFiles: 0, generatedFiles: 0, noSignalFiles: 0,
      unresolvedImports: 0, dynamicReferences: 0, ambiguousBindings: 0, aliasConfigurationsRejected: 0, indexedNodes: 0, indexedBytes: 0,
      evidenceTruncated: false, disabledDetectors: [...profile.implementation.disabled],
      detectors: DETECTORS.map(d => ({ kind: d.kind, version: d.version, capabilityIds: [...d.capabilityIds],
        state: profile.implementation.disabled.includes(d.kind) ? "quarantined" : "enabled", observations: 0 })),
      limitations: [...COMMON_LIMITATIONS, "Generated headers, dynamic resolution, re-exports, global test APIs, JSX spreads, inherited compiler configuration and unsupported frameworks are not assessed."] };
  }
  config(path: string, text: string) { this.project.addConfig(path, text); }
  add(input: SourceInput, structuralState: ProcessingState) {
    if (!/\.[cm]?[jt]sx?$/.test(input.path) || !["code", "test"].includes(input.classification)) return;
    this.coverage.eligibleFiles++; this.eligible++;
    if (structuralState !== "analyzed") { this.outcomes.set(input.path, structuralState); this.coverage[structuralState === "parse_failure" ? "parseFailures" : structuralState === "limited" ? "limitedFiles" : "unsupportedFiles"]++; return; }
    if (/@generated\b|auto[- ]generated\b|code generated[^\n]*do not edit/i.test(input.text.slice(0, 4096))) { this.outcomes.set(input.path, "generated"); this.coverage.generatedFiles++; return; }
    if (/\.d\.[cm]?ts$/.test(input.path)) { this.outcomes.set(input.path, "unsupported"); this.coverage.unsupportedFiles++; return; }
    if (this.eligible > LIMIT.files) { this.outcomes.set(input.path, "limited"); this.coverage.limitedFiles++; return; }
    const started = performance.now();
    try {
      const file = this.project.add(input);
      // Direct evaluation / with can invalidate lexical bindings; the whole file is uncertain.
      if (file.calls.some(c => ts.isIdentifier(c.expression) && c.expression.text === "eval") || file.nodes.some(ts.isWithStatement)) {
        this.project.files.delete(input.path); this.outcomes.set(input.path, "unsupported"); this.coverage.unsupportedFiles++;
      }
    } catch (error) { const state = error instanceof ParseFailure && error.state === "limited" ? "limited" : "parse_failure";
      this.outcomes.set(input.path, state); this.coverage[state === "limited" ? "limitedFiles" : "parseFailures"]++; }
    this.elapsed += performance.now() - started;
    if (performance.now() - started > LIMIT.fileMs || this.elapsed > LIMIT.durationMs) throw new JobError("WORKER_EXPIRED");
  }
  finish(): ImplementationFinding[] {
    const started = performance.now(); const output: ImplementationFinding[] = [];
    this.project.resetTraversal(); this.project.finish();
    const reference = (file: IndexedFile, node: Parameters<IndexedFile["span"]>[0]) => {
      const lines = file.span(node).lines;
      return { fileId: file.input.fileId, symbolId: this.id("symbol", [file.input.fileId, node.pos, node.end]),
        conceptId: this.id("concept", [file.input.fileId, node.pos, node.end]), lines };
    };
    for (const file of this.project.files.values()) {
      this.project.resetTraversal();
      try {
        const findings = detect(file).filter(f => !this.profile.implementation.disabled.includes(f.kind));
        const selected = findings.slice(0, LIMIT.findingsPerFile); if (findings.length > selected.length) this.coverage.evidenceTruncated = true;
        const items = selected.map(finding => {
          const definition = DETECTORS.find(d => d.kind === finding.kind)!; const ref = reference(file, finding.concept);
          return { file: file.input, kind: finding.kind, detail: ImplementationObservationSchema.parse({ kind: finding.kind,
            confidenceBasis: "resolved_static_pattern", calibration: "uncalibrated", claimBoundary: finding.kind === "asserted_call" ? "assertion_source" : finding.kind === "schema_constraint" ? "declared_constraint" : "observed_control",
            span: file.span(finding.node), symbolId: ref.symbolId, conceptId: ref.conceptId,
            patternId: this.id("pattern", file.shape(finding.concept)), testBoundary: finding.kind !== "asserted_call" ? "not_a_test" : finding.mocked ? "mocked_or_intercepted" : "local_implementation",
            relations: finding.target ? [{ ...reference(finding.target.file, finding.target.node), relationship: finding.kind === "asserted_call" ? "asserted_call" : "local_call",
              independence: finding.kind !== "asserted_call" ? "same_source" : finding.mocked ? "mocked_test" : "separate_test" }] : [],
            limitations: [...COMMON_LIMITATIONS, definition.limitation] }) };
        });
        output.push(...items); this.outcomes.set(file.input.path, "analyzed"); this.coverage.analyzedFiles++; if (!items.length) this.coverage.noSignalFiles++;
      } catch (error) { if (!(error instanceof ParseFailure)) throw new JobError("ANALYSIS_VALIDATION_FAILED"); this.outcomes.set(file.input.path, "limited"); this.coverage.limitedFiles++; }
      if (this.elapsed + performance.now() - started > LIMIT.durationMs) throw new JobError("WORKER_EXPIRED");
    }
    Object.assign(this.coverage, this.project.stats);
    return output;
  }
}
