import * as ts from "typescript";
import { type IndexedFile, type FunctionNode, type FunctionRef, unwrap } from "./project";
import type { RawFinding } from "./rules";
import { bodyOf, directCall, same, memberOf, objectProperty, zodObject, rejectingStateExit, statePairs,
  jsxAttribute, nodes, awaited, inertJsonValue } from "./syntax";
import { roleTests } from "./role-tests";
import { immutableAllowlist, renderPath } from "./role-proof";

type Emit = (finding: RawFinding) => void;
const literal = (e: ts.Node | undefined): e is ts.StringLiteral => !!e && ts.isStringLiteral(e) && !!e.text.trim();
function argument(file: IndexedFile, fn: FunctionNode, e: ts.Expression, index = 0) {
  const p = fn.parameters[index]?.name;
  return !!p && ts.isIdentifier(p) && ts.isIdentifier(e) && same(file, p, e);
}
function declaration(s: ts.Statement | undefined) {
  if (!s || !ts.isVariableStatement(s) || !(s.declarationList.flags & ts.NodeFlags.Const) || s.declarationList.declarations.length !== 1) return undefined;
  const d = s.declarationList.declarations[0]; return ts.isIdentifier(d.name) && d.initializer ? d as ts.VariableDeclaration & { name: ts.Identifier; initializer: ts.Expression } : undefined;
}
function parsedInput(file: IndexedFile, fn: FunctionNode, statements: readonly ts.Statement[]) {
  const d = declaration(statements[0]), call = d && unwrap(d.initializer);
  return d && call && ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "parse"
    && zodObject(file, call.expression.expression) && call.arguments.length === 1 && argument(file, fn, call.arguments[0]) ? d : undefined;
}
function primitiveError(file: IndexedFile, s: ts.Statement) { return rejectingStateExit(file, s); }
function literalAttribute(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) return undefined;
  const attrs = node.attributes.properties.filter((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === name);
  if (attrs.length !== 1) return undefined;
  const v = attrs[0].initializer; return v && ts.isStringLiteral(v) ? v.text : undefined;
}
function obscured(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, native = false) {
  return node.attributes.properties.some(p => ts.isJsxSpreadAttribute(p) || ts.isJsxAttribute(p) && ts.isIdentifier(p.name)
    && (native ? ['disabled','accessible','accessibilityElementsHidden','importantForAccessibility']
      : ['hidden','aria-hidden','disabled','role','aria-label','aria-labelledby']).includes(p.name.text));
}
function returnedJsx(file: IndexedFile, fn: FunctionNode, n: ts.Node) {
  const body = bodyOf(fn); if (!body) return false;
  return body.statements.some(s => ts.isReturnStatement(s) && !!s.expression && file.contains(s.expression, n));
}
function hiddenAncestor(file: IndexedFile, node: ts.Node, component: FunctionNode) {
  let parent = file.parents.get(node);
  while (parent && parent !== component) {
    if (ts.isJsxElement(parent) && parent.openingElement.attributes.properties.some(p => ts.isJsxSpreadAttribute(p)
      || ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && ["hidden", "aria-hidden", "inert", "accessibilityElementsHidden", "importantForAccessibility"].includes(p.name.text))) return true;
    parent = file.parents.get(parent);
  }
  return false;
}
function ui(file: IndexedFile, emit: Emit, corrected: boolean) {
  for (const element of file.nodes) {
    if (!ts.isJsxElement(element) && !ts.isJsxSelfClosingElement(element)) continue;
    const opening = ts.isJsxElement(element) ? element.openingElement : element, fn = file.enclosing(element);
    if (!fn || !returnedJsx(file, fn, element) || !ts.isIdentifier(opening.tagName) || hiddenAncestor(file, element, fn)) continue;
    const native = file.origin(opening.tagName);
    if (native?.module === "react-native" && native.member === "Pressable" && literalAttribute(opening, "accessibilityRole") === "button"
      && literalAttribute(opening, "accessibilityLabel")?.trim() && !obscured(opening,true)) {
      const onPress = jsxAttribute(file, opening, "onPress"), target = onPress && file.localFunction(onPress);
      if (target && target.file === file && bodyOf(target.node)?.statements.length) emit({ kind: "native_accessible_action", node: element, concept: fn });
    }
    if (opening.tagName.text !== "form" || !ts.isJsxElement(element) || obscured(opening)) continue;
    if (corrected && !bodyOf(fn)?.statements.some(s => ts.isReturnStatement(s) && s.expression
      && file.contains(s.expression, element) && renderPath(file, s.expression, element) !== undefined)) continue;
    const submit = jsxAttribute(file, opening, "onSubmit"), handler = submit && file.localFunction(submit);
    if (!handler || handler.file !== file || !bodyOf(handler.node)?.statements.length) continue;
    const all = nodes(file, element), pairs = statePairs(file, fn);
    const buttons = all.filter(n => ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && n.openingElement.tagName.text === "button"
      && !obscured(n.openingElement) && !hiddenAncestor(file, n, fn) && literalAttribute(n.openingElement, "type") === "submit" && n.children.some(c => ts.isJsxText(c) && !!c.text.trim()));
    if (!buttons.length) continue;
    for (const input of all.filter(ts.isJsxSelfClosingElement)) {
      if (!ts.isIdentifier(input.tagName) || input.tagName.text !== "input" || obscured(input) || hiddenAncestor(file, input, fn) || literalAttribute(input,"type") === "hidden") continue;
      const path = corrected ? renderPath(file, element, input) : "";
      if (path === undefined || corrected && !buttons.some(button => renderPath(file, element, button) === path)) continue;
      const id = literalAttribute(input, "id"), value = jsxAttribute(file, input, "value"), change = jsxAttribute(file, input, "onChange");
      const pair = value && ts.isIdentifier(value) && pairs.find(p => same(file, p.value, value));
      const target = change && file.localFunction(change), body = target && bodyOf(target.node), call = body?.statements.length === 1 && directCall(body.statements[0]);
      const event = target?.node.parameters[0]?.name;
      if (!id || !pair || !call || !ts.isIdentifier(call.expression) || !same(file, call.expression, pair.setter) || call.arguments.length !== 1
        || !event || !ts.isIdentifier(event) || !memberOf(file, call.arguments[0], event, ["target", "value"])) continue;
      if (all.some(n => ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && n.openingElement.tagName.text === "label"
        && (!corrected || renderPath(file, element, n) === path)
        && !obscured(n.openingElement) && !hiddenAncestor(file, n, fn) && literalAttribute(n.openingElement, "htmlFor") === id && n.children.some(c => ts.isJsxText(c) && !!c.text.trim())))
        emit({ kind: "labelled_control", node: element, concept: fn });
    }
  }
}
function functions(file: IndexedFile, emit: Emit) {
  for (const fn of file.functions) {
    const body = bodyOf(fn); if (!body) continue;
    const s = [...file.flow.statements(body)], first = s[0], parsed = parsedInput(file, fn, s);
    if (parsed && s.length === 2 && ts.isReturnStatement(s[1])) {
      const call = directCall(s[1]), target = call && file.localFunction(call.expression);
      if (call && target && target.file !== file && call.arguments.length === 1 && ts.isIdentifier(call.arguments[0]) && same(file, call.arguments[0], parsed.name))
        emit({ kind: "validated_boundary", node: fn, concept: fn, target });
      const origin = call && file.origin(call.expression), opts = call?.arguments[0];
      if (call && origin?.module === "expo-router" && origin.member === "router.push" && call.arguments.length === 1 && opts && ts.isObjectLiteralExpression(opts)) {
        const path = objectProperty(opts, "pathname"), params = objectProperty(opts, "params");
        if (literal(path) && path.text.startsWith("/") && params && ts.isIdentifier(params) && same(file, params, parsed.name))
          emit({ kind: "mobile_navigation", node: fn, concept: fn });
      }
    }
    const env = declaration(first), envValue = env && unwrap(env.initializer), guard = s[1], operation = s[2] && directCall(s[2]);
    if (env && envValue && ts.isPropertyAccessExpression(envValue) && /(?:^|_)(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)(?:$|_)/.test(envValue.name.text)
      && ts.isPropertyAccessExpression(envValue.expression) && envValue.expression.name.text === "env"
      && ts.isIdentifier(envValue.expression.expression) && envValue.expression.expression.text === "process" && !file.hasBinding(envValue.expression.expression)
      && guard && ts.isIfStatement(guard) && !guard.elseStatement && ts.isPrefixUnaryExpression(guard.expression)
      && guard.expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(guard.expression.operand) && same(file, env.name, guard.expression.operand)
      && primitiveError(file, guard.thenStatement) && operation && operation.arguments.some(a => ts.isIdentifier(a) && same(file, a, env.name))) {
      const target = file.localFunction(operation.expression); if (target) emit({ kind: "secret_configuration", node: fn, concept: fn, target });
    }
    if (first && ts.isIfStatement(first) && !first.elseStatement && ts.isBinaryExpression(first.expression)
      && first.expression.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken && primitiveError(file, first.thenStatement)) {
      const actor = fn.parameters[0]?.name, resource = fn.parameters[1]?.name, call = s[1] && directCall(s[1]);
      if (actor && resource && ts.isIdentifier(actor) && ts.isIdentifier(resource) && call
        && memberOf(file, first.expression.left, resource, ["ownerId"]) && memberOf(file, first.expression.right, actor, ["id"])
        && call.arguments.some(a => ts.isIdentifier(a) && same(file, a, resource))) {
        const target = file.localFunction(call.expression); if (target) emit({ kind: "resource_guard", node: first, concept: fn, target });
      }
    }
    if (s.length === 1 && ts.isSwitchStatement(first) && fn.parameters.length === 2) {
      const state = fn.parameters[0].name, action = fn.parameters[1].name;
      if (!ts.isIdentifier(state) || !ts.isIdentifier(action) || !memberOf(file, first.expression, action, ["type"])) continue;
      const clauses = first.caseBlock.clauses, fallback = clauses.find(ts.isDefaultClause);
      if (!fallback || fallback.statements.length !== 1 || !ts.isReturnStatement(fallback.statements[0]) || !fallback.statements[0].expression
        || !argument(file, fn, fallback.statements[0].expression)) continue;
      for (const c of clauses) if (ts.isCaseClause(c) && literal(c.expression) && c.statements.length === 1 && ts.isReturnStatement(c.statements[0])) {
        const value = c.statements[0].expression;
        if (!value || !ts.isObjectLiteralExpression(value) || value.properties.length !== 2) continue;
        const [copy, update] = value.properties;
        if (ts.isSpreadAssignment(copy) && argument(file, fn, copy.expression) && ts.isPropertyAssignment(update)
          && ts.isIdentifier(update.name) && memberOf(file, update.initializer, action, ["payload"])) emit({ kind: "state_transition", node: first, concept: fn });
      }
    }
    for (const call of file.calls.filter(c => file.enclosing(c) === fn)) {
      const origin = file.origin(call.expression);
      if (origin?.module === "expo-secure-store" && ["setItemAsync", "*.setItemAsync", "default.setItemAsync"].includes(origin.member)
        && awaited(file, call) && call.arguments.length === 2 && literal(call.arguments[0]) && argument(file, fn, call.arguments[1]))
        emit({ kind: "secure_storage", node: call, concept: fn });
    }
    const sub = declaration(first), registration = sub && unwrap(sub.initializer);
    if (sub && registration && ts.isCallExpression(registration) && s.length === 2 && ts.isReturnStatement(s[1]) && s[1].expression) {
      const origin = file.origin(registration.expression), handler = registration.arguments[1] && file.localFunction(registration.arguments[1]);
      const disposer = file.localFunction(s[1].expression), disposal = disposer && bodyOf(disposer.node), remove = disposal?.statements.length === 1 && directCall(disposal.statements[0]);
      if (origin?.module === "react-native" && origin.member === "AppState.addEventListener" && registration.arguments.length === 2
        && literal(registration.arguments[0]) && registration.arguments[0].text === "change" && handler && bodyOf(handler.node)?.statements.length
        && remove && !remove.arguments.length && memberOf(file, remove.expression, sub.name, ["remove"]))
        emit({ kind: "mobile_subscription", node: fn, concept: fn });
    }
    for (const node of s) if (ts.isTryStatement(node) && node.catchClause && !node.finallyBlock) {
      const good = [...file.flow.statements(node.tryBlock)], bad = [...file.flow.statements(node.catchClause.block)];
      const result = declaration(good[0]), work = result && unwrap(result.initializer), write = good[1] && directCall(good[1]), last = good[2];
      const cached = declaration(bad[0]), read = cached && unwrap(cached.initializer), fallback = bad[1];
      const wo = write && file.origin(write.expression), ro = read && ts.isCallExpression(read) && file.origin(read.expression);
      if (result && work && ts.isCallExpression(work) && awaited(file, work) && file.localFunction(work.expression)
        && good.length === 3 && write && awaited(file, write) && wo?.module === "@react-native-async-storage/async-storage" && wo.member === "default.setItem"
        && write.arguments.length === 2 && literal(write.arguments[0]) && cached && read && ts.isCallExpression(read) && awaited(file, read)
        && ro && ro.module === wo.module && ro.member === "default.getItem" && read.arguments.length === 1 && literal(read.arguments[0]) && read.arguments[0].text === write.arguments[0].text
        && last && ts.isReturnStatement(last) && last.expression && ts.isIdentifier(last.expression) && same(file, last.expression, result.name)
        && bad.length === 2 && fallback && ts.isReturnStatement(fallback) && fallback.expression) {
        const serial = unwrap(write.arguments[1]), parse = unwrap(fallback.expression);
        const json = (c: ts.Expression, method: string, value: ts.Identifier) => ts.isCallExpression(c) && c.arguments.length === 1
          && ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === method && ts.isIdentifier(c.expression.expression)
          && c.expression.expression.text === "JSON" && !file.hasBinding(c.expression.expression) && ts.isIdentifier(c.arguments[0]) && same(file, c.arguments[0], value);
        if (json(serial, "stringify", result.name) && json(parse, "parse", cached.name)) emit({ kind: "mobile_cache", node, concept: fn });
      }
      const probe = good[0] && directCall(good[0]);
      const status = (stmt: ts.Statement | undefined, value: string) => !!stmt && ts.isReturnStatement(stmt) && !!stmt.expression && ts.isObjectLiteralExpression(stmt.expression)
        && inertJsonValue(file, stmt.expression) && literal(objectProperty(stmt.expression, "status")) && (objectProperty(stmt.expression, "status") as ts.StringLiteral).text === value;
      if (good.length === 2 && bad.length === 1 && probe && awaited(file, probe) && file.localFunction(probe.expression)
        && status(good[1], "ok") && status(bad[0], "unavailable")) emit({ kind: "health_probe", node, concept: fn });
      const log = bad[0] && directCall(bad[0]), origin = log && file.origin(log.expression), payload = log?.arguments[0];
      if (log && origin?.module === "pino" && origin.member === "default().error" && log.arguments.length === 1 && payload && ts.isObjectLiteralExpression(payload)
        && inertJsonValue(file, payload) && literal(objectProperty(payload, "code")) && literal(objectProperty(payload, "operation"))) emit({ kind: "safe_diagnostic", node: log, concept: fn });
    }
  }
}

function reachesModel(ref: FunctionRef, seen = new Set<ts.Node>(), depth = 0): boolean {
  if (depth >= 8 || seen.has(ref.node)) return false;
  seen.add(ref.node);
  return ref.file.calls.some(call => {
    ref.file.project.tick();
    if (ref.file.enclosing(call) !== ref.node || !ref.file.flow.reachable(call)) return false;
    const origin = ref.file.origin(call.expression);
    if (origin?.module === "ai" && ["generateObject","generateText"].includes(origin.member)) return true;
    const next = ref.file.localFunction(call.expression);
    return !!next && reachesModel(next,seen,depth+1);
  });
}

function model(file: IndexedFile, emit: Emit, corrected: boolean) {
  for (const fn of file.functions) {
    const body = bodyOf(fn); if (!body) continue;
    const statements = [...file.flow.statements(body)];
    for (const call of file.calls.filter(c => file.enclosing(c) === fn)) {
      const origin = file.origin(call.expression), opts = call.arguments[0];
      if (origin?.module !== "ai" || origin.member !== "generateObject" || !awaited(file, call) || call.arguments.length !== 1 || !opts || !ts.isObjectLiteralExpression(opts)) continue;
      const prompt = objectProperty(opts, "prompt"), schema = objectProperty(opts, "schema");
      if (!schema || !zodObject(file, schema) || !objectProperty(opts, "model")) continue;
      const joined = prompt && file.resolveValue(prompt);
      if (joined && ts.isCallExpression(joined) && ts.isPropertyAccessExpression(joined.expression) && joined.expression.name.text === "join"
        && joined.arguments.length === 1 && ts.isStringLiteral(joined.arguments[0])) {
        const mapped = joined.expression.expression;
        if (ts.isCallExpression(mapped) && ts.isPropertyAccessExpression(mapped.expression) && mapped.expression.name.text === "map" && mapped.arguments.length === 1) {
          const mapper = file.localFunction(mapped.arguments[0]), slice = mapped.expression.expression;
          if (mapper && mapper.file === file && mapper.node.parameters.length === 1 && mapper.node.body && ts.isPropertyAccessExpression(mapper.node.body)
            && argument(file, mapper.node, mapper.node.body.expression) && ts.isCallExpression(slice) && ts.isPropertyAccessExpression(slice.expression)
            && slice.expression.name.text === "slice" && argument(file, fn, slice.expression.expression) && slice.arguments.length === 2
            && slice.arguments.every(ts.isNumericLiteral) && +slice.arguments[0].text === 0 && Number.isInteger(+slice.arguments[1].text)
            && +slice.arguments[1].text > 0 && +slice.arguments[1].text <= 20) emit({ kind: "model_context", node: call, concept: fn });
        }
      }
      const result = declaration(statements[0]), guard = statements[1], action = statements[2] && directCall(statements[2]);
      if (!result || unwrap(result.initializer) !== call || !guard || !ts.isIfStatement(guard) || guard.elseStatement
        || !primitiveError(file, guard.thenStatement) || !ts.isPrefixUnaryExpression(guard.expression) || guard.expression.operator !== ts.SyntaxKind.ExclamationToken) continue;
      const includes = guard.expression.operand;
      if (!ts.isCallExpression(includes) || !ts.isPropertyAccessExpression(includes.expression) || includes.expression.name.text !== "includes" || includes.arguments.length !== 1) continue;
      const allow = file.resolveValue(includes.expression.expression), candidate = includes.arguments[0];
      if (ts.isArrayLiteralExpression(allow) && allow.elements.length > 0 && allow.elements.length <= 20 && allow.elements.every(literal)
        && (!corrected || immutableAllowlist(file, includes.expression.expression))
        && memberOf(file, candidate, result.name, ["object", "action"]) && action && action.arguments.length === 1
        && memberOf(file, action.arguments[0], result.name, ["object", "action"])) {
        const target = file.localFunction(action.expression); if (target) emit({ kind: "model_action_guard", node: guard, concept: fn, target });
      }
    }
    // Explicit finite examples, no metric inferred from names or a dependency.
    const cases = declaration(statements[0]), results = declaration(statements[1]), loop = statements[2], ret = statements[3];
    if (!cases || !ts.isArrayLiteralExpression(cases.initializer) || cases.initializer.elements.length < 2 || cases.initializer.elements.length > 100
      || !cases.initializer.elements.every(e => ts.isObjectLiteralExpression(e) && inertJsonValue(file, e) && !!objectProperty(e, "input") && !!objectProperty(e, "expected"))
      || !results || !ts.isArrayLiteralExpression(results.initializer) || results.initializer.elements.length || !loop || !ts.isForOfStatement(loop)
      || !ts.isIdentifier(loop.expression) || !same(file, loop.expression, cases.name) || !ts.isVariableDeclarationList(loop.initializer)
      || !(loop.initializer.flags & ts.NodeFlags.Const) || loop.initializer.declarations.length !== 1 || !ts.isBlock(loop.statement)
      || loop.statement.statements.length !== 2 || !ret || !ts.isReturnStatement(ret) || !ret.expression || !ts.isIdentifier(ret.expression) || !same(file, ret.expression, results.name)) continue;
    const sample = loop.initializer.declarations[0].name, actual = declaration(loop.statement.statements[0]), push = directCall(loop.statement.statements[1]);
    const run = actual && unwrap(actual.initializer);
    if (!ts.isIdentifier(sample) || !actual || !run || !ts.isCallExpression(run) || !awaited(file, run) || run.arguments.length !== 1
      || !memberOf(file, run.arguments[0], sample, ["input"]) || !push || push.arguments.length !== 1 || !memberOf(file, push.expression, results.name, ["push"])) continue;
    const comparison = push.arguments[0];
    if (ts.isBinaryExpression(comparison) && comparison.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isIdentifier(comparison.left)
      && same(file, comparison.left, actual.name) && memberOf(file, comparison.right, sample, ["expected"])) {
      const target = file.localFunction(run.expression); if (target && reachesModel(target)) emit({ kind: "evaluation_harness", node: loop, concept: fn, target });
    }
  }
}
export function rolePatterns(file: IndexedFile, emit: Emit, corrected = true) {
  if (file.input.classification === "test") roleTests(file, emit);
  else { ui(file, emit, corrected); functions(file, emit); model(file, emit, corrected); }
}
