import * as ts from "typescript";
import type { ImplementationKind } from "@repofy/contracts";
import { type IndexedFile, type FunctionNode, type FunctionRef, rootIdentifier, unwrap } from "./project";

export interface RawFinding { kind: ImplementationKind; node: ts.Node; concept: ts.Node; target?: FunctionRef; mocked?: boolean }
type Route = { call: ts.CallExpression; handler: FunctionNode; request: ts.Identifier; response: ts.Identifier };
function nodes(file: IndexedFile, root: ts.Node) { file.project.tick(file.nodes.length); return file.nodes.filter(n => file.contains(root, n)); }
function calls(file: IndexedFile, root: ts.Node) { return nodes(file, root).filter(ts.isCallExpression).filter(n => file.enclosing(n) === file.enclosing(root)); }
function same(file: IndexedFile, a: ts.Identifier, b: ts.Identifier) { const binding = file.binding(a); return !!binding && binding === file.binding(b) && !binding.written; }
function rooted(file: IndexedFile, expression: ts.Expression, parameter: ts.Identifier) { const root = rootIdentifier(unwrap(expression)); return !!root && same(file, root, parameter); }
function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  if (object.properties.some(p => ts.isSpreadAssignment(p) || p.name && ts.isComputedPropertyName(p.name))) return undefined;
  const matches = object.properties.filter(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name);
  if (matches.length !== 1) return undefined; const p = matches[0]; return ts.isPropertyAssignment(p) ? p.initializer : ts.isShorthandPropertyAssignment(p) ? p.name : undefined;
}
function directCall(statement: ts.Statement): ts.CallExpression | undefined {
  const expr = ts.isExpressionStatement(statement) ? statement.expression : ts.isReturnStatement(statement) ? statement.expression :
    ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1 ? statement.declarationList.declarations[0].initializer : undefined;
  const value = expr && unwrap(expr); return value && ts.isCallExpression(value) ? value : undefined;
}
function awaited(file: IndexedFile, call: ts.CallExpression) { return ts.isAwaitExpression(file.parents.get(call) ?? file.ast); }
// This is deliberately limited to syntactically known exits, not whole-program flow analysis.
function stopsFallthrough(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement) || ts.isBreakStatement(statement) || ts.isContinueStatement(statement)) return true;
  if (ts.isBlock(statement)) return statement.statements.some(stopsFallthrough);
  if (ts.isIfStatement(statement)) {
    const condition = unwrap(statement.expression);
    if (condition.kind === ts.SyntaxKind.TrueKeyword) return stopsFallthrough(statement.thenStatement);
    if (condition.kind === ts.SyntaxKind.FalseKeyword) return !!statement.elseStatement && stopsFallthrough(statement.elseStatement);
    return !!statement.elseStatement && stopsFallthrough(statement.thenStatement) && stopsFallthrough(statement.elseStatement);
  }
  if (ts.isTryStatement(statement)) return !!statement.finallyBlock && stopsFallthrough(statement.finallyBlock)
    || stopsFallthrough(statement.tryBlock) && (!statement.catchClause || stopsFallthrough(statement.catchClause.block));
  return false;
}
function reachableStatements(body: ts.Block) {
  const statements: ts.Statement[] = [];
  for (const statement of body.statements) { statements.push(statement); if (stopsFallthrough(statement)) break; }
  return statements;
}
function localCalls(file: IndexedFile, body: ts.Block, start = 0) {
  return reachableStatements(body).slice(start).flatMap(s => { const call = directCall(s); const target = call && file.localFunction(call.expression);
    return call && target ? [{ call, target }] : []; });
}
function firstEffect(body: ts.Block): ts.Statement | undefined {
  for (const statement of body.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    if (ts.isBlock(statement)) { const effect = firstEffect(statement); if (effect) return effect; }
    else return statement;
  }
  return undefined;
}
function bodyOf(fn: FunctionNode): ts.Block | undefined { return fn.body && ts.isBlock(fn.body) ? fn.body : undefined; }
function statusReturn(file: IndexedFile, statement: ts.Statement, response: ts.Identifier, status?: number) {
  if (ts.isBlock(statement)) { if (statement.statements.length !== 1) return false; statement = statement.statements[0]; }
  if (!ts.isReturnStatement(statement) || !statement.expression) return false;
  const value = unwrap(statement.expression); if (!ts.isCallExpression(value) || !ts.isPropertyAccessExpression(value.expression) || value.expression.name.text !== "json") return false;
  const call = value.expression.expression; if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== "status"
    || !ts.isIdentifier(call.expression.expression) || !same(file, call.expression.expression, response) || call.arguments.length !== 1
    || !ts.isNumericLiteral(call.arguments[0]) || value.arguments.length !== 1 || !ts.isObjectLiteralExpression(value.arguments[0])) return false;
  const code = Number(call.arguments[0].text); const errorCode = objectProperty(value.arguments[0], "code");
  return (status === undefined ? code >= 400 && code <= 599 : code === status) && !!errorCode && ts.isStringLiteral(errorCode) && !!errorCode.text;
}
function routeContexts(file: IndexedFile): Route[] {
  return file.calls.flatMap(call => {
    const origin = file.origin(call.expression);
    if (origin?.module !== "express" || !/^(?:default|\*|Router|default\.Router)\(\)\.(?:get|post|put|patch|delete)$/.test(origin.member)
      || call.arguments.length !== 2 || !ts.isStringLiteral(call.arguments[0]) || file.enclosing(call)) return [];
    const target = file.localFunction(call.arguments[1]); if (!target || target.file !== file || target.node.parameters.length < 2) return [];
    const [request, response] = target.node.parameters.map(p => p.name);
    return ts.isIdentifier(request) && ts.isIdentifier(response) ? [{ call, handler: target.node, request, response }] : [];
  });
}
function zodObject(file: IndexedFile, expression: ts.Expression, depth = 0): boolean {
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
function parseStart(file: IndexedFile, body: ts.Block, offset = 0) {
  const statement = body.statements[offset]; if (!statement || !ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)
    || statement.declarationList.declarations.length !== 1) return undefined;
  const declaration = statement.declarationList.declarations[0]; if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return undefined;
  const call = unwrap(declaration.initializer); if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)
    || call.expression.name.text !== "parse" || call.arguments.length !== 1 || !zodObject(file, call.expression.expression)) return undefined;
  const consumed = localCalls(file, body, offset + 1).find(c => c.call.arguments.some(a => ts.isIdentifier(a) && same(file, a, declaration.name as ts.Identifier)));
  return consumed ? { declaration, call, consumed } : undefined;
}
function memberOf(file: IndexedFile, expression: ts.Expression, parameter: ts.Identifier, path: string[]) {
  let current = expression;
  for (let i = path.length - 1; i >= 0; i--) { if (!ts.isPropertyAccessExpression(current) || current.questionDotToken || current.name.text !== path[i]) return false; current = current.expression; }
  return ts.isIdentifier(current) && same(file, current, parameter);
}
function terminal(statement: ts.Statement) { return ts.isReturnStatement(statement) || ts.isThrowStatement(statement)
  || ts.isBlock(statement) && statement.statements.length === 1 && (ts.isReturnStatement(statement.statements[0]) || ts.isThrowStatement(statement.statements[0])); }

function backend(file: IndexedFile, emit: (finding: RawFinding) => void) {
  for (const route of routeContexts(file)) {
    const { handler, request, response } = route; const body = bodyOf(handler); if (!body) continue;
    const local = localCalls(file, body);
    if (local.length) emit({ kind: "route_service", node: route.call, concept: handler, target: local[0].target });
    const parsed = parseStart(file, body);
    if (parsed && ["body", "query", "params"].some(part => memberOf(file, parsed.call.arguments[0], request, [part])))
      emit({ kind: "request_validation", node: parsed.call, concept: handler, target: parsed.consumed.target });
    const first = body.statements[0];
    if (first && ts.isIfStatement(first) && !first.elseStatement && ts.isPrefixUnaryExpression(first.expression)
      && first.expression.operator === ts.SyntaxKind.ExclamationToken && memberOf(file, first.expression.operand, request, ["user"])
      && statusReturn(file, first.thenStatement, response, 401)) {
      const next = local.find(c => c.call.arguments.some(a => memberOf(file, a, request, ["user"]) || memberOf(file, a, request, ["user", "id"])));
      if (next) emit({ kind: "authentication_guard", node: first, concept: handler, target: next.target });
    }
    // Only an immediately loaded resource followed by a denying guard and direct resource operation.
    for (let i = 0; i < body.statements.length - 1; i++) {
      const guard = body.statements[i]; if (!ts.isIfStatement(guard) || guard.elseStatement || !ts.isBinaryExpression(guard.expression)
        || guard.expression.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken || !statusReturn(file, guard.thenStatement, response, 403)) continue;
      const { left, right } = guard.expression;
      const owner = memberOf(file, right, request, ["user", "id"]) ? left : memberOf(file, left, request, ["user", "id"]) ? right : undefined;
      if (!owner || !ts.isPropertyAccessExpression(owner) || !["ownerId", "userId"].includes(owner.name.text) || !ts.isIdentifier(owner.expression)) continue;
      const binding = file.binding(owner.expression); if (!binding?.initializer || binding.written || binding.mutable) continue;
      const loaded = unwrap(binding.initializer); if (!ts.isCallExpression(loaded) || !file.localFunction(loaded.expression)) continue;
      const declarationStatement = file.parents.get(file.parents.get(binding.node)!);
      if (i === 0 || declarationStatement !== body.statements[i - 1]) continue;
      const operation = directCall(body.statements[i + 1]); const target = operation && file.localFunction(operation.expression);
      if (operation && target && operation.arguments.some(a => rooted(file, a, owner.expression as ts.Identifier)))
        emit({ kind: "ownership_guard", node: guard, concept: handler, target });
    }
    for (const node of nodes(file, body)) if (ts.isReturnStatement(node) && file.enclosing(node) === handler && statusReturn(file, node, response))
      emit({ kind: "structured_error", node, concept: handler });
  }
}

function jsxAttribute(file: IndexedFile, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) return undefined;
  const attrs = node.attributes.properties.filter((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(file.ast) === name);
  if (attrs.length !== 1) return undefined; const value = attrs[0].initializer;
  return value && ts.isJsxExpression(value) ? value.expression : undefined;
}
function statePairs(file: IndexedFile, component: FunctionNode) {
  return nodes(file, component).flatMap(node => {
    if (!ts.isVariableDeclaration(node) || file.enclosing(node) !== component || !ts.isArrayBindingPattern(node.name) || node.name.elements.length !== 2 || !node.initializer) return [];
    const value = unwrap(node.initializer); if (!ts.isCallExpression(value)) return [];
    const origin = file.origin(value.expression); if (origin?.module !== "react" || !["useState", "default.useState"].includes(origin.member)) return [];
    const [valueElement, setterElement] = node.name.elements;
    return ts.isBindingElement(valueElement) && ts.isIdentifier(valueElement.name) && ts.isBindingElement(setterElement) && ts.isIdentifier(setterElement.name)
      ? [{ value: valueElement.name, setter: setterElement.name }] : [];
  });
}
function setter(file: IndexedFile, node: ts.Node, name: ts.Identifier, literal?: ts.SyntaxKind) {
  return calls(file, node).some(call => ts.isIdentifier(call.expression) && same(file, call.expression, name) && call.arguments.length === 1
    && (literal === undefined || call.arguments[0].kind === literal));
}
function frontend(file: IndexedFile, emit: (f: RawFinding) => void) {
  for (const element of file.nodes.filter(ts.isJsxElement)) {
    const opening = element.openingElement; if (!ts.isIdentifier(opening.tagName)) continue;
    const component = file.enclosing(element); if (!component) continue;
    const react = file.bindings.some(b => b.imported?.source === "react" && !b.imported.typeOnly); if (!react) continue;
    const attribute = jsxAttribute(file, opening, opening.tagName.text === "form" ? "onSubmit" : "onClick");
    const target = attribute && file.localFunction(attribute); if (!target || target.file !== file) continue;
    const body = bodyOf(target.node); if (!body || !body.statements.length) continue;
    const pairs = statePairs(file, component);
    if (opening.tagName.text === "button" && element.children.some(child => ts.isJsxText(child) && !!child.text.trim())
      && !opening.attributes.properties.some(p => ts.isJsxAttribute(p) && ["aria-hidden", "hidden", "disabled", "role", "aria-label", "aria-labelledby"].includes(p.name.getText(file.ast))))
      emit({ kind: "accessible_action", node: element, concept: target.node });
    if (opening.tagName.text === "form") {
      const first = directCall(body.statements[0]); const event = target.node.parameters[0]?.name;
      const offset = first && event && ts.isIdentifier(event) && ts.isPropertyAccessExpression(first.expression)
        && memberOf(file, first.expression, event, ["preventDefault"]) && !first.arguments.length ? 1 : 0;
      const parsed = parseStart(file, body, offset);
      if (parsed && ts.isIdentifier(parsed.call.arguments[0]) && pairs.some(p => same(file, parsed.call.arguments[0] as ts.Identifier, p.value)))
        emit({ kind: "form_validation", node: element, concept: target.node, target: parsed.consumed.target });
    }
    for (const statement of body.statements) {
      if (!ts.isTryStatement(statement) || !statement.catchClause || !statement.finallyBlock) continue;
      const fetch = calls(file, statement.tryBlock).find(c => ts.isIdentifier(c.expression) && c.expression.text === "fetch" && !file.hasBinding(c.expression) && awaited(file, c));
      if (!fetch) continue;
      const before = body.statements.slice(0, body.statements.indexOf(statement));
      const loading = pairs.find(p => before.some(s => setter(file, s, p.setter, ts.SyntaxKind.TrueKeyword)) && setter(file, statement.finallyBlock!, p.setter, ts.SyntaxKind.FalseKeyword));
      const failure = pairs.find(p => setter(file, statement.catchClause!.block, p.setter) && (!loading || !same(file, p.value, loading.value)));
      const rendered = (value: ts.Identifier) => nodes(file, component).some(n => ts.isJsxExpression(n) && n.expression
        && nodes(file, n.expression).some(child => ts.isIdentifier(child) && same(file, child, value)));
      if (loading && failure && rendered(loading.value) && rendered(failure.value)) emit({ kind: "request_state", node: statement, concept: target.node });
    }
  }
}

function database(file: IndexedFile, emit: (f: RawFinding) => void) {
  for (const call of file.calls) {
    const origin = file.origin(call.expression); const concept = file.enclosing(call) ?? call;
    if (origin?.module === "pg" && /^(?:(?:default\.)?(?:Pool|Client)\(\)|Pool\(\)\.connect\(\))\.query$/.test(origin.member)
      && awaited(file, call) && call.arguments.length === 2 && ts.isStringLiteral(call.arguments[0]) && ts.isArrayLiteralExpression(call.arguments[1]) && call.arguments[1].elements.length
      && !call.arguments[1].elements.some(ts.isSpreadElement)) {
      const sql = call.arguments[0].text;
      // Reject SQL quoting/comments so quoted or commented placeholders cannot masquerade as value slots.
      if (!/['";]|--|\/\*|\$[a-zA-Z_]*\$/.test(sql) && /^(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(sql.trim())) {
        const slots = [...sql.matchAll(/\$([1-9][0-9]*)\b/g)].map(m => Number(m[1])); const unique = [...new Set(slots)].sort((a, b) => a - b);
        if (unique.length === call.arguments[1].elements.length && unique.every((n, i) => n === i + 1)) emit({ kind: "parameterized_query", node: call, concept });
      }
    }
    if (origin?.module === "@prisma/client" && origin.member === "PrismaClient().$transaction" && awaited(file, call)
      && call.arguments.length === 1 && (ts.isArrowFunction(call.arguments[0]) || ts.isFunctionExpression(call.arguments[0]))) {
      const fn = call.arguments[0]; const tx = fn.parameters[0]?.name; const body = bodyOf(fn);
      if (body && tx && ts.isIdentifier(tx) && ts.getModifiers(fn)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) && body.statements.length >= 2 && body.statements.every(s => {
        const write = directCall(s); if (!write || !awaited(file, write) || !ts.isPropertyAccessExpression(write.expression)
          || !["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(write.expression.name.text)) return false;
        return ts.isPropertyAccessExpression(write.expression.expression) && ts.isIdentifier(write.expression.expression.expression)
          && same(file, write.expression.expression.expression, tx);
      })) emit({ kind: "transaction", node: call, concept });
    }
    if (origin?.module === "drizzle-orm/pg-core" && origin.member === "pgTable" && call.arguments.length >= 2 && ts.isObjectLiteralExpression(call.arguments[1])) {
      const declaration = file.parents.get(call); if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)
        || ![...file.exports.values()].includes(file.binding(declaration.name) ?? null)) continue;
      const columns = call.arguments[1];
      if (columns.properties.some(p => !ts.isPropertyAssignment(p) || ts.isComputedPropertyName(p.name))
        || new Set(columns.properties.map(p => p.name?.getText(file.ast))).size !== columns.properties.length) continue;
      for (const property of call.arguments[1].properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isCallExpression(property.initializer)) continue;
        const column = property.initializer; const columnOrigin = file.origin(column.expression);
        if (columnOrigin?.module === "drizzle-orm/pg-core" && /^(?:text|integer|uuid|varchar)\(\)\.(?:unique|references)$/.test(columnOrigin.member)) {
          if (columnOrigin.member.endsWith(".unique") && column.arguments.length === 0) emit({ kind: "schema_constraint", node: property, concept: call });
          else if (column.arguments.length === 1 && ts.isArrowFunction(column.arguments[0]) && ts.isPropertyAccessExpression(column.arguments[0].body)) {
            const related = file.origin(column.arguments[0].body.expression);
            if (related?.module === "drizzle-orm/pg-core" && related.member === "pgTable()") emit({ kind: "schema_constraint", node: property, concept: call });
          }
        }
      }
    }
  }
  for (const node of file.nodes) if (ts.isTryStatement(node) && node.finallyBlock) {
    // A nested conditional or preceding effect can bypass cleanup. Support only an immediate,
    // unconditional release (allowing inert empty blocks/statements), not arbitrary descendants.
    const first = firstEffect(node.finallyBlock); const release = first && directCall(first);
    const releaseOrigin = release && file.origin(release.expression);
    if (!release || releaseOrigin?.module !== "pg" || releaseOrigin.member !== "Pool().connect().release" || release.arguments.length) continue;
    if (!ts.isPropertyAccessExpression(release.expression) || !ts.isIdentifier(release.expression.expression)) continue;
    const client = release.expression.expression; const b = file.binding(client);
    if (!b?.initializer || !ts.isAwaitExpression(b.initializer) || !file.enclosing(node) || b.node.end > node.pos) continue;
    if (reachableStatements(node.tryBlock).map(directCall).some(call => call && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "query"
      && ts.isIdentifier(call.expression.expression) && same(file, client, call.expression.expression))) emit({ kind: "failure_cleanup", node, concept: file.enclosing(node)! });
  }
}

function reliability(file: IndexedFile, emit: (f: RawFinding) => void) {
  for (const node of file.nodes) if (ts.isForStatement(node) && node.initializer && ts.isVariableDeclarationList(node.initializer)
    && node.initializer.declarations.length === 1 && node.condition && ts.isBinaryExpression(node.condition) && node.incrementor
    && ts.isPostfixUnaryExpression(node.incrementor) && node.incrementor.operator === ts.SyntaxKind.PlusPlusToken && ts.isIdentifier(node.incrementor.operand)) {
    const counter = node.initializer.declarations[0]; const condition = node.condition;
    if (!ts.isIdentifier(counter.name) || !counter.initializer || !ts.isNumericLiteral(counter.initializer) || counter.initializer.text !== "0"
      || !ts.isIdentifier(condition.left) || file.binding(counter.name) !== file.binding(condition.left)
      || file.binding(counter.name) !== file.binding(node.incrementor.operand) || condition.operatorToken.kind !== ts.SyntaxKind.LessThanToken
      || !ts.isNumericLiteral(condition.right) || !Number.isInteger(Number(condition.right.text)) || +condition.right.text < 1 || +condition.right.text > 10
      || !ts.isBlock(node.statement) || node.statement.statements.length !== 1 || !ts.isTryStatement(node.statement.statements[0])) continue;
    const attempt = node.statement.statements[0]; if (!attempt.catchClause || attempt.finallyBlock || attempt.tryBlock.statements.length !== 1) continue;
    const operation = directCall(attempt.tryBlock.statements[0]); const target = operation && file.localFunction(operation.expression);
    if (!operation || !target || !awaited(file, operation) || attempt.catchClause.block.statements.length !== 0) continue;
    // Counter references in the body, nested loops and callbacks are outside this deliberately small retry language.
    if (nodes(file, node.statement).some(n => ts.isIdentifier(n) && file.binding(n) === file.binding(counter.name as ts.Identifier))) continue;
    emit({ kind: "bounded_retry", node, concept: file.enclosing(node) ?? node, target });
  }
  for (const fn of file.functions) {
    const body = bodyOf(fn); const parameter = fn.parameters[0]?.name; const guard = body?.statements[0];
    if (!body || !parameter || !ts.isIdentifier(parameter) || !guard || !ts.isIfStatement(guard) || guard.elseStatement || !terminal(guard.thenStatement)
      || !ts.isBinaryExpression(guard.expression) || guard.expression.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
      || !ts.isStringLiteral(guard.expression.right) || !memberOf(file, guard.expression.left, parameter, ["state"])) continue;
    const operation = body.statements[1] && directCall(body.statements[1]); const target = operation && file.localFunction(operation.expression);
    if (operation && target && operation.arguments.some(a => ts.isIdentifier(a) && same(file, a, parameter))) emit({ kind: "state_guard", node: guard, concept: fn, target });
  }
}

function testing(file: IndexedFile, emit: (f: RawFinding) => void) {
  const mocked = file.calls.some(call => {
    const origin = file.origin(call.expression); return origin && ["vitest", "@jest/globals"].includes(origin.module)
      && /(?:^|\.)(?:mock|doMock|spyOn|fn|stubGlobal|unstable_mockModule)$/.test(origin.member)
      || ts.isPropertyAccessExpression(call.expression) && ["mock", "doMock", "spyOn", "listen", "intercept", "route"].includes(call.expression.name.text);
  });
  for (const call of file.calls) {
    const origin = file.origin(call.expression); if (!origin || !["vitest", "@jest/globals"].includes(origin.module)
      || !["it", "test"].includes(origin.member) || call.arguments.length !== 2 || !ts.isStringLiteral(call.arguments[0])) continue;
    const callback = file.localFunction(call.arguments[1]); if (!callback || callback.file !== file) continue;
    let parent = file.parents.get(call); let skipped = false;
    while (parent) {
      if (ts.isCallExpression(parent)) { const outer = file.origin(parent.expression); if (!outer || !["describe", "suite"].includes(outer.member)) skipped = true; }
      if (ts.isIfStatement(parent) || ts.isConditionalExpression(parent) || ts.isIterationStatement(parent, false)) skipped = true;
      parent = file.parents.get(parent);
    }
    if (skipped) continue;
    const body = bodyOf(callback.node); if (!body) continue;
    for (const statement of body.statements) {
      if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) break;
      const assertion = directCall(statement); if (!assertion || !ts.isPropertyAccessExpression(assertion.expression)
        || !["toBe", "toEqual", "toStrictEqual", "toMatchObject", "toContain", "toHaveLength"].includes(assertion.expression.name.text) || assertion.arguments.length !== 1) continue;
      const expectCall = assertion.expression.expression; if (!ts.isCallExpression(expectCall) || expectCall.arguments.length !== 1) continue;
      const expectOrigin = file.origin(expectCall.expression); if (expectOrigin?.module !== origin.module || expectOrigin.member !== "expect") continue;
      const value = file.resolveValue(expectCall.arguments[0]); if (!ts.isCallExpression(value)) continue;
      if (!file.contains(body, value) || file.enclosing(value) !== callback.node || value.pos > assertion.end) continue;
      const target = file.localFunction(value.expression); if (!target || target.file.input.classification !== "code" || target.file === file) continue;
      const targetAsync = ts.getModifiers(target.node)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (targetAsync && !awaited(file, value)) continue;
      emit({ kind: "asserted_call", node: assertion, concept: callback.node, target, mocked });
    }
  }
}
function ai(file: IndexedFile, emit: (f: RawFinding) => void) {
  for (const call of file.calls) {
    const origin = file.origin(call.expression); if (origin?.module !== "ai" || origin.member !== "generateObject" || !awaited(file, call)
      || call.arguments.length !== 1 || !ts.isObjectLiteralExpression(call.arguments[0])) continue;
    const options = call.arguments[0]; const schema = objectProperty(options, "schema"), retries = objectProperty(options, "maxRetries"), signal = objectProperty(options, "abortSignal");
    if (!objectProperty(options, "model") || !(objectProperty(options, "prompt") || objectProperty(options, "messages"))
      || !schema || !zodObject(file, schema) || !retries || !ts.isNumericLiteral(retries) || !Number.isInteger(+retries.text) || +retries.text > 3
      || !signal || !ts.isCallExpression(signal) || !ts.isPropertyAccessExpression(signal.expression)
      || signal.expression.name.text !== "timeout" || !ts.isIdentifier(signal.expression.expression) || signal.expression.expression.text !== "AbortSignal"
      || file.hasBinding(signal.expression.expression) || signal.arguments.length !== 1 || !ts.isNumericLiteral(signal.arguments[0])
      || !Number.isInteger(+signal.arguments[0].text) || +signal.arguments[0].text < 1 || +signal.arguments[0].text > 60000) continue;
    emit({ kind: "bounded_model_output", node: call, concept: file.enclosing(call) ?? call });
  }
}
export function detect(file: IndexedFile): RawFinding[] {
  const findings: RawFinding[] = []; const emit = (finding: RawFinding) => { findings.push(finding); };
  if (file.input.classification === "test") testing(file, emit);
  else { backend(file, emit); frontend(file, emit); database(file, emit); reliability(file, emit); ai(file, emit); }
  const seen = new Set<string>();
  return findings.filter(f => { const key = `${f.kind}:${f.node.pos}:${f.node.end}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
