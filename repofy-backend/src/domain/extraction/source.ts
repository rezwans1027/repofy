import * as ts from "typescript";
import { sourceFile, walk } from "./parsers";
import { detail, extractor, ParseFailure } from "./policy";
import { technology } from "./manifests";
import type { StructuralObservation } from "@repofy/contracts";

function syntax(path: string, text: string, tests: boolean) {
  const file = sourceFile(text, path); const counts = { imports: 0, exports: 0, suites: 0, tests: 0, assertions: 0, skipped: 0 };
  const technologies: StructuralObservation["technologies"] = []; const associations: string[] = [];
  walk(file, node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      counts.imports++; const name = node.moduleSpecifier.text; const tech = technology(name); if (tech) technologies.push(tech);
      if (tests && name.startsWith(".")) associations.push(name);
    }
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node) || (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) counts.exports++;
    if (!tests || !ts.isCallExpression(node)) return;
    let call: ts.Expression = ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === "each" ? node.expression.expression : node.expression;
    const parts: string[] = [];
    while (ts.isPropertyAccessExpression(call)) { parts.unshift(call.name.text); call = call.expression; }
    if (!ts.isIdentifier(call)) return; parts.unshift(call.text);
    const title = node.arguments[0]; const titled = !!title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title));
    const modifiers = new Set(["only", "skip", "todo", "each", "concurrent", "fails", "serial", "parallel"]);
    const suite = ["describe", "suite"].includes(parts[0]) || (parts[0] === "test" && parts[1] === "describe");
    const suffix = parts.slice(parts[0] === "test" && parts[1] === "describe" ? 2 : 1);
    if (titled && suffix.every(part => modifiers.has(part))) {
      if (suite) counts.suites++;
      else if (["it", "test"].includes(parts[0])) { counts.tests++; if (parts.includes("skip") || parts.includes("todo")) counts.skipped++; }
    }
    if ((parts.length === 1 && parts[0] === "expect" && node.arguments.length > 0)
      || (parts[0] === "assert" && (parts.length === 1 || ["equal", "strictEqual", "deepEqual", "deepStrictEqual", "ok", "throws", "rejects", "match", "notEqual"].includes(parts[1])))) counts.assertions++;
  });
  return { counts, technologies, associations };
}
export const tests = extractor("tests", ["JavaScript", "TypeScript", "Python/Java filename inventory"], input => {
  if (!["typescript", "javascript"].includes(input.language)) return { state: "analyzed", findings: [{ sourceType: "test",
    observation: "A filename or directory identifies a candidate test file.", detail: detail("test_candidates", "filename_only", "test_candidates_only", {}, [],
      ["Test syntax and implementation associations are unsupported for this language; filename discovery alone does not establish test behavior."]) }] };
  const result = syntax(input.path, input.text, true);
  return { state: "analyzed", associations: result.associations, findings: [{ sourceType: "test", observation: "Static syntax contains candidate test declarations and assertion calls.",
    detail: detail("test_candidates", "static_syntax", "test_candidates_only", result.counts, result.technologies,
      ["Call names can be shadowed or aliased. Counts are candidates, not meaningful-test verification. Imports are associations, not coverage. No tests were run."]) }] };
});
export const source = extractor("source", ["TypeScript", "JavaScript"], input => {
  if (!["typescript", "javascript"].includes(input.language)) throw new ParseFailure("unsupported");
  const result = syntax(input.path, input.text, false);
  return { state: "analyzed", findings: [{ sourceType: "code", observation: "A source file has statically parsed module structure.",
    detail: detail("structure", "static_syntax", "source_structure_only", { imports: result.counts.imports, exports: result.counts.exports }, [],
      ["Module syntax does not establish architectural quality or implemented behavior. Implementation detectors are not part of this extractor."]) }] };
});
