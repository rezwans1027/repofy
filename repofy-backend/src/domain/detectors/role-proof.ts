import * as ts from "typescript";
import { booleanLiteral } from "./control-flow";
import { type Binding, type IndexedFile, unwrap } from "./project";
import { DETECTOR_LIMITS } from "./registry";

function staticBoolean(file: IndexedFile, expression: ts.Expression, depth = 0): boolean | undefined {
  if (depth >= DETECTOR_LIMITS.resolutionDepth) return undefined;
  const value = file.resolveValue(expression), boolean = booleanLiteral(value);
  if (boolean !== undefined) return boolean;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text.length > 0;
  if (ts.isNumericLiteral(value)) return Number(value.text) !== 0;
  if (value.kind === ts.SyntaxKind.NullKeyword || ts.isIdentifier(value) && value.text === "undefined" && !file.hasBinding(value)) return false;
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = staticBoolean(file, value.operand, depth + 1); return operand === undefined ? undefined : !operand;
  }
  return undefined;
}

/** A child must actually be rendered, on the same conditional path as its peers. */
export function renderPath(file: IndexedFile, root: ts.Node, node: ts.Node): string | undefined {
  if (!file.flow.reachable(node)) return undefined;
  const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
  if (opening?.attributes.properties.some(p => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === "form")) return undefined;
  const conditions: string[] = [];
  while (node !== root) {
    file.project.tick();
    const parent = file.parents.get(node);
    if (!parent) return undefined;
    if (ts.isJsxElement(parent)) {
      const opening = parent.openingElement;
      if (!parent.children.includes(node as ts.JsxChild) || !ts.isIdentifier(opening.tagName)
        || !/^[a-z]/.test(opening.tagName.text) || parent !== root && opening.tagName.text === "form"
        || ["template", "script", "style", "noscript", "textarea"].includes(opening.tagName.text)
        || opening.attributes.properties.some(p => ts.isJsxSpreadAttribute(p) || ts.isJsxAttribute(p)
          && ts.isIdentifier(p.name) && ["hidden", "aria-hidden", "inert", "disabled"].includes(p.name.text))) return undefined;
    } else if (ts.isJsxFragment(parent)) {
      if (!parent.children.includes(node as ts.JsxChild)) return undefined;
    } else if (ts.isJsxExpression(parent) || ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)
      || ts.isTypeAssertionExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent)) {
      if (parent.expression !== node) return undefined;
    } else if (ts.isConditionalExpression(parent)) {
      if (node !== parent.whenTrue && node !== parent.whenFalse) return undefined;
      const condition = staticBoolean(file, parent.condition);
      if (condition === undefined) conditions.push(`${parent.pos}:${node === parent.whenTrue ? "then" : "else"}`);
      else if ((node === parent.whenTrue) !== condition) return undefined;
    } else if (ts.isBinaryExpression(parent) && node === parent.right
      && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(parent.operatorToken.kind)) {
      const condition = staticBoolean(file, parent.left);
      if (condition === undefined) conditions.push(`${parent.pos}:right`);
      else if (condition !== (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) return undefined;
    } else return undefined; // callbacks, props, component children and arbitrary expressions are not proven rendering.
    node = parent;
  }
  return conditions.join("/");
}

/** Local literal arrays may only be aliased by const bindings or read via includes.
 * Any mutation, export or escape makes their contents/method identity unknown. */
export function immutableAllowlist(file: IndexedFile, expression: ts.Expression): boolean {
  const seen = new Set<Binding>();
  function safe(binding: Binding, depth: number): boolean {
    file.project.tick();
    if (depth >= DETECTOR_LIMITS.resolutionDepth || binding.mutable || binding.written || binding.imported
      || !ts.isVariableDeclaration(binding.node) || !binding.initializer
      || [...file.exports.values()].includes(binding)) return false;
    if (seen.has(binding)) return true;
    seen.add(binding);
    const value = unwrap(binding.initializer);
    if (ts.isIdentifier(value)) {
      const original = file.binding(value);
      if (!original || !safe(original, depth + 1)) return false;
    } else if (!ts.isArrayLiteralExpression(value)) return false;
    for (const reference of file.references.get(binding) ?? []) {
      file.project.tick();
      if (reference === binding.node.name) continue;
      let node: ts.Node = reference, parent = file.parents.get(node);
      while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent)
        || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent))) { node = parent; parent = file.parents.get(node); }
      if (parent && ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)) {
        const alias = file.binding(parent.name);
        if (alias && safe(alias, depth + 1)) continue;
      }
      const call = parent && file.parents.get(parent);
      if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === "includes"
        && !parent.questionDotToken && call && ts.isCallExpression(call) && call.expression === parent && !call.questionDotToken) continue;
      return false;
    }
    return true;
  }
  const value = unwrap(expression);
  if (ts.isArrayLiteralExpression(value)) return true;
  const binding = ts.isIdentifier(value) && file.binding(value);
  return !!binding && safe(binding, 0);
}
