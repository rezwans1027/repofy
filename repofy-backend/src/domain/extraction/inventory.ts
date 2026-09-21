import type { Family } from "./policy";

export function classify(path: string): { language: string; classification: "code" | "test" | "config" | "docs" | "ci" | "other"; family: Family } {
  const base = path.split("/").at(-1)!.toLowerCase(); const extension = base.split(".").at(-1)!;
  const language = /^(?:dockerfile)(?:\.|$)/.test(base) ? "dockerfile" : ({ ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", py: "python", java: "java", json: "json", yaml: "yaml", yml: "yaml",
    sql: "sql", md: "markdown", mdx: "markdown", toml: "toml", xml: "xml", prisma: "prisma", txt: "text", lock: "lockfile",
    go: "go", rs: "rust", rb: "ruby", kt: "kotlin", swift: "swift", sh: "shell", css: "css", html: "html", vue: "vue", svelte: "svelte" } as Record<string, string>)[extension] ?? "unknown";
  if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) || base === ".gitlab-ci.yml" || base === "jenkinsfile") return { language, classification: "ci", family: "ci" };
  if (["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "pyproject.toml", "pom.xml", "build.gradle", "build.gradle.kts"].includes(base)
    || /^requirements(?:[-.][a-z]+)?\.txt$/.test(base)) return { language, classification: "config", family: "manifests" };
  if (["sql", "prisma"].includes(language)) return { language, classification: "code", family: "schemas" };
  if (["markdown"].includes(language) || /^(?:readme|license|changelog|architecture)(?:\.|$)/.test(base)) return { language, classification: "docs", family: "documentation" };
  if (/(?:^|\/)(?:__tests__|tests?|specs?|e2e)(?:\/|$)/.test(path) || /(?:^test_|(?:[._-](?:test|spec))\.)/.test(base)
    || /(?:Test|Tests)\.java$/.test(path.split("/").at(-1)!)) return { language, classification: "test", family: "tests" };
  if (["json", "yaml", "toml", "xml", "dockerfile"].includes(language) || /(?:\.config\.[cm]?[jt]s|^\.(?:eslintrc|babelrc))$/.test(base)) return { language, classification: "config", family: "configuration" };
  return { language, classification: language === "unknown" ? "other" : "code", family: "source" };
}
export const directory = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
export const isProjectManifest = (path: string) => /(?:^|\/)(?:package\.json|pyproject\.toml|pom\.xml|build\.gradle(?:\.kts)?)$/.test(path);
export function nearestProject(path: string, projects: ReadonlyMap<string, string>): string | undefined {
  let dir = directory(path);
  while (true) {
    const project = projects.get(dir); if (project) return project;
    if (!dir) return undefined;
    dir = directory(dir.slice(0, -1));
  }
}
export function associate(relative: string, from: string, available: ReadonlySet<string>): string | undefined {
  if (!relative.startsWith(".") || relative.includes("\\")) return undefined;
  const parts = directory(from).split("/").filter(Boolean);
  for (const part of relative.split("/")) {
    if (part === "..") { if (!parts.length) return undefined; parts.pop(); }
    else if (part && part !== ".") parts.push(part);
  }
  const base = parts.join("/");
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"].map(suffix => base + suffix)];
  const matches = candidates.filter(candidate => available.has(candidate));
  return matches.length === 1 ? matches[0] : undefined;
}
