import { BASELINE_PARSERS, CoverageDeclarationSchema, type BaselineParser, type CoverageDeclaration, type ImplementationKind } from "@repofy/contracts";
import { DETECTORS, implementationProfile } from "../detectors/registry";

const selection = Object.freeze({ id: "all_safe_files_bounded_patterns_v1", order: "path_lexical", reducedScanOffered: false,
  ingestionLimitBehavior: "fail_entire_snapshot", maxFileBytes: 262144, maxParserNodes: 20000, maxParserDepth: 64,
  maxImplementationFiles: 256, maxImplementationBytes: 2097152, maxObservations: 2000 } as const);
const common = ["runtime_not_assessed", "uncalibrated"] as const;
type Entry = CoverageDeclaration["entries"][number];
function entry(id: string, languages: string[], fileTypes: string[], extractors: string[], capabilities: string[], depth: Entry["depth"], reasons: Entry["reasons"] = []): Entry {
  return { id, languages, fileTypes, extractors, capabilities, depth, confidenceCeiling: depth === "bounded_patterns" ? 0.55 : depth === "unsupported" ? 0 : 0.5,
    reasons: [...common, ...reasons] };
}
const caps = [...new Set(DETECTORS.flatMap(d => d.capabilityIds))].sort();
const entries: Entry[] = [
  entry("tsjs", ["typescript", "javascript"], ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"], ["source", "tests", "tsjs_implementation"], caps, "bounded_patterns", ["unsupported_version"]),
  entry("react", ["typescript", "javascript"], ["jsx", "tsx"], ["tsjs_implementation"], ["frontend_interaction", "frontend_accessibility", "security_input_handling"], "bounded_patterns", ["unsupported_version"]),
  entry("express_node", ["typescript", "javascript"], ["ts", "js"], ["tsjs_implementation"], ["api_design", "api_boundary_validation", "security_authorization", "architecture_modularity"], "bounded_patterns", ["unsupported_version"]),
  entry("next", ["typescript", "javascript"], ["next.config", "jsx", "tsx"], ["configuration", "tsjs_implementation"], ["framework_presence", "frontend_interaction"], "baseline", ["dynamic_configuration", "unsupported_depth", "unsupported_version"]),
  entry("node_manifests", ["json", "yaml"], ["package.json", "package-lock.v2.v3", "pnpm-lock.v6.v9"], ["manifests"], ["framework_presence"], "baseline", ["unsupported_version"]),
  entry("static_configuration", ["json", "yaml", "toml", "typescript", "javascript"], ["json", "yaml", "yml", "toml", "config.ts", "config.js"], ["configuration"], ["framework_presence"], "baseline", ["dynamic_configuration"]),
  entry("database", ["sql", "prisma", "typescript", "javascript"], ["sql", "prisma", "ts", "js"], ["schemas", "tsjs_implementation"], ["data_modeling", "data_transactions", "security_input_handling"], "baseline", ["unsupported_depth", "unsupported_version"]),
  entry("selected_tests", ["typescript", "javascript"], ["vitest", "jest_globals", "playwright", "cypress", "mocha"], ["tests", "tsjs_implementation"], ["testing_behavior"], "bounded_patterns", ["unsupported_depth", "unsupported_version"]),
  entry("documentation", ["markdown", "text"], ["md", "readme"], ["documentation"], ["documentation_operability", "documentation_decisions"], "baseline"),
  entry("containers", ["dockerfile"], ["dockerfile"], ["configuration"], ["delivery_reproducibility"], "baseline", ["dynamic_configuration"]),
  entry("github_actions", ["yaml"], ["github_workflows"], ["ci"], ["delivery_automation"], "baseline", ["dynamic_configuration"]),
  entry("python", ["python"], ["py"], ["python", "tests"], ["language_presence"], "baseline", ["unsupported_depth"]),
  entry("python_manifests", ["toml", "text"], ["pyproject.pep621", "pyproject.pep735", "requirements.txt"], ["manifests"], ["framework_presence"], "baseline", ["dynamic_configuration"]),
  entry("java", ["java"], ["java", "module-info.java"], ["java", "tests"], ["language_presence"], "baseline", ["unsupported_depth"]),
  entry("maven", ["xml"], ["pom.xml.model4"], ["maven"], ["framework_presence"], "baseline", ["dynamic_configuration"]),
  entry("build_scripts", ["python", "kotlin", "unknown"], ["setup.py", "build.gradle", "build.gradle.kts"], ["source"], [], "inventory", ["dynamic_configuration", "unsupported_depth"]),
  entry("provider_metadata", [], ["commits", "pull_requests", "checks", "statuses", "actions"], ["provider_metadata"], ["provenance_history"], "baseline", ["history_bounded"]),
  entry("native_mobile", ["swift", "kotlin", "java"], ["swift", "kt", "java"], [], [], "unsupported", ["native_mobile_not_assessed"]),
  entry("ai_runtime", [], [], [], [], "unsupported", ["ai_runtime_not_assessed"]),
  entry("other_ecosystems", [], [], [], [], "inventory", ["unsupported_depth"]),
];
export function coverageProfile(disabledParsers: readonly BaselineParser[] = [], disabledDetectors: readonly ImplementationKind[] = []) {
  if (new Set(disabledParsers).size !== disabledParsers.length || disabledParsers.some(p => !BASELINE_PARSERS.includes(p))) throw new Error("Invalid parser quarantine");
  const disabled = Object.freeze(BASELINE_PARSERS.filter(p => disabledParsers.includes(p)));
  const suffix = disabled.length ? `-p${BASELINE_PARSERS.map(p => disabled.includes(p) ? 1 : 0).join("")}` : "";
  return Object.freeze({ ...implementationProfile(disabledDetectors), extractorBundle: { id: "language_inventory", version: `1.0.0${suffix}` },
    coverageManifest: `1.2.0${suffix}`, coverage: Object.freeze({ disabledParsers: disabled, selection }) });
}
export function coverageDeclaration(disabled: readonly BaselineParser[] = []): CoverageDeclaration {
  const profile = coverageProfile(disabled);
  return CoverageDeclarationSchema.parse({ version: profile.coverageManifest, selection, disabledParsers: profile.coverage.disabledParsers,
    parsers: [{ id: "python", package: "lezer_python", version: "1.1.19" }, { id: "java", package: "lezer_java", version: "1.1.4" }, { id: "maven", package: "lezer_xml", version: "1.0.6" }],
    entries: entries.map(e => disabled.includes(e.id as BaselineParser) ? { ...e, depth: "unsupported", confidenceCeiling: 0, reasons: [...e.reasons, "parser_disabled"] } : e) });
}
