import * as ts from "typescript";
import { type IndexedFile, unwrap, rootIdentifier } from "./project";
import type { RawFinding } from "./rules";
import { bodyOf, directCall, awaited, objectProperty } from "./syntax";

function importedValue(file: IndexedFile, value: ts.Expression): RawFinding["target"] {
  if (!ts.isPropertyAccessExpression(value)) return undefined;
  const root = rootIdentifier(value), binding = root && file.binding(root);
  if (!binding || binding.written || !binding.imported || binding.imported.typeOnly) return undefined;
  const path = file.project.resolve(file.input.path, binding.imported.source), target = path && file.project.files.get(path);
  const exported = target && target.exports.get(binding.imported.name);
  return target && target.input.classification === "code" && exported && !exported.mutable && !exported.written && exported.initializer
    && target.flow.reachable(exported.initializer) ? { file: target, node: unwrap(exported.initializer) } : undefined;
}
export function roleTests(file: IndexedFile, emit: (f: RawFinding) => void) {
  const mocked = file.calls.some(c => {
    const origin = file.origin(c.expression);
    return origin && ["vitest", "@jest/globals"].includes(origin.module) && /(?:^|\.)(?:mock|doMock|spyOn|fn|stubGlobal|unstable_mockModule)$/.test(origin.member)
      || ts.isPropertyAccessExpression(c.expression) && ["mock", "doMock", "spyOn", "listen", "intercept", "route"].includes(c.expression.name.text);
  });
  for (const call of file.calls) {
    const origin = file.origin(call.expression);
    if (!origin || !["vitest", "@jest/globals"].includes(origin.module) || !["test", "it"].includes(origin.member)
      || call.arguments.length !== 2 || !ts.isStringLiteral(call.arguments[0]) || !file.flow.reachable(call)) continue;
    const callback = file.localFunction(call.arguments[1]), body = callback && bodyOf(callback.node);
    if (!callback || callback.file !== file || !body) continue;
    let parent = file.parents.get(call), skipped = false;
    while (parent) {
      if (ts.isCallExpression(parent)) { const outer = file.origin(parent.expression); if (!outer || outer.module !== origin.module || !["describe", "suite"].includes(outer.member)) skipped = true; }
      if (ts.isIfStatement(parent) || ts.isConditionalExpression(parent) || ts.isIterationStatement(parent, false)) skipped = true;
      parent = file.parents.get(parent);
    }
    if (skipped) continue;
    for (const statement of file.flow.statements(body)) {
      if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) break;
      const assertion = directCall(statement);
      if (!assertion || !ts.isPropertyAccessExpression(assertion.expression)) continue;
      let expected = assertion.expression.expression;
      const rejection = ts.isPropertyAccessExpression(expected) && expected.name.text === "rejects";
      if (rejection && ts.isPropertyAccessExpression(expected)) expected = expected.expression;
      if (!ts.isCallExpression(expected) || expected.arguments.length !== 1) continue;
      const eo = file.origin(expected.expression); if (eo?.module !== origin.module || eo.member !== "expect") continue;
      const value = file.resolveValue(expected.arguments[0]), matcher = assertion.expression.name.text;
      if (["toThrow", "toThrowError"].includes(matcher) && assertion.arguments.length === 1 && ts.isStringLiteral(assertion.arguments[0]) && assertion.arguments[0].text) {
        let work: ts.CallExpression | undefined;
        if (rejection && awaited(file, assertion) && ts.isCallExpression(value)) work = value;
        else if (!rejection && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
          && !ts.getModifiers(value)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) {
          const b = bodyOf(value), expr = b ? b.statements.length === 1 && directCall(b.statements[0]) : unwrap(value.body as ts.Expression);
          if (expr && ts.isCallExpression(expr)) work = expr;
        }
        const target = work && file.localFunction(work.expression);
        if (work && target && target.file !== file && target.file.input.classification === "code"
          && file.contains(body, work) && (rejection || !ts.getModifiers(target.node)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)))
          emit({ kind: "asserted_failure", node: assertion, concept: callback.node, target, mocked });
        continue;
      }
      if (rejection) continue;
      if (["toBe", "toEqual", "toStrictEqual", "toHaveLength", "toMatchObject"].includes(matcher) && assertion.arguments.length === 1) {
        const target = importedValue(file, value);
        if (target) emit({ kind: "asserted_value", node: assertion, concept: callback.node, target, mocked });
      }
      if (!["toBeTruthy", "toBeDefined", "toBeVisible", "toBeInTheDocument"].includes(matcher) || assertion.arguments.length || !ts.isCallExpression(value)
        || !file.contains(body, value) || file.enclosing(value) !== callback.node || !ts.isPropertyAccessExpression(value.expression)
        || !["getByRole", "findByRole"].includes(value.expression.name.text) || value.arguments.length !== 2 || !ts.isStringLiteral(value.arguments[0])
        || !ts.isObjectLiteralExpression(value.arguments[1])) continue;
      const name = objectProperty(value.arguments[1], "name"); if (!name || !ts.isStringLiteral(name) || !name.text.trim()) continue;
      if (value.expression.name.text === "findByRole" && !awaited(file, value)) continue;
      const render = file.resolveValue(value.expression.expression);
      if (!ts.isCallExpression(render) || !file.contains(body, render) || file.enclosing(render) !== callback.node || render.end > assertion.end
        || render.arguments.length !== 1) continue;
      const ro = file.origin(render.expression);
      if (!ro || !["@testing-library/react", "@testing-library/react-native"].includes(ro.module) || ro.member !== "render") continue;
      const jsx = render.arguments[0], opening = ts.isJsxElement(jsx) ? jsx.openingElement : ts.isJsxSelfClosingElement(jsx) ? jsx : undefined;
      if (!opening || !ts.isIdentifier(opening.tagName) || opening.attributes.properties.some(ts.isJsxSpreadAttribute)) continue;
      const target = file.localFunction(opening.tagName);
      if (target && target.file !== file && target.file.input.classification === "code") emit({ kind: "asserted_ui", node: assertion, concept: callback.node, target, mocked });
    }
  }
}
