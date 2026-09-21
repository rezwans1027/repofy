import * as ts from "typescript";
import { isAlias, isCollection, isPair, parseDocument } from "yaml";
import { parse as parseToml } from "smol-toml";
import { EXTRACTION_LIMITS as LIMIT, ParseFailure } from "./policy";

export function boundedText(text: string) {
  if (Buffer.byteLength(text) > LIMIT.fileBytes) throw new ParseFailure("limited");
  // A conservative preflight bounds recursive parser work, including malformed input.
  let nesting = 0; let quote = ""; let escaped = false;
  for (const char of text) {
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote) { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if ("[{(".includes(char) && ++nesting > LIMIT.depth) throw new ParseFailure("limited");
    if ("]})".includes(char)) nesting = Math.max(0, nesting - 1);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ParseFailure();
  return value as Record<string, unknown>;
}
export function maybeObject(value: unknown): Record<string, unknown> { return value === undefined ? {} : object(value); }
export function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new ParseFailure(); return value; }
export function boundedTree(value: unknown) {
  const queue = [{ value, depth: 0 }]; let count = 0;
  while (queue.length) {
    const { value: item, depth } = queue.pop()!;
    if (++count > LIMIT.nodes || depth > LIMIT.depth) throw new ParseFailure("limited");
    if (item && typeof item === "object") for (const value of Object.values(item)) queue.push({ value, depth: depth + 1 });
  }
  return value;
}
export function dataDocument(text: string, format: "json" | "yaml" | "toml"): Record<string, unknown> {
  boundedText(text);
  try {
    if (format === "toml") return object(boundedTree(parseToml(text, { maxDepth: LIMIT.depth })));
    if (format === "json") JSON.parse(text); // YAML must not broaden JSON syntax.
    if (text.split("\n").some(line => /^(?: {129}|\t)/.test(line))) throw new ParseFailure("limited");
    const doc = parseDocument(text, { version: "1.2", schema: "core", uniqueKeys: true, stringKeys: true,
      prettyErrors: false, logLevel: "silent", strict: true });
    if (doc.errors.length || doc.warnings.length) throw new ParseFailure();
    const queue: { value: unknown; depth: number }[] = [{ value: doc.contents, depth: 0 }]; let nodes = 0;
    while (queue.length) {
      const { value, depth } = queue.pop()!;
      if (++nodes > LIMIT.nodes || depth > LIMIT.depth) throw new ParseFailure("limited");
      // No aliases, custom tags or merge expansion. Record unsupported instead of guessing.
      if (isAlias(value) || (value && typeof value === "object" && "tag" in value && value.tag)) throw new ParseFailure("unsupported");
      if (isCollection(value)) for (const item of value.items) queue.push({ value: item, depth: depth + 1 });
      if (isPair(value)) queue.push({ value: value.key, depth: depth + 1 }, { value: value.value, depth: depth + 1 });
    }
    return object(boundedTree(doc.toJS({ maxAliasCount: 0 })));
  } catch (error) { if (error instanceof ParseFailure) throw error; throw new ParseFailure(); }
}
export function sourceFile(text: string, path: string) {
  boundedText(text);
  try {
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false,
      /\.[jt]sx$/.test(path) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    if ((file as ts.SourceFile & { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length) throw new ParseFailure();
    let count = 0; const queue: { node: ts.Node; depth: number }[] = [{ node: file, depth: 0 }];
    while (queue.length) {
      const { node, depth } = queue.pop()!;
      if (++count > LIMIT.nodes || depth > LIMIT.depth) throw new ParseFailure("limited");
      ts.forEachChild(node, child => { queue.push({ node: child, depth: depth + 1 }); });
    }
    return file;
  } catch (error) { if (error instanceof ParseFailure) throw error; throw new ParseFailure(); }
}
export function walk(file: ts.Node, use: (node: ts.Node) => void) {
  const queue = [file]; while (queue.length) { const node = queue.pop()!; use(node); ts.forEachChild(node, child => { queue.push(child); }); }
}
