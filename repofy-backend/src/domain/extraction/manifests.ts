import type { StructuralObservation } from "@repofy/contracts";
import { array, dataDocument, maybeObject, object } from "./parsers";
import { detail, extractor, ParseFailure, type ExtractionResult } from "./policy";

const known: Record<string, StructuralObservation["technologies"][number]> = {
  react: "react", next: "next", express: "express", vue: "vue", "@angular/core": "angular", svelte: "svelte", "@nestjs/core": "nestjs",
  "react-native": "react_native", expo: "expo", typescript: "typescript", jest: "jest", vitest: "vitest", mocha: "mocha",
  "@playwright/test": "playwright", playwright: "playwright", cypress: "cypress", pytest: "pytest", django: "django", fastapi: "fastapi", flask: "flask", "@prisma/client": "prisma", prisma: "prisma",
};
export const technology = (name: string) => Object.hasOwn(known, name.toLowerCase()) ? known[name.toLowerCase()] : undefined;
export const manifests = extractor("manifests", ["package.json", "npm lock v2/v3", "pnpm lock v6/v9", "requirements.txt", "pyproject.toml"], input => {
  const base = input.path.split("/").at(-1)!;
  const counts = { production: 0, development: 0, optional: 0, peer: 0, transitive: 0, workspace: 0, unknown: 0, aliased: 0, packages: 0, workspacePatterns: 0, scripts: 0 };
  const technologies: StructuralObservation["technologies"] = []; const limits: string[] = [];
  let project = false; const patterns: string[] = []; const direct = new Set<string>();
  const add = (name: string, value: unknown, scope: "production" | "development" | "optional" | "peer" | "unknown") => {
    if (typeof value !== "string") throw new ParseFailure();
    counts[scope]++; direct.add(name);
    let resolved = name;
    if (value.startsWith("npm:")) { counts.aliased++; resolved = value.slice(4).replace(/@[^@]*$/, ""); }
    if (/^(?:workspace:|link:|file:)/.test(value)) { counts.workspace++; return; }
    const tech = technology(resolved); if (tech) technologies.push(tech);
  };
  const group = (value: unknown, scope: Parameters<typeof add>[2]) => {
    for (const [name, version] of Object.entries(maybeObject(value))) add(name, version, scope);
  };
  if (base === "package.json") {
    const doc = dataDocument(input.text, "json"); project = true;
    for (const [field, scope] of [["dependencies", "production"], ["devDependencies", "development"], ["optionalDependencies", "optional"], ["peerDependencies", "peer"]] as const) group(doc[field], scope);
    const workspaces = Array.isArray(doc.workspaces) ? doc.workspaces : maybeObject(doc.workspaces).packages;
    if (workspaces !== undefined) for (const value of array(workspaces)) {
      if (typeof value !== "string" || value.length > 256) throw new ParseFailure(); patterns.push(value);
    }
    counts.workspacePatterns = patterns.length; counts.scripts = Object.keys(maybeObject(doc.scripts)).length;
    limits.push("Dependency scopes may overlap. Workspace membership is a declaration; nested projects are inventoried independently.");
  } else if (["package-lock.json", "npm-shrinkwrap.json"].includes(base)) {
    const doc = dataDocument(input.text, "json");
    if (![2, 3].includes(doc.lockfileVersion as number)) throw new ParseFailure("unsupported");
    const packages = object(doc.packages); const root = maybeObject(packages[""]);
    group(root.dependencies, "production"); group(root.devDependencies, "development"); group(root.optionalDependencies, "optional"); group(root.peerDependencies, "peer");
    for (const [path, raw] of Object.entries(packages)) {
      if (!path) continue;
      const item = object(raw); counts.packages++;
      if (item.link === true || !path.includes("node_modules/")) { counts.workspace++; continue; }
      const name = path.split("node_modules/").at(-1)!;
      if (!direct.has(name) || path.indexOf("node_modules/") !== path.lastIndexOf("node_modules/")) counts.transitive++;
    }
    limits.push("Resolved packages are lockfile records, not installed or executed packages. Root declarations define direct scopes.");
  } else if (base === "pnpm-lock.yaml") {
    const doc = dataDocument(input.text, "yaml");
    if (!["6.0", "9.0", "6", "9"].includes(String(doc.lockfileVersion))) throw new ParseFailure("unsupported");
    const importers = doc.importers === undefined ? { ".": doc } : object(doc.importers);
    for (const raw of Object.values(importers)) {
      const importer = object(raw);
      for (const [field, scope] of [["dependencies", "production"], ["devDependencies", "development"], ["optionalDependencies", "optional"]] as const) {
        for (const [name, rawValue] of Object.entries(maybeObject(importer[field]))) {
          const value = typeof rawValue === "string" ? rawValue : object(rawValue).specifier;
          add(name, value, scope);
        }
      }
    }
    for (const name of Object.keys(maybeObject(doc.packages))) {
      counts.packages++; const normalized = name.replace(/^\//, "").replace(/\(.*/, "").replace(/@[^@]*$/, "");
      if (!direct.has(normalized)) counts.transitive++;
    }
    limits.push("Transitive counts are resolved package records absent from all importer declarations; peer resolution is not evaluated.");
  } else if (/^requirements(?:[-.][a-z]+)?\.txt$/.test(base)) {
    const scope = /(?:dev|test)/.test(base) ? "development" : "production";
    for (const line of input.text.split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"))) {
      const match = /^([a-zA-Z0-9][a-zA-Z0-9_.-]*)(?:\[[a-zA-Z0-9_, -]+\])?\s*(?:[<>=!~;#].*)?$/.exec(line);
      if (!match) throw new ParseFailure("unsupported"); add(match[1], "declared", scope);
    }
    limits.push("Environment markers and version resolution are not evaluated; recursive requirements and URLs are unsupported.");
  } else if (base === "pyproject.toml") {
    const doc = dataDocument(input.text, "toml"); project = true;
    const projectDoc = maybeObject(doc.project);
    const requirements = (value: unknown, scope: Parameters<typeof add>[2]) => {
      if (value === undefined) return;
      for (const raw of array(value)) {
        if (typeof raw !== "string") throw new ParseFailure("unsupported");
        const match = /^([a-zA-Z0-9][a-zA-Z0-9_.-]*)(?:\[|\s|[<>=!~;]|$)/.exec(raw);
        if (!match) throw new ParseFailure("unsupported"); add(match[1], "declared", scope);
      }
    };
    requirements(projectDoc.dependencies, "production");
    for (const group of Object.values(maybeObject(projectDoc["optional-dependencies"]))) requirements(group, "optional");
    for (const group of Object.values(maybeObject(doc["dependency-groups"]))) requirements(group, "development");
    if (projectDoc.dynamic !== undefined || maybeObject(doc.tool).poetry !== undefined) limits.push("Dynamic and Poetry-specific dependency declarations are unsupported.");
    if (!projectDoc.dependencies && !projectDoc["optional-dependencies"] && !doc["dependency-groups"]) throw new ParseFailure("unsupported");
  } else throw new ParseFailure("unsupported");
  const result: ExtractionResult = { state: "analyzed", project, workspacePatterns: patterns,
    findings: [{ sourceType: "dependency", observation: "A dependency manifest or lockfile declares package and project structure.",
      detail: detail("dependency", "parsed_declaration", "dependency_presence", counts, technologies,
        ["Dependency presence does not demonstrate implementation or proficiency. Arbitrary dependency names and versions are omitted.", ...limits]) }] };
  return result;
});
