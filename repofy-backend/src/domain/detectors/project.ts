import * as ts from "typescript";
import { sourceFile, dataDocument } from "../extraction/parsers";
import { ParseFailure } from "../extraction/policy";
import { directory } from "../extraction/inventory";
import { DETECTOR_LIMITS as LIMIT } from "./registry";
import { ControlFlow } from "./control-flow";

export type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
export const isFunction = (n: ts.Node): n is FunctionNode => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n);
export function unwrap(n: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n) || ts.isAwaitExpression(n)) n = n.expression;
  return n;
}
export function rootIdentifier(n: ts.Node): ts.Identifier | undefined {
  if (ts.isIdentifier(n)) return n;
  if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isParenthesizedExpression(n)
    || ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n)) return rootIdentifier(n.expression);
  return undefined;
}
interface Scope { parent?: Scope; declarations: Map<string, Binding | null>; functionScope?: boolean }
export interface Binding { name: string; node: ts.Node; scope: Scope; initializer?: ts.Expression;
  imported?: { source: string; name: string; typeOnly: boolean }; written: boolean; mutable: boolean }
export interface SourceInput { path: string; text: string; fileId: string; classification: string }
export interface Origin { module: string; member: string }
export interface FunctionRef { file: IndexedFile; node: FunctionNode }
export interface IndexStats { unresolvedImports: number; dynamicReferences: number; ambiguousBindings: number; aliasConfigurationsRejected: number; indexedNodes: number; indexedBytes: number }

export class IndexedFile {
  readonly ast: ts.SourceFile;
  readonly nodes: ts.Node[] = [];
  readonly calls: ts.CallExpression[] = [];
  readonly functions: FunctionNode[] = [];
  readonly parents = new Map<ts.Node, ts.Node>();
  readonly scopes = new Map<ts.Node, Scope>();
  readonly bindings: Binding[] = [];
  readonly references = new Map<Binding, ts.Identifier[]>();
  readonly exports = new Map<string, Binding | null>();
  readonly root: Scope = { declarations: new Map(), functionScope: true };
  readonly flow = new ControlFlow(this.parents, () => this.project.tick());
  constructor(readonly input: SourceInput, readonly project: ProjectIndex) {
    const started = performance.now(); this.ast = sourceFile(input.text, input.path);
    const stack: { node: ts.Node; scope: Scope; parent?: ts.Node }[] = [{ node: this.ast, scope: this.root }];
    const bind = (name: ts.Identifier, node: ts.Node, scope: Scope, extra: Partial<Binding> = {}) => {
      const b: Binding = { name: name.text, node, scope, written: false, mutable: false, ...extra };
      this.bindings.push(b);
      if (scope.declarations.has(b.name)) { scope.declarations.set(b.name, null); project.stats.ambiguousBindings++; }
      else scope.declarations.set(b.name, b);
      return b;
    };
    while (stack.length) {
      const { node, scope: outer, parent } = stack.pop()!;
      if (parent) this.parents.set(node, parent);
      if (++project.stats.indexedNodes > LIMIT.nodes || performance.now() - started > LIMIT.fileMs) throw new ParseFailure("limited");
      this.nodes.push(node); if (ts.isCallExpression(node)) this.calls.push(node);
      let scope = outer;
      if (ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)) {
        if (ts.isFunctionDeclaration(node) && node.name) bind(node.name, node, outer);
        scope = { parent: outer, declarations: new Map(), functionScope: true };
        if (isFunction(node)) this.functions.push(node);
        if (ts.isFunctionExpression(node) && node.name) bind(node.name, node, scope);
      } else if (ts.isBlock(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)
        || ts.isCatchClause(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) scope = { parent: outer, declarations: new Map() };
      // A class expression's name exists only inside that class, including its
      // methods, field initializers and heritage. It must shadow outer imports.
      if (ts.isClassExpression(node) && node.name) bind(node.name, node, scope);
      this.scopes.set(node, scope);
      if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
        const isConst = !!parent && ts.isVariableDeclarationList(parent) && !!(parent.flags & ts.NodeFlags.Const);
        // var is hoisted to the containing function/module even inside a block,
        // loop or catch. Keep identifier lookup in its lexical scope, but install
        // the declaration in that function scope so local shadows fail closed.
        let declarationScope = scope;
        if (parent && ts.isVariableDeclarationList(parent) && !(parent.flags & ts.NodeFlags.BlockScoped)) {
          while (!declarationScope.functionScope && declarationScope.parent) declarationScope = declarationScope.parent;
        }
        if (ts.isIdentifier(node.name)) bind(node.name, node, declarationScope, { initializer: node.initializer, mutable: !isConst && !ts.isParameter(node) });
        else {
          const elements = [...node.name.elements];
          while (elements.length) {
            const element = elements.pop()!; if (!ts.isBindingElement(element)) continue;
            if (!ts.isIdentifier(element.name)) { elements.push(...element.name.elements); continue; }
            const b = bind(element.name, element, declarationScope, { mutable: !isConst && !ts.isParameter(node) });
            // Literal destructured CommonJS imports only; React tuple bindings are inspected separately.
            if (node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)
              && node.initializer.expression.text === "require" && node.initializer.arguments.length === 1
              && ts.isStringLiteral(node.initializer.arguments[0]) && ts.isObjectBindingPattern(node.name) && node.name.elements.includes(element) && !element.dotDotDotToken
              && (!element.propertyName || ts.isIdentifier(element.propertyName))) {
              b.imported = { source: node.initializer.arguments[0].text, name: element.propertyName?.getText(this.ast) ?? element.name.text, typeOnly: false };
            }
          }
        }
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
        const clause = node.importClause; const source = node.moduleSpecifier.text;
        if (clause.name) bind(clause.name, clause, scope, { imported: { source, name: "default", typeOnly: clause.isTypeOnly } });
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bind(clause.namedBindings.name, clause.namedBindings, scope,
          { imported: { source, name: "*", typeOnly: clause.isTypeOnly } });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const specifier of clause.namedBindings.elements) {
          bind(specifier.name, specifier, scope, { imported: { source, name: specifier.propertyName?.text ?? specifier.name.text, typeOnly: clause.isTypeOnly || specifier.isTypeOnly } });
        }
      }
      if ((ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) bind(node.name, node, outer);
      const children: ts.Node[] = []; ts.forEachChild(node, child => { children.push(child); });
      for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], scope, parent: node });
    }
    for (const node of this.nodes) {
      if (ts.isIdentifier(node)) {
        const parent = this.parents.get(node);
        if (!(parent && ts.isPropertyAccessExpression(parent) && parent.name === node)) {
          const b = this.binding(node); if (b) { const references = this.references.get(b) ?? []; references.push(node); this.references.set(b, references); }
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) this.markAssignment(node.left);
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) this.markAssignment(node.initializer);
      let written: ts.Node | undefined;
      if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) written = node.operand;
      if (ts.isDeleteExpression(node)) written = node.expression;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && ["Object", "Reflect"].includes(node.expression.expression.text) && ["assign", "defineProperty", "defineProperties", "set", "deleteProperty"].includes(node.expression.name.text)) written = node.arguments[0];
      if (written) this.markWritten(written);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "eval"
        || ts.isIdentifier(node.expression) && node.expression.text === "require" && !node.arguments.every(ts.isStringLiteral))) project.stats.dynamicReferences++;
      if (ts.isWithStatement(node)) project.stats.dynamicReferences++;
      if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause) && !node.isTypeOnly) {
        for (const specifier of node.exportClause.elements) {
          const name = specifier.propertyName ?? specifier.name;
          if (!specifier.isTypeOnly && ts.isIdentifier(name)) this.addExport(specifier.name.text, this.binding(name));
        }
      }
    }
    // A write through a simple local alias invalidates the original object too.
    for (let depth = 0; depth < LIMIT.resolutionDepth; depth++) {
      let changed = false;
      for (const b of this.bindings) if (b.written && b.initializer) {
        const value = unwrap(b.initializer); const original = ts.isIdentifier(value) && this.binding(value);
        if (original && !original.written) { original.written = true; changed = true; }
      }
      if (!changed) break;
    }
    for (const statement of this.ast.statements) {
      const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (exported && ts.isFunctionDeclaration(statement) && statement.name) this.addExport(
        ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ? "default" : statement.name.text, this.root.declarations.get(statement.name.text) ?? undefined);
      if (exported && ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) this.addExport(d.name.text, this.binding(d.name));
      if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression) && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const { left, right } = statement.expression;
        if (ts.isPropertyAccessExpression(left) && ts.isIdentifier(right)) {
          const base = left.expression;
          if (ts.isIdentifier(base) && base.text === "exports" && !this.hasBinding(base)) this.addExport(left.name.text, this.binding(right));
          if (ts.isPropertyAccessExpression(base) && base.name.text === "exports" && ts.isIdentifier(base.expression)
            && base.expression.text === "module" && !this.hasBinding(base.expression)) this.addExport(left.name.text, this.binding(right));
        }
      }
    }
    // A lexical require or dynamic evaluation invalidates CommonJS assumptions.
    for (const b of this.bindings) if (b.imported && ts.isBindingElement(b.node)) {
      const pattern = this.parents.get(b.node); const declaration = pattern && this.parents.get(pattern);
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isCallExpression(declaration.initializer)
        && ts.isIdentifier(declaration.initializer.expression) && this.hasBinding(declaration.initializer.expression)) b.imported = undefined;
    }
  }
  private markWritten(node: ts.Node) {
    const root = rootIdentifier(node), binding = root && this.binding(root);
    if (binding) binding.written = true;
  }
  private markAssignment(target: ts.Node) {
    // Visit write targets only: defaults, computed property names and ordinary
    // object values can read a library binding without mutating it.
    const pending = [target];
    while (pending.length) {
      this.project.tick();
      const node = pending.pop()!;
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          if (ts.isPropertyAssignment(property)) pending.push(property.initializer);
          else if (ts.isShorthandPropertyAssignment(property)) pending.push(property.name);
          else if (ts.isSpreadAssignment(property)) pending.push(property.expression);
        }
      } else if (ts.isArrayLiteralExpression(node)) pending.push(...node.elements);
      else if (ts.isSpreadElement(node)) pending.push(node.expression);
      else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) pending.push(node.left);
      else this.markWritten(node);
    }
  }
  private addExport(name: string, binding: Binding | undefined) { this.exports.set(name, this.exports.has(name) ? null : binding ?? null); }
  hasBinding(node: ts.Identifier): boolean { let scope = this.scopes.get(node); while (scope) { if (scope.declarations.has(node.text)) return true; scope = scope.parent; } return false; }
  binding(node: ts.Identifier): Binding | undefined {
    let scope = this.scopes.get(node); while (scope) { if (scope.declarations.has(node.text)) return scope.declarations.get(node.text) ?? undefined; scope = scope.parent; } return undefined;
  }
  enclosing(node: ts.Node): FunctionNode | undefined { let n: ts.Node | undefined = node; while (n) { if (isFunction(n)) return n; n = this.parents.get(n); } return undefined; }
  contains(root: ts.Node, child: ts.Node) { return root.pos <= child.pos && root.end >= child.end; }
  span(node: ts.Node) { const start = this.ast.getLineAndCharacterOfPosition(node.getStart(this.ast)); const end = this.ast.getLineAndCharacterOfPosition(node.getEnd());
    return { lines: { start: start.line + 1, end: end.line + 1 }, startColumn: start.character + 1, endColumn: end.character + 1 }; }
  /** No strings, comments, names or literal values in a clone-shape key. Its use is conservative deduplication only. */
  shape(node: ts.Node) { return this.nodes.filter(n => this.contains(node, n)).map(n => n.kind).join(","); }
  resolveValue(expression: ts.Expression, depth = 0): ts.Expression {
    this.project.tick(); const node = unwrap(expression); if (depth >= LIMIT.resolutionDepth) return node;
    if (ts.isIdentifier(node)) { const b = this.binding(node); if (b && !b.written && !b.mutable && b.initializer && this.flow.reachable(b.initializer)) return this.resolveValue(b.initializer, depth + 1); }
    return node;
  }
  origin(expression: ts.Expression, depth = 0): Origin | undefined {
    this.project.tick(); if (depth >= LIMIT.resolutionDepth) return undefined; const node = unwrap(expression);
    if (!this.flow.reachable(node)) return undefined;
    if (ts.isIdentifier(node)) {
      const b = this.binding(node); if (!b || b.written || b.mutable) return undefined;
      if (b.imported && !b.imported.typeOnly) {
        const target = this.project.resolve(this.input.path, b.imported.source);
        if (target) { const file = this.project.files.get(target); const exported = file?.exports.get(b.imported.name);
          if (file && exported && !exported.written && !exported.mutable && exported.initializer) return file.origin(exported.initializer, depth + 1);
          return undefined;
        }
        if (!this.project.isExternal(this.input.path, b.imported.source)) return undefined;
        return { module: b.imported.source, member: b.imported.name };
      }
      return b.initializer ? this.origin(b.initializer, depth + 1) : undefined;
    }
    if (ts.isPropertyAccessExpression(node) && !node.questionDotToken) { const base = this.origin(node.expression, depth + 1);
      return base ? { ...base, member: base.member === "*" ? node.name.text : `${base.member}.${node.name.text}` } : undefined; }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require" && !this.hasBinding(node.expression)
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        if (this.project.resolve(this.input.path, node.arguments[0].text) || !this.project.isExternal(this.input.path, node.arguments[0].text)) return undefined;
        return { module: node.arguments[0].text, member: "*" };
      }
      const base = this.origin(node.expression, depth + 1); return base ? { ...base, member: `${base.member}()` } : undefined;
    }
    return undefined;
  }
  localFunction(expression: ts.Expression, depth = 0): FunctionRef | undefined {
    this.project.tick(); if (depth >= LIMIT.resolutionDepth) return undefined; const node = unwrap(expression);
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return this.flow.reachable(node) ? { file: this, node } : undefined;
    if (ts.isIdentifier(node)) {
      const b = this.binding(node); if (!b || b.written || b.mutable) return undefined;
      if (isFunction(b.node) && b.node.body) return this.flow.reachable(b.node) ? { file: this, node: b.node } : undefined;
      if (b.imported && !b.imported.typeOnly) {
        const target = this.project.resolve(this.input.path, b.imported.source); const file = target && this.project.files.get(target); const exported = file && file.exports.get(b.imported.name);
        if (file && exported && !exported.written && !exported.mutable) {
          if (isFunction(exported.node) && exported.node.body) return file.flow.reachable(exported.node) ? { file, node: exported.node } : undefined;
          if (exported.initializer) return file.localFunction(exported.initializer, depth + 1);
        }
      }
      if (b.initializer) return this.localFunction(b.initializer, depth + 1);
    }
    return undefined;
  }
}

function normalize(from: string, relative: string): string | undefined {
  if (!relative || /[\\:\x00-\x1f]/.test(relative) || relative.startsWith("/")) return undefined;
  const parts = from.split("/").filter(Boolean);
  for (const part of relative.split("/")) { if (part === "..") { if (!parts.length) return undefined; parts.pop(); } else if (part && part !== ".") parts.push(part); }
  return parts.join("/");
}
type Aliases = { base: string; paths: [string, string][] } | null;
export class ProjectIndex {
  readonly files = new Map<string, IndexedFile>();
  readonly aliases = new Map<string, Aliases>();
  readonly stats: IndexStats = { unresolvedImports: 0, dynamicReferences: 0, ambiguousBindings: 0, aliasConfigurationsRejected: 0, indexedNodes: 0, indexedBytes: 0 };
  private steps = 0;
  tick(cost = 1) { if ((this.steps += cost) > LIMIT.graphSteps) throw new ParseFailure("limited"); }
  resetTraversal() { this.steps = 0; }
  add(input: SourceInput) {
    if (this.files.size >= LIMIT.files || this.stats.indexedBytes + Buffer.byteLength(input.text) > LIMIT.bytes || this.stats.indexedNodes >= LIMIT.nodes) throw new ParseFailure("limited");
    this.stats.indexedBytes += Buffer.byteLength(input.text); const file = new IndexedFile(input, this); this.files.set(input.path, file); return file;
  }
  addConfig(path: string, text: string) {
    const dir = directory(path); const duplicate = this.aliases.has(dir); this.aliases.set(dir, null);
    try {
      if (duplicate || this.aliases.size > LIMIT.aliasConfigs) throw new ParseFailure("limited");
      const config = dataDocument(text, "json"); const options = (config.compilerOptions ?? {}) as Record<string, unknown>;
      if (config.extends || config.references || !options || typeof options !== "object" || Array.isArray(options)
        || options.plugins || options.moduleSuffixes || options.rootDirs) throw new ParseFailure("unsupported");
      if (options.paths === undefined && options.baseUrl === undefined) { this.aliases.set(dir, { base: dir, paths: [] }); return; }
      if (typeof options.baseUrl !== "string" || !options.paths || typeof options.paths !== "object" || Array.isArray(options.paths)) throw new ParseFailure("unsupported");
      const base = normalize(dir, options.baseUrl); if (base === undefined) throw new ParseFailure();
      const paths: [string, string][] = [];
      for (const [key, values] of Object.entries(options.paths)) {
        if (paths.length >= 32 || !/^[\w@./*-]+$/.test(key) || key.split("*").length > 2 || !Array.isArray(values) || values.length !== 1
          || typeof values[0] !== "string" || values[0].split("*").length !== key.split("*").length
          || normalize(base, values[0].replace("*", "placeholder")) === undefined) throw new ParseFailure("unsupported");
        paths.push([key, values[0]]);
      }
      this.aliases.set(dir, { base, paths });
    } catch { this.stats.aliasConfigurationsRejected++; }
  }
  private configuration(from: string) { let dir = directory(from); while (true) { if (this.aliases.has(dir)) return this.aliases.get(dir); if (!dir) return undefined; dir = directory(dir.slice(0, -1)); } }
  /** Literal external identity is supported statically; runtime package behavior remains unverified. */
  isExternal(from: string, name: string) {
    return name.length > 0 && !/^[./#]|\\/.test(name) && (!name.includes(":") || name.startsWith("node:"))
      && !this.isAlias(from, name) && this.configuration(from) !== null;
  }
  private aliasMatches(from: string, name: string) {
    const config = this.configuration(from); if (!config) return [];
    return config.paths.flatMap(([key, target]) => {
      if (!key.includes("*")) return key === name ? [normalize(config.base, target)] : [];
      const [start, end] = key.split("*"); if (!name.startsWith(start) || !name.endsWith(end) || name.length < start.length + end.length) return [];
      return [normalize(config.base, target.replace("*", name.slice(start.length, name.length - end.length)))];
    }).filter((p): p is string => p !== undefined);
  }
  isAlias(from: string, name: string) { return this.aliasMatches(from, name).length > 0; }
  resolve(from: string, name: string) {
    this.tick(); const aliases = name.startsWith(".") ? [normalize(directory(from), name)] : this.aliasMatches(from, name);
    if (aliases.length !== 1 || aliases[0] === undefined) return undefined;
    const base = aliases[0]; const paths = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"].map(e => base + e)];
    if (/\.[cm]?js$/.test(base)) paths.push(base.replace(/js$/, "ts"));
    const matches = [...new Set(paths)].filter(path => this.files.has(path)); return matches.length === 1 ? matches[0] : undefined;
  }
  finish() {
    for (const file of this.files.values()) for (const b of file.bindings) {
      if (b.imported && !b.imported.typeOnly && !this.resolve(file.input.path, b.imported.source)
        && !this.isExternal(file.input.path, b.imported.source)) this.stats.unresolvedImports++;
    }
    this.resetTraversal();
  }
}
