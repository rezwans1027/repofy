import type { Parser, SyntaxNode, Tree } from "@lezer/common";
import type { BaselineParser, CoverageReason, StructuralObservation } from "@repofy/contracts";
import { JobError } from "../jobs/policy";
import { boundedText } from "./parsers";
import { detail, EXTRACTION_LIMITS as LIMIT, ParseFailure, type ExtractionResult, type FileInput } from "./policy";

export class BaselineFailure extends ParseFailure {
  constructor(state: "limited" | "unsupported" | "parse_failure", readonly reason: CoverageReason) { super(state); }
}
// Only fixed application dependencies can be loaded. No repository-controlled module names.
function parserFor(id: BaselineParser): Parser {
  try {
    if (id === "python") return (require("@lezer/python") as typeof import("@lezer/python")).parser;
    if (id === "java") return (require("@lezer/java") as typeof import("@lezer/java")).parser;
    return (require("@lezer/xml") as typeof import("@lezer/xml")).parser;
  } catch { throw new BaselineFailure("unsupported", "parser_unavailable"); }
}
export function baselineTree(text: string, id: BaselineParser): { tree: Tree; nodes: SyntaxNode[] } {
  boundedText(text);
  const start = performance.now(); const partial = parserFor(id).startParse(text); let tree: Tree | null;
  do {
    tree = partial.advance();
    // Timing failure retries the stage instead of freezing timing-dependent partial coverage.
    if (performance.now() - start > 1000) throw new JobError("WORKER_EXPIRED");
  } while (!tree);
  const cursor = tree.cursor(); const nodes: SyntaxNode[] = []; let depth = 0;
  for (;;) {
    if (cursor.type.isError || ["MissingCloseTag", "MismatchedCloseTag"].includes(cursor.name)) throw new ParseFailure();
    if (nodes.length >= LIMIT.nodes || depth > LIMIT.depth) throw new ParseFailure("limited");
    nodes.push(cursor.node);
    if (cursor.firstChild()) { depth++; continue; }
    while (!cursor.nextSibling()) { if (!cursor.parent()) return { tree, nodes }; depth--; }
  }
}
export const baselineParser = (input: Pick<FileInput, "path" | "language" | "classification">): BaselineParser | undefined =>
  /(?:^|\/)pom\.xml$/.test(input.path) ? "maven"
    : ["code", "test"].includes(input.classification) && ["python", "java"].includes(input.language) ? input.language as BaselineParser : undefined;

function source(input: FileInput, id: "python" | "java"): ExtractionResult {
  const { nodes } = baselineTree(input.text, id);
  const counts = { modules: 0, imports: 0, functions: 0, classes: 0, methods: 0, interfaces: 0, annotations: 0 };
  const tests = { tests: 0, assertions: 0, suites: 0 };
  const value = (node: SyntaxNode | null) => node ? input.text.slice(node.from, node.to) : "";
  for (const node of nodes) {
    if (["ImportStatement", "ImportDeclaration"].includes(node.name)) counts.imports++;
    if (["ClassDefinition", "ClassDeclaration", "EnumDeclaration", "RecordDeclaration"].includes(node.name)) counts.classes++;
    if (node.name === "InterfaceDeclaration") counts.interfaces++;
    if (node.name === "ModuleDeclaration") counts.modules++;
    if (["Annotation", "MarkerAnnotation", "Decorator"].includes(node.name)) counts.annotations++;
    if (node.name === "FunctionDefinition") {
      counts.functions++;
      if (/^test_/.test(value(node.getChild("VariableName")))) tests.tests++;
    }
    if (node.name === "MethodDeclaration") {
      counts.methods++;
      const annotations = node.getChild("Modifiers")?.getChildren("MarkerAnnotation") ?? [];
      if (annotations.some(a => /^(?:org\.junit\.(?:jupiter\.api\.)?)?Test$/.test(value(a).replace(/^@/, "")))) tests.tests++;
    }
    if (node.name === "AssertStatement") tests.assertions++;
    if (node.name === "ClassDefinition" && /^Test/.test(value(node.getChild("VariableName")))) tests.suites++;
  }
  // A module/source unit means parsed declarations, not an importable or compilable project.
  if (id === "python" && nodes.some(n => /Statement$|Definition$/.test(n.name))) counts.modules = 1;
  const limits = ["Baseline grammar structure only; names, imports and annotations are not resolved or executed. Compiler/interpreter compatibility is not verified.",
    "Test names and annotations are candidates, not behavior verification or passing results. No implementation capability is inferred."];
  const findings: ExtractionResult["findings"] = [];
  if (Object.values(counts).some(Boolean)) findings.push({ sourceType: "code", observation: "Parsed source contains module, import and declaration structure.",
    detail: detail("structure", "static_syntax", "source_structure_only", counts, [], limits) });
  if (input.classification === "test" || tests.tests > 0) findings.push({ sourceType: "test", observation: "Parsed syntax contains candidate test structure.",
    detail: detail("test_candidates", "static_syntax", "test_candidates_only", tests, [], limits) });
  return { state: "analyzed", findings };
}

function maven(input: FileInput): ExtractionResult {
  // XML grammar has no resolver. Still reject DTDs, entities and CDATA instead of interpreting them.
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(input.text)) throw new BaselineFailure("unsupported", "dynamic_configuration");
  const { tree, nodes } = baselineTree(input.text, "maven");
  if (nodes.some(n => ["EntityReference", "CharacterReference", "Cdata", "DoctypeDecl"].includes(n.name))) throw new ParseFailure("unsupported");
  const text = (node: SyntaxNode | null) => node ? input.text.slice(node.from, node.to).trim() : "";
  for (const tag of nodes.filter(n => ["OpenTag", "SelfClosingTag"].includes(n.name))) {
    const attributes = tag.getChildren("Attribute");
    const names = attributes.map(a => text(a.getChild("AttributeName")));
    if (new Set(names).size !== names.length) throw new ParseFailure();
    for (const a of attributes) if (text(a.getChild("AttributeName")) === "xmlns"
      && text(a.getChild("AttributeValue")).slice(1, -1) !== "http://maven.apache.org/POM/4.0.0") throw new BaselineFailure("unsupported", "unsupported_version");
  }
  const name = (node: SyntaxNode) => text((node.getChild("OpenTag") ?? node.getChild("SelfClosingTag"))?.getChild("TagName") ?? null);
  const children = (node: SyntaxNode, tag: string) => node.getChildren("Element").filter(n => name(n) === tag);
  const one = (node: SyntaxNode, tag: string) => {
    const matches = children(node, tag); if (matches.length > 1) throw new ParseFailure(); return matches[0];
  };
  const leaf = (node: SyntaxNode, tag: string): string => {
    const element = one(node, tag); if (!element) return "";
    if (element.getChildren("Element").length) throw new ParseFailure();
    return element.getChildren("Text").map(text).join("").trim();
  };
  const roots = tree.topNode.getChildren("Element");
  if (roots.length !== 1 || name(roots[0]) !== "project" || tree.topNode.getChildren("Text").some(n => text(n))) throw new ParseFailure();
  const root = roots[0]; if (leaf(root, "modelVersion") !== "4.0.0") throw new BaselineFailure("unsupported", "unsupported_version");
  const counts = { production: 0, development: 0, optional: 0, unknown: 0, packages: 0, modules: 0 };
  const technologies: StructuralObservation["technologies"] = []; let dynamic = false;
  const dependencies = one(root, "dependencies");
  for (const dep of dependencies ? children(dependencies, "dependency") : []) {
    const group = leaf(dep, "groupId"), artifact = leaf(dep, "artifactId"), version = leaf(dep, "version"), scope = leaf(dep, "scope");
    if (!group || !artifact) throw new ParseFailure();
    counts.packages++;
    if ([group, artifact, version, scope].some(v => /\$\{/.test(v))) { counts.unknown++; dynamic = true; continue; }
    if (scope === "test") counts.development++;
    else if (!scope || ["compile", "runtime", "provided"].includes(scope)) counts.production++;
    else counts.unknown++;
    if (leaf(dep, "optional") === "true") counts.optional++;
    if (group === "junit" || group === "org.junit.jupiter") technologies.push("junit");
    if (/^org\.springframework(?:\.|$)/.test(group)) technologies.push("spring");
  }
  const modules = one(root, "modules"); counts.modules = modules ? children(modules, "module").length : 0;
  if (["parent", "profiles", "dependencyManagement", "build", "properties"].some(tag => children(root, tag).length)) dynamic = true;
  return { state: "analyzed", project: true, reasons: dynamic ? ["dynamic_configuration"] : [], findings: [{ sourceType: "dependency",
    observation: "A Maven project declares direct dependencies and module entries.",
    detail: detail("dependency", "parsed_declaration", "dependency_presence", counts, technologies,
      ["Only direct literal Maven 4.0.0 declarations are counted. Parent inheritance, profiles, properties, dependency management, transitive dependencies and plugins are not resolved. No Maven or Gradle build ran."]) }] };
}
export function extractBaseline(input: FileInput, disabled: readonly BaselineParser[]): ExtractionResult {
  const id = baselineParser(input); if (!id) throw new ParseFailure("unsupported");
  if (disabled.includes(id)) throw new BaselineFailure("unsupported", "parser_disabled");
  return id === "maven" ? maven(input) : source(input, id);
}
