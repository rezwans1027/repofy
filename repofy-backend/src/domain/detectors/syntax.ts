import * as ts from "typescript";
import { type IndexedFile, type FunctionNode, rootIdentifier, unwrap } from "./project";

export function nodes(file: IndexedFile, root: ts.Node) { file.project.tick(file.nodes.length); return file.nodes.filter(n => file.contains(root, n)); }
export function same(file: IndexedFile, a: ts.Identifier, b: ts.Identifier) { const binding = file.binding(a); return !!binding && binding === file.binding(b) && !binding.written; }
export function rooted(file: IndexedFile, expression: ts.Expression, parameter: ts.Identifier) { const root = rootIdentifier(unwrap(expression)); return !!root && same(file, root, parameter); }
export function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  if (object.properties.some(p => ts.isSpreadAssignment(p) || p.name && ts.isComputedPropertyName(p.name))) return undefined;
  const matches = object.properties.filter(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name);
  if (matches.length !== 1) return undefined; const p = matches[0]; return ts.isPropertyAssignment(p) ? p.initializer : ts.isShorthandPropertyAssignment(p) ? p.name : undefined;
}
export function directCall(statement: ts.Statement): ts.CallExpression | undefined {
  const expr = ts.isExpressionStatement(statement) ? statement.expression : ts.isReturnStatement(statement) ? statement.expression :
    ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1 ? statement.declarationList.declarations[0].initializer : undefined;
  const value = expr && unwrap(expr); return value && ts.isCallExpression(value) ? value : undefined;
}
export function awaited(file: IndexedFile, call: ts.CallExpression) { return ts.isAwaitExpression(file.parents.get(call) ?? file.ast); }
export function reachableStatements(file: IndexedFile, body: ts.Block) { return [...file.flow.statements(body)]; }
export function localCalls(file: IndexedFile, body: ts.Block, start = 0) {
  return reachableStatements(file, body).slice(start).flatMap(s => { const call = directCall(s); const target = call && file.localFunction(call.expression);
    return call && target ? [{ call, target }] : []; });
}
export function firstEffect(body: ts.Block): ts.Statement | undefined {
  for (const statement of body.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    if (ts.isBlock(statement)) { const effect = firstEffect(statement); if (effect) return effect; }
    else return statement;
  }
  return undefined;
}
export function bodyOf(fn: FunctionNode): ts.Block | undefined { return fn.body && ts.isBlock(fn.body) ? fn.body : undefined; }
export function inertJsonValue(file: IndexedFile, value: ts.Expression): boolean {
  file.project.tick();
  if (ts.isParenthesizedExpression(value) || ts.isAsExpression(value) || ts.isTypeAssertionExpression(value)
    || ts.isNonNullExpression(value) || ts.isSatisfiesExpression(value)) return inertJsonValue(file, value.expression);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) || ts.isNumericLiteral(value)
    || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(value.kind)) return true;
  if (ts.isPrefixUnaryExpression(value) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(value.operator))
    return ts.isNumericLiteral(value.operand);
  if (ts.isArrayLiteralExpression(value)) return value.elements.every(element => inertJsonValue(file, element));
  return ts.isObjectLiteralExpression(value) && value.properties.every(property => ts.isPropertyAssignment(property)
    && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name))
    && inertJsonValue(file, property.initializer));
}
export function zodObject(file: IndexedFile, expression: ts.Expression, depth = 0): boolean {
  if (depth > 8) return false;
  const value = file.resolveValue(expression); if (!ts.isCallExpression(value)) return false;
  const origin = file.origin(value.expression); if (origin?.module !== "zod" || !/^(?:z\.)?(?:object|strictObject)$/.test(origin.member)
    || value.arguments.length !== 1 || !ts.isObjectLiteralExpression(value.arguments[0]) || !value.arguments[0].properties.length) return false;
  return value.arguments[0].properties.every(p => {
    if (!ts.isPropertyAssignment(p) || ts.isComputedPropertyName(p.name)) return false;
    const expr = file.resolveValue(p.initializer); if (!ts.isCallExpression(expr)) return false;
    const type = file.origin(expr.expression);
    return type?.module === "zod" && /^(?:z\.)?(?:string|number|boolean|literal|enum)(?:\(\)\.(?:min|max|email|int|positive|nonnegative|uuid|optional|nullable))*$/.test(type.member)
      || zodObject(file, expr, depth + 1);
  });
}
export function parseStart(file: IndexedFile, body: ts.Block, offset = 0) {
  const statement = body.statements[offset]; if (!statement || !ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)
    || statement.declarationList.declarations.length !== 1) return undefined;
  const declaration = statement.declarationList.declarations[0]; if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return undefined;
  const call = unwrap(declaration.initializer); if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)
    || call.expression.name.text !== "parse" || call.arguments.length !== 1 || !zodObject(file, call.expression.expression)) return undefined;
  const consumed = localCalls(file, body, offset + 1).find(c => c.call.arguments.some(a => ts.isIdentifier(a) && same(file, a, declaration.name as ts.Identifier)));
  return consumed ? { declaration, call, consumed } : undefined;
}
export function memberOf(file: IndexedFile, expression: ts.Expression, parameter: ts.Identifier, path: string[]) {
  let current = expression;
  for (let i = path.length - 1; i >= 0; i--) { if (!ts.isPropertyAccessExpression(current) || current.questionDotToken || current.name.text !== path[i]) return false; current = current.expression; }
  return ts.isIdentifier(current) && same(file, current, parameter);
}
export function rejectingStateExit(file: IndexedFile, statement: ts.Statement): boolean {
  if (ts.isBlock(statement)) { if (statement.statements.length !== 1) return false; statement = statement.statements[0]; }
  if (!ts.isReturnStatement(statement) && !ts.isThrowStatement(statement)) return false;
  if (!statement.expression) return ts.isReturnStatement(statement);
  const literal = (value: ts.Expression) => ts.isStringLiteral(value) || ts.isNumericLiteral(value)
    || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(value.kind)
    || ts.isIdentifier(value) && value.text === "undefined" && !file.hasBinding(value);
  const value = unwrap(statement.expression);
  // A terminal expression may itself perform the protected operation. Only
  // inert returns/throws and a known, unshadowed Error construction are supported.
  return literal(value) || ts.isThrowStatement(statement) && ts.isNewExpression(value)
    && ts.isIdentifier(value.expression) && value.expression.text === "Error" && !file.hasBinding(value.expression)
    && (!value.arguments || value.arguments.every(literal));
}

export function jsxAttribute(file: IndexedFile, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) return undefined;
  const attrs = node.attributes.properties.filter((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(file.ast) === name);
  if (attrs.length !== 1) return undefined; const value = attrs[0].initializer;
  return value && ts.isJsxExpression(value) ? value.expression : undefined;
}
export function statePairs(file: IndexedFile, component: FunctionNode) {
  return nodes(file, component).flatMap(node => {
    if (!ts.isVariableDeclaration(node) || file.enclosing(node) !== component || !ts.isArrayBindingPattern(node.name) || node.name.elements.length !== 2 || !node.initializer || !file.flow.reachable(node)) return [];
    const value = unwrap(node.initializer); if (!ts.isCallExpression(value)) return [];
    const origin = file.origin(value.expression); if (origin?.module !== "react" || !["useState", "default.useState"].includes(origin.member)) return [];
    const [valueElement, setterElement] = node.name.elements;
    return ts.isBindingElement(valueElement) && ts.isIdentifier(valueElement.name) && ts.isBindingElement(setterElement) && ts.isIdentifier(setterElement.name)
      ? [{ value: valueElement.name, setter: setterElement.name }] : [];
  });
}
export function setter(file: IndexedFile, statement: ts.Statement | undefined, name: ts.Identifier, literal?: ts.SyntaxKind) {
  const first = statement && (ts.isBlock(statement) ? firstEffect(statement) : statement);
  const call = first && directCall(first);
  return !!call && ts.isIdentifier(call.expression) && same(file, call.expression, name) && call.arguments.length === 1
    && (literal === undefined || call.arguments[0].kind === literal);
}
