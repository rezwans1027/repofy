import { setImmediate } from "node:timers/promises";
import { SOURCE_FAMILIES, StructuralObservationSchema, type StructuralCoverage, type VersionDependencies } from "@repofy/contracts";
import { InternalEvidenceObservationSchema, type InternalEvidenceObservation, type InternalLocator } from "@repofy/contracts/internal";
import { SnapshotBundleSchema, type SnapshotBundle } from "../analysis/persistence";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import type { PinnedSnapshot } from "../ingestion/repository";
import type { SafeSnapshotContext } from "../ingestion/service";
import { checkSignal } from "../ingestion/errors";
import type { AnalysisHandlers } from "../jobs/worker";
import type { AuthorizedMetadataSource } from "../github-app/metadata-client";
import { JobError } from "../jobs/policy";
import { associate, classify, directory, isProjectManifest, nearestProject } from "./inventory";
import { ci, configuration, documentation, schemas } from "./configuration";
import { manifests } from "./manifests";
import { source, tests } from "./source";
import { boundedText } from "./parsers";
import { emptyMetadata, METADATA_SOURCES, MetadataBatchSchema, requested, type MetadataBatch, type MetadataOptions } from "./metadata";
import { EXTRACTION_LIMITS as LIMIT, extractionProfile, structuralDetectorVersion, ParseFailure, type ExtractionResult, type Family } from "./policy";
import { ImplementationPass } from "../detectors/pass";
import { DETECTORS, implementationProfile } from "../detectors/registry";
import type { ImplementationKind } from "@repofy/contracts";
import type { CoverageReason, BaselineParser } from "@repofy/contracts";
import { coverageProfile } from "../coverage/manifest";
import { achievedCoverage } from "../coverage/achieved";
import { BaselineFailure, baselineParser, extractBaseline } from "./baseline";

export const EXTRACTORS = Object.freeze({ manifests, configuration, tests, ci, schemas, documentation, source });
const limitations = ["Coverage describes bounded static structure; implementation behavior and test results were not evaluated.",
  "Excluded files remain in total inventory. Language and source denominators cover eligible files only; excluded paths are not retained.",
  "No observed signal is not evidence of a missing skill or of the author never testing."];
const isLock = (path: string) => /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(path);
function uuid(digest: string): string {
  const hex = digest.slice(7, 39).split(""); hex[12] = "5"; hex[16] = "8";
  const value = hex.join(""); return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export interface ExtractionMetrics { files: number; analyzed: number; parseFailures: number; limited: number; evidence: number; truncated: boolean; durationMs: number }
export interface SnapshotExtractionInput {
  pin: Readonly<PinnedSnapshot>; versions: VersionDependencies; options: MetadataOptions; metadata?: MetadataBatch;
  crypto: LocatorCrypto; signal: AbortSignal; profile?: ReturnType<typeof extractionProfile> | ReturnType<typeof implementationProfile> | ReturnType<typeof coverageProfile>;
}

/** Orchestration only consumes the filtered capability. Parsers receive one bounded string
 * and metadata facts; they have no filesystem, resolver, module loader, shell or provider client. */
export async function extractSnapshot(context: SafeSnapshotContext, input: SnapshotExtractionInput): Promise<{ bundle: SnapshotBundle; metrics: ExtractionMetrics }> {
  const { pin, versions, options, crypto, signal } = input; const profile = input.profile ?? extractionProfile();
  const expectedProfile = "implementation" in profile ? "coverage" in profile
    ? coverageProfile(profile.coverage.disabledParsers, profile.implementation.disabled) : implementationProfile(profile.implementation.disabled)
    : extractionProfile(profile.disabled);
  if (JSON.stringify(profile) !== JSON.stringify(expectedProfile) || "implementation" in profile
    && (versions.taxonomy.id !== "engineering_capabilities" || versions.taxonomy.version !== "1.0.0")) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  const createdAt = new Date(pin.resolvedAt).toISOString();
  if (JSON.stringify(versions.extractorBundle) !== JSON.stringify(profile.extractorBundle)
    || JSON.stringify(versions.detectorBundle) !== JSON.stringify(profile.detectorBundle) || versions.coverageManifest !== profile.coverageManifest
    || versions.ingestionPolicyHash !== pin.policyHash || context.snapshot.policyHash !== pin.policyHash
    || context.snapshot.pinId !== pin.pinId || context.snapshot.repositoryId !== pin.repositoryId || context.snapshot.commitSha !== pin.commitSha
    || context.snapshot.repositoryVisibility !== pin.repositoryVisibility) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  const metadata = MetadataBatchSchema.parse(input.metadata ?? emptyMetadata(pin.repositoryId, pin.commitSha, options));
  metadata.groups.sort((a, b) => METADATA_SOURCES.indexOf(a.coverage.source) - METADATA_SOURCES.indexOf(b.coverage.source));
  for (const group of metadata.groups) group.records.sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
  if (metadata.repositoryId !== pin.repositoryId || metadata.commitSha !== pin.commitSha
    || metadata.groups.some(g => requested(g.coverage.source, options) === (g.coverage.state === "not_requested"))) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  const started = performance.now(); const safeFiles = [...await context.files()].sort((a, b) =>
    a.locator.kind === "file" && b.locator.kind === "file" ? a.locator.path < b.locator.path ? -1 : a.locator.path > b.locator.path ? 1 : 0 : 0);
  if (safeFiles.length !== context.summary.eligibleFiles || safeFiles.some(f => f.locator.kind !== "file")) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  const digest = (value: unknown) => crypto.fingerprintContent(JSON.stringify(value), pin.repositoryId);
  // Optional metadata is mutable. Its bounded captured batch participates in identity, so a
  // different permission/result/time cannot reuse an unrelated canonical observation artifact.
  const artifact = digest(["structural-artifact-1", pin.commitSha, pin.repositoryVisibility, pin.policyHash, profile, options, metadata,
    safeFiles.map(f => [f.locator, f.contentHash, f.contentHashKeyVersion])]);
  const snapshotId = uuid(digest([artifact.keyVersion, artifact.digest]).digest);
  const id = (kind: string, key: unknown) => uuid(digest([snapshotId, kind, key]).digest);
  const implementation = "implementation" in profile ? new ImplementationPass(profile, id) : undefined;
  const explanationLimits = implementation ? ["Coverage combines structural inventory with explicitly supported, uncalibrated TS/JS static patterns.", ...limitations.slice(1)] : limitations;
  const fileIds = new Map(safeFiles.map(file => [(file.locator as { path: string }).path, id("file", file.locator)]));
  const safeByPath = new Map(safeFiles.map(file => [(file.locator as {path:string}).path, file]));
  const available = new Set(fileIds.keys()); const projects = [...available].filter(isProjectManifest);
  const projectDirectories = new Map<string, string>();
  for (const project of projects) if (!projectDirectories.has(directory(project))) projectDirectories.set(directory(project), project);
  const evidence: InternalEvidenceObservation[] = []; const files: SnapshotBundle["files"] = []; let truncated = false;
  const coverage: StructuralCoverage = { sources: SOURCE_FAMILIES.map(source => ({ source, eligibleFiles: 0, analyzedFiles: 0,
    parseFailures: 0, unsupportedFiles: 0, limitedFiles: 0, noSignalFiles: 0 })), metadata: metadata.groups.map(g => g.coverage),
    evidenceTruncated: false, disabledExtractors: [...profile.disabled] };
  const emit = (family: string, locator: InternalLocator, sourceType: InternalEvidenceObservation["sourceType"], observation: string,
    detail: NonNullable<InternalEvidenceObservation["structural"]>, fingerprint: { digest: string; keyVersion: string }) => {
    if (evidence.length >= LIMIT.evidence) { truncated = true; return; }
    const naturalKey = [family, locator, detail.kind];
    evidence.push(InternalEvidenceObservationSchema.parse({ contractVersion: "1.0.0", evidenceId: id("evidence", naturalKey), snapshotId,
      repositoryId: pin.repositoryId, commitSha: pin.commitSha, repositoryVisibility: pin.repositoryVisibility, visibility: "owner_only", sourceType,
      detector: { id: `structural.${family.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}.${detail.kind}`, version: structuralDetectorVersion(family) },
      capabilityIds: [], observations: [observation], relevance: 0.5, confidence: detail.confidenceBasis === "filename_only" ? 0.2 : 0.5,
      strength: sourceType === "dependency" || detail.confidenceBasis === "filename_only" ? 0.2 : 0.3,
      contribution: { state: "unknown", reasons: ["insufficient_evidence"], signals: [], limitations: ["Contribution and authorship have not been assessed."] },
      createdAt, locatorId: id("locator", naturalKey), locator,
      fingerprint: { algorithm: "hmac-sha256", ...fingerprint }, structural: StructuralObservationSchema.parse(detail) }));
  };
  for (const safe of safeFiles) {
    checkSignal(signal); await setImmediate();
    // A wall-clock deadline fails the stage; it must never change the canonical
    // meaning of the same input by sealing a timing-dependent partial artifact.
    if (performance.now() - started > LIMIT.durationMs) throw new JobError("WORKER_EXPIRED");
    const path = (safe.locator as { path: string }).path; const classification = classify(path);
    const parser = "coverage" in profile ? baselineParser({ ...classification, path }) : undefined;
    const counter = coverage.sources.find(c => c.source === classification.family)!; counter.eligibleFiles++;
    let result: ExtractionResult; let sourceText = "";
    if (profile.disabled.includes(classification.family)) result = { state: "unsupported", findings: [] };
    else if ("coverage" in profile && parser && profile.coverage.disabledParsers.includes(parser)) result = { state: "unsupported", findings: [], reasons: ["parser_disabled"] };
    else if (safe.sizeBytes > LIMIT.fileBytes) result = { state: "limited", findings: [] };
    else {
      // Context errors are authorization/lifecycle failures, not parser limitations. Never swallow them.
      const text = await context.readText(safe.locatorId); checkSignal(signal);
      sourceText = text;
      try {
        boundedText(text); const fileInput = { ...classification, path, text };
        result = "coverage" in profile && baselineParser(fileInput) ? extractBaseline(fileInput, profile.coverage.disabledParsers)
          : EXTRACTORS[classification.family].extract(fileInput);
      } catch (error) {
        if (error instanceof JobError) throw error;
        result = { state: error instanceof ParseFailure ? error.state : "parse_failure", findings: [],
          ...(error instanceof BaselineFailure ? { reasons: [error.reason] } : {}) };
      }
    }
    const analyzed = result.state === "analyzed";
    if (implementation) {
      if (/(?:^|\/)(?:tsconfig|jsconfig)\.json$/.test(path)) implementation.config(path, sourceText);
      implementation.add({ path, text: sourceText, fileId: fileIds.get(path)!, classification: classification.classification }, result.state);
    }
    if (analyzed) { counter.analyzedFiles++; if (!result.findings.length) counter.noSignalFiles++; }
    else if (result.state === "parse_failure") counter.parseFailures++;
    else if (result.state === "limited") counter.limitedFiles++; else counter.unsupportedFiles++;
    const reasons: CoverageReason[] = [...result.reasons ?? []];
    if (result.state !== "analyzed") reasons.push(result.state === "limited" ? "parse_budget_exhausted" : result.state === "parse_failure" ? "parser_failure" : "unsupported_depth");
    if (["code", "test"].includes(classification.classification) && !["typescript", "javascript", "sql", "prisma"].includes(classification.language)) reasons.push("unsupported_depth");
    if (/\.(?:config\.[cm]?[jt]s)$/.test(path) || /(?:^|\/)(?:build\.gradle(?:\.kts)?|setup\.py)$/.test(path)) reasons.push("dynamic_configuration");
    files.push({ locatorId: fileIds.get(path)! as SnapshotBundle["files"][number]["locatorId"], locator: safe.locator, language: classification.language,
      sizeBytes: safe.sizeBytes, classification: classification.classification, eligible: true, analyzed,
      structure: { lines: safe.lines, depth: !analyzed || (result.findings.length > 0 && result.findings.every(f => f.detail.confidenceBasis === "filename_only")) ? "inventory" : "structural",
        generated: isLock(path) ? "lockfile" : "not_marked", dependency: "not_vendored", processing: result.state,
        ...("coverage" in profile ? { coverage: { source: classification.family, parser: baselineParser({ ...classification, path }) ?? `structural.${classification.family}`,
          reasons: [...new Set(reasons)].sort(), implementation: "not_applicable" } } : {}) } });
    for (const finding of result.findings) {
      if (result.associations) finding.detail.associatedFileIds = [...new Set(result.associations.map(relative => associate(relative, path, available))
        .filter((p): p is string => !!p && classify(p).classification === "code").map(p => fileIds.get(p)!))].sort().slice(0, 100) as NonNullable<typeof finding.detail.associatedFileIds>;
      emit(classification.family, safe.locator, finding.sourceType, finding.observation, finding.detail, { digest: safe.contentHash, keyVersion: safe.contentHashKeyVersion });
    }
  }
  for (const file of files) {
    const path = (file.locator as { path: string }).path;
    const project = nearestProject(path, projectDirectories);
    if (project) file.structure!.projectLocatorId = fileIds.get(project)! as typeof file.locatorId;
  }
  if (implementation) {
    for (const finding of implementation.finish()) {
      if (evidence.length >= LIMIT.evidence) { truncated = true; implementation.coverage.evidenceTruncated = true; continue; }
      const definition = DETECTORS.find(d => d.kind === finding.kind)!;
      const naturalKey = [definition.id, finding.file.fileId, finding.detail.span];
      const safe = safeByPath.get(finding.file.path)!;
      const mocked = finding.detail.testBoundary === "mocked_or_intercepted";
      evidence.push(InternalEvidenceObservationSchema.parse({ contractVersion: "1.0.0", evidenceId: id("evidence", naturalKey), snapshotId,
        repositoryId: pin.repositoryId, commitSha: pin.commitSha, repositoryVisibility: pin.repositoryVisibility, visibility: "owner_only",
        sourceType: finding.kind === "asserted_call" ? "test" : "code", detector: { id: definition.id, version: definition.version },
        capabilityIds: definition.capabilityIds, observations: [definition.observation], relevance: 0.7,
        confidence: mocked ? 0.4 : definition.confidence, strength: mocked ? 0.35 : definition.strength,
        contribution: { state: "unknown", reasons: ["insufficient_evidence"], signals: [], limitations: ["Contribution and authorship have not been assessed."] },
        createdAt, locatorId: id("locator", naturalKey), locator: { kind: "file", path: finding.file.path, lines: finding.detail.span.lines },
        fingerprint: { algorithm: "hmac-sha256", keyVersion: safe.contentHashKeyVersion, digest: safe.contentHash }, implementation: finding.detail }));
      implementation.coverage.detectors.find(d => d.kind === finding.kind)!.observations++;
    }
  }
  if ("coverage" in profile) for (const file of files) {
    const outcome = file.structure!.coverage!; outcome.implementation = implementation!.outcomes.get((file.locator as {path:string}).path) ?? "not_applicable";
    const extra: Partial<Record<typeof outcome.implementation, CoverageReason>> = { limited: "parse_budget_exhausted", parse_failure: "parser_failure", unsupported: "unsupported_depth", generated: "generated_source" };
    const reason = extra[outcome.implementation]; if (reason) outcome.reasons = [...new Set([...outcome.reasons, reason])].sort();
  }
  for (const group of metadata.groups) for (const record of group.records) {
    emit(`provider.${group.coverage.source}`, { kind: "provider_metadata", providerObjectId: record.objectId, commitRelationship: record.detail.provider!.relationship },
      group.coverage.source === "commits" ? "commit" : group.coverage.source === "pullRequests" ? "pull_request" : "ci",
      `Authorized provider metadata records ${record.detail.kind} context.`, record.detail, digest(record));
  }
  coverage.evidenceTruncated = truncated;
  const counts = new Map<string, { eligible: number; analyzed: number }>();
  for (const file of files) { const count = counts.get(file.language) ?? { eligible: 0, analyzed: 0 }; count.eligible++; if (file.analyzed) count.analyzed++; counts.set(file.language, count); }
  const frameworks = new Map<string, { name: string; basis: "dependency" | "configuration" }>();
  for (const item of evidence.filter(e => e.sourceType === "dependency" || e.structural?.kind === "configuration")) for (const name of item.structural!.technologies) {
    const basis = item.sourceType === "dependency" ? "dependency" : "configuration"; frameworks.set(`${basis}:${name}`, { name, basis });
  }
  const analyzedFiles = files.filter(f => f.analyzed).length;
  const raw = { artifactKey: artifact.digest, snapshot: { contractVersion: "1.0.0", snapshotId, repositoryId: pin.repositoryId,
    provider: "github", providerRepositoryId: pin.providerRepositoryId, branch: pin.branch, commitSha: pin.commitSha,
    repositoryVisibility: pin.repositoryVisibility, snapshotIdentityVersion: versions.snapshotIdentity, extractionPolicyVersion: profile.extractorBundle.version,
    securityPolicyHash: pin.policyHash, createdAt }, versions, files, evidence,
    inventorySummary: { contractVersion: "1.0.0", snapshotId, extractorBundle: profile.extractorBundle, totalFiles: context.summary.totalFiles,
      eligibleFiles: files.length, excludedFiles: context.summary.totalFiles - files.length, analyzedFiles,
      languages: [...counts].map(([language, count]) => ({ language, files: count.eligible })), frameworks: [...frameworks.values()],
      testFiles: files.filter(f => f.classification === "test").length, configFiles: files.filter(f => f.classification === "config").length,
      documentationFiles: files.filter(f => f.classification === "docs").length, ciFiles: files.filter(f => f.classification === "ci").length,
      metadata: options, limitations: explanationLimits, structural: { exclusions: context.summary.excluded, languageDenominator: "eligible_files_only", textBytes: context.summary.textBytes,
        lines: context.summary.totalLines, projectManifests: projects.length, nestedProjects: projects.filter(p => directory(p) && nearestProject(directory(p).slice(0, -1), projectDirectories)).length,
        dependencyManifests: files.filter(f => classify((f.locator as { path: string }).path).family === "manifests" && !isLock((f.locator as { path: string }).path)).length,
        lockfiles: files.filter(f => isLock((f.locator as { path: string }).path)).length } },
    coverage: { contractVersion: "1.0.0", snapshotId, manifestVersion: versions.coverageManifest, detectorBundle: versions.detectorBundle, structural: coverage,
      ...(implementation ? { implementation: implementation.coverage } : {}),
      languages: counts.size ? [...counts].map(([language, count]) => ({ state: "assessed", language,
        depth: files.some(f => f.language === language && f.structure!.depth === "structural") ? "structural" : "inventory", eligibleFiles: count.eligible,
        analyzedFiles: count.analyzed, coverage: count.analyzed / count.eligible, limitations: [implementation ? "These file counts describe structural processing; the implementation manifest separately records bounded TS/JS pattern assessability." : "Structural coverage only; semantic implementation detectors are unavailable.",
          ...(count.analyzed < count.eligible ? ["Some eligible files were unsupported, failed parsing or exceeded a processing budget."] : [])] }))
        : [{ state: "unknown", language: "unknown", reasons: ["no_eligible_files"], limitations }],
      limitations: [...explanationLimits, ...(truncated ? ["Evidence was truncated at the versioned observation budget."] : [])] } };
  // Derive the public outcome exclusively from the same file, evidence and metadata facts that are persisted.
  if ("coverage" in profile) Object.assign(raw.coverage, { assessment: achievedCoverage(raw as SnapshotBundle, profile) });
  const bundle = SnapshotBundleSchema.parse(raw);
  checkSignal(signal); await context.files(); // Fresh access check before returning any persistence-ready result.
  return { bundle, metrics: { files: files.length, analyzed: analyzedFiles, parseFailures: coverage.sources.reduce((n, c) => n + c.parseFailures, 0),
    limited: coverage.sources.reduce((n, c) => n + c.limitedFiles, 0), evidence: evidence.length, truncated, durationMs: Math.round(performance.now() - started) } };
}

export function createStructuralExtraction(crypto: LocatorCrypto, metadata?: AuthorizedMetadataSource, disabled: readonly Family[] = [], recordMetrics?: (metrics: ExtractionMetrics) => void) {
  const profile = extractionProfile(disabled);
  const extract: AnalysisHandlers["extract"] = async (context, claim, signal, pin) => {
    const checkpoint = async () => { checkSignal(signal); await context.files(); };
    const batch = metadata ? await metadata.collect(claim.actor, pin, claim.request.includeMetadata, signal, checkpoint) : undefined;
    const result = await extractSnapshot(context, { pin, versions: claim.policy.versions, options: claim.request.includeMetadata, metadata: batch, crypto, signal, profile });
    recordMetrics?.(result.metrics);
    return result.bundle;
  };
  return Object.freeze({ profile, extract });
}

export function createImplementationExtraction(crypto: LocatorCrypto, metadata?: AuthorizedMetadataSource, disabled: readonly ImplementationKind[] = [], recordMetrics?: (metrics: ExtractionMetrics) => void) {
  const profile = implementationProfile(disabled);
  const extract: AnalysisHandlers["extract"] = async (context, claim, signal, pin) => {
    const checkpoint = async () => { checkSignal(signal); await context.files(); };
    const batch = metadata ? await metadata.collect(claim.actor, pin, claim.request.includeMetadata, signal, checkpoint) : undefined;
    const result = await extractSnapshot(context, { pin, versions: claim.policy.versions, options: claim.request.includeMetadata, metadata: batch, crypto, signal, profile });
    recordMetrics?.(result.metrics); return result.bundle;
  };
  return Object.freeze({ profile, extract });
}

export function createCoverageExtraction(crypto: LocatorCrypto, metadata?: Pick<AuthorizedMetadataSource, "collect">, disabled: readonly BaselineParser[] = [], recordMetrics?: (metrics: ExtractionMetrics) => void) {
  const profile = coverageProfile(disabled);
  const extract: AnalysisHandlers["extract"] = async (context, claim, signal, pin) => {
    const checkpoint = async () => { checkSignal(signal); await context.files(); };
    const batch = metadata ? await metadata.collect(claim.actor, pin, claim.request.includeMetadata, signal, checkpoint) : undefined;
    const result = await extractSnapshot(context, { pin, versions: claim.policy.versions, options: claim.request.includeMetadata, metadata: batch, crypto, signal, profile });
    recordMetrics?.(result.metrics); return result.bundle;
  };
  return Object.freeze({ profile, extract });
}
