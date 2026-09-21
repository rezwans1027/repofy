import * as ts from "typescript";
import type { StructuralObservation } from "@repofy/contracts";
import { array, dataDocument, maybeObject, object, sourceFile, walk } from "./parsers";
import { detail, extractor, ParseFailure, type Finding } from "./policy";

const result = (finding: Finding) => ({ state: "analyzed" as const, findings: [finding] });
export const configuration = extractor("configuration", ["JSON", "YAML 1.2 without aliases", "TOML", "static JS/TS config", "Dockerfile"], input => {
  const base = input.path.split("/").at(-1)!.toLowerCase();
  if (input.language === "dockerfile") {
    const lines = input.text.replace(/\\\n/g, " ").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
    const instructions = lines.map(line => line.split(/\s/)[0].toUpperCase());
    if (instructions.some(word => !["FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL", "MAINTAINER"].includes(word))) throw new ParseFailure("unsupported");
    return result({ sourceType: "config", observation: "Container build instructions are present.", detail: detail("container", "static_syntax", "configuration_presence",
      { instructions: instructions.length, stages: instructions.filter(s => s === "FROM").length }, [], ["The image was not built and no runtime or deployment result was verified."]) });
  }
  const technologies: StructuralObservation["technologies"] = [];
  const tech = /^(next|vitest|jest|playwright|cypress)\.config\./.exec(base)?.[1] as StructuralObservation["technologies"][number] | undefined;
  if (tech) technologies.push(tech);
  let ambiguous = false;
  if (["json", "yaml", "toml"].includes(input.language)) dataDocument(input.text, input.language as "json" | "yaml" | "toml");
  else if (["typescript", "javascript"].includes(input.language)) {
    const file = sourceFile(input.text, input.path); let objects = 0;
    walk(file, node => { if (ts.isObjectLiteralExpression(node)) objects++;
      if (ts.isCallExpression(node) || ts.isSpreadAssignment(node) || ts.isComputedPropertyName(node)) ambiguous = true; });
    if (!objects) ambiguous = true;
  } else throw new ParseFailure("unsupported");
  const deployment = /^(?:vercel\.json|netlify\.toml|render\.ya?ml|(?:docker-)?compose\.ya?ml)$/.test(base)
    || /(?:^|\/)(?:k8s|kubernetes|deploy)(?:\/)/.test(input.path);
  return { ...result({ sourceType: "config", observation: deployment ? "A deployment configuration document is present." : "A configuration document is present.",
    detail: detail(deployment ? "deployment" : "configuration", ["typescript", "javascript"].includes(input.language) ? "static_syntax" : "parsed_declaration", "configuration_presence", {}, technologies,
      ["No configuration modules were imported or executed; effective runtime settings and successful deployment are not established.",
        ...(ambiguous ? ["Configuration is dynamic or ambiguous; effective values were not resolved."] : [])]) }), reasons: ambiguous ? ["dynamic_configuration"] : [] };
});
export const ci = extractor("ci", ["GitHub Actions YAML"], input => {
  if (!/^\.github\/workflows\/[^/]+\.ya?ml$/.test(input.path)) throw new ParseFailure("unsupported");
  const doc = dataDocument(input.text, "yaml"); const jobs = object(doc.jobs);
  if (doc.on === undefined || !Object.keys(jobs).length) throw new ParseFailure();
  const counts = { jobs: 0, steps: 0, testCommands: 0, conditionalJobs: 0, skipped: 0 };
  for (const raw of Object.values(jobs)) {
    const job = object(raw); counts.jobs++;
    if (job.if !== undefined) counts.conditionalJobs++;
    if (job.if === false || job.if === "false" || (typeof job.if === "string" && /^\$\{\{\s*false\s*\}\}$/.test(job.if))) counts.skipped++;
    if (job.steps === undefined) { if (typeof job.uses !== "string") throw new ParseFailure(); continue; }
    for (const rawStep of array(job.steps)) {
      const step = object(rawStep); counts.steps++;
      if (typeof step.run === "string") for (const line of step.run.split("\n")) {
        if (/^\s*(?:(?:npm|pnpm|yarn)\s+(?:run\s+)?test(?:\s|$)|(?:npx\s+)?(?:vitest|jest|pytest|playwright\s+test)(?:\s|$))/.test(line)) counts.testCommands++;
      }
    }
  }
  return result({ sourceType: "ci", observation: "A workflow declares automated jobs and steps.", detail: detail("workflow", "parsed_declaration", "configuration_presence", counts, [],
    ["Commands and conditions are static configuration. This does not establish workflow enablement, execution, passing tests, critical-path coverage or deployment success."]) });
});

/** Remove SQL comments, literals, quoted identifiers and dollar-quoted bodies before structural matching. */
export function sqlStructure(text: string): string {
  let out = ""; let index = 0;
  while (index < text.length) {
    if (text.startsWith("--", index)) { const end = text.indexOf("\n", index); index = end < 0 ? text.length : end; out += " "; continue; }
    if (text.startsWith("/*", index)) {
      let depth = 1; index += 2;
      while (index < text.length && depth) { if (text.startsWith("/*", index)) { depth++; index += 2; } else if (text.startsWith("*/", index)) { depth--; index += 2; } else index++; }
      if (depth) throw new ParseFailure(); out += " "; continue;
    }
    const char = text[index];
    if (char === "'" || char === '"') {
      index++; let closed = false;
      while (index < text.length) { if (text[index] === char) { if (text[index + 1] === char) { index += 2; continue; } index++; closed = true; break; } if (text[index] === "\\") index++; index++; }
      if (!closed) throw new ParseFailure(); out += " value "; continue;
    }
    if (char === "$") {
      const tag = /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(text.slice(index))?.[0];
      if (tag) { const end = text.indexOf(tag, index + tag.length); if (end < 0) throw new ParseFailure(); index = end + tag.length; out += " value "; continue; }
    }
    out += char; index++;
  }
  return out;
}
/** Prisma uses // documentation/line comments and double-quoted strings, not
 * SQL's single-quoted literals. Mask these tokens before counting declarations. */
function prismaStructure(text: string): string {
  let out = ""; let index = 0;
  while (index < text.length) {
    if (text.startsWith("//", index)) {
      const end = text.indexOf("\n", index); index = end < 0 ? text.length : end; out += " "; continue;
    }
    if (text.startsWith("/*", index)) {
      const end = text.indexOf("*/", index + 2);
      if (end < 0 || text.slice(index + 2, end).includes("/*")) throw new ParseFailure();
      out += text.slice(index, end + 2).replace(/[^\r\n]/g, " "); index = end + 2; continue;
    }
    if (text[index] === '"') {
      index++; let closed = false;
      while (index < text.length) {
        if (text[index] === '"') { index++; closed = true; break; }
        if (text[index] === "\n" || text[index] === "\r") throw new ParseFailure();
        if (text[index] === "\\") {
          index++;
          if (index >= text.length || text[index] === "\n" || text[index] === "\r") throw new ParseFailure();
        }
        index++;
      }
      // A string cannot become an identifier when the surrounding structure is matched.
      if (!closed) throw new ParseFailure(); out += ' "" '; continue;
    }
    if (text[index] === "'" || text.startsWith("*/", index)) throw new ParseFailure();
    out += text[index++];
  }
  return out;
}
export const schemas = extractor("schemas", ["SQL DDL token structure", "Prisma schema declarations"], input => {
  const text = input.language === "prisma" ? prismaStructure(input.text) : sqlStructure(input.text); let counts: StructuralObservation["counts"];
  if (input.language === "prisma") counts = { models: (text.match(/\bmodel\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/g) ?? []).length };
  else counts = { tables: (text.match(/(?:^|;)\s*create\s+(?:(?:temporary|temp|unlogged)\s+)?table\b/gi) ?? []).length,
    indexes: (text.match(/(?:^|;)\s*create\s+(?:unique\s+)?index\b/gi) ?? []).length,
    alterations: (text.match(/(?:^|;)\s*alter\s+table\b/gi) ?? []).length };
  return { state: "analyzed", findings: Object.values(counts).some(Boolean) ? [{ sourceType: "code", observation: "Static schema declarations describe database structure.",
    detail: detail("schema", "static_syntax", "schema_structure_only", counts, input.language === "prisma" ? ["prisma"] : [],
      ["This bounded lexical inspection does not validate SQL dialect semantics, migration execution, data integrity or production operation."]) } as Finding] : [] };
});
export const documentation = extractor("documentation", ["Markdown", "README and architecture text"], input => {
  const withoutFences = input.text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "");
  const headings = withoutFences.split("\n").filter(line => /^#{1,6}\s+\S/.test(line));
  const counts = { headings: headings.length, links: (withoutFences.match(/\[[^\]\n]{1,1000}\]\([^\)\n]{1,2000}\)/g) ?? []).length,
    codeBlocks: (input.text.match(/^\s*(?:`{3,}|~{3,})/gm) ?? []).length / 2,
    architectureHeadings: headings.filter(line => /\b(?:architecture|design|decision|adr)\b/i.test(line)).length };
  counts.codeBlocks = Math.floor(counts.codeBlocks);
  return result({ sourceType: "docs", observation: "Documentation contains structural documentation elements.", detail: detail("documentation", "static_syntax", "documentation_only", counts, [],
    ["Prose is untrusted and was not copied into evidence. Documentation claims do not prove implementation, testing, authorship or operation."]) });
});
