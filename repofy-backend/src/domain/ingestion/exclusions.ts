import ignore from "ignore";
import { IngestionError } from "./errors";
import type { ExclusionReason } from "./policy";

export function mandatoryExclusion(path: string, policyVersion = "1.0.0"): ExclusionReason | undefined {
  const parts = path.toLowerCase().split("/"); const base = parts[parts.length - 1];
  const schemaSql = policyVersion === "1.1.0" && (base === "schema.sql" || parts.includes("migrations"))
    && !parts.some(p => /(?:dump|backup|seed|fixture)|(?:^|[._-])(?:data|datasets?)(?:$|[._-])/.test(p)) && base.endsWith(".sql");
  const lockfile = policyVersion === "1.1.0" && ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"].includes(base);
  if (parts.some(p => [".git", ".ssh", ".aws", ".azure", ".gcloud", ".gnupg", ".kube", ".docker", "secrets", "credentials"].includes(p))
    || /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?)$/.test(base)
    || /\.(?:pem|key|p12|pfx|jks|keystore|kdbx|sqlite3?|db|dump|log|csv|tsv|parquet|tfstate(?:\.backup)?)$/.test(base)
    || (base.endsWith(".sql") && !schemaSql)) return "sensitive_path";
  if (parts.some(p => ["node_modules", "vendor", "third_party", "third-party", ".venv", "venv", "bower_components", "pods"].includes(p))) return "dependency";
  if (parts.some(p => ["dist", "build", "out", "coverage", ".next", ".nuxt", ".cache", "target", "__pycache__", "generated"].includes(p))
    || /(?:\.min\.[cm]?js|\.map|\.generated\.[^.]+|\.g\.dart)$/.test(base)
    || (!lockfile && ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "cargo.lock", "poetry.lock"].includes(base))) return "generated";
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|tar|7z|rar|woff2?|ttf|eot|mp[34]|wav|ogg|exe|dll|so|dylib|class|jar|wasm|pyc|bin)$/.test(base)) return "binary";
  if (base === ".repofyignore") return "policy_file";
  return undefined;
}
/** Root .repofyignore uses a bounded gitignore subset. It never participates in
 * mandatory exclusions; negation therefore cannot opt sensitive content in. */
export function ignoreMatcher(text: string): (path: string) => boolean {
  if (Buffer.byteLength(text) > 65536 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(text)) throw new IngestionError("INVALID_IGNORE");
  const rules = text.split(/\r?\n/).filter(line => line && !line.startsWith("#"));
  if (rules.length > 128) throw new IngestionError("INVALID_IGNORE");
  for (const rule of rules) {
    // No arbitrary regex, escapes, character classes or path traversal in v1.
    if (rule.length > 256 || /[\\[\]{}:]/.test(rule) || /(^|\/)\.\.?($|\/)/.test(rule.replace(/^!/, ""))
      || (rule.match(/[?*]/g)?.length ?? 0) > 16 || ["!", "/", "!/"].includes(rule)) throw new IngestionError("INVALID_IGNORE");
  }
  try { const matcher = ignore({ ignorecase: false }).add(rules); return path => matcher.ignores(path); }
  catch { throw new IngestionError("INVALID_IGNORE"); }
}
export function decodeText(bytes: Buffer): { text: string } | { excluded: ExclusionReason } {
  if (bytes.includes(0) || bytes.some(value => value < 9 || (value > 13 && value < 32) || value === 127)) return { excluded: "binary" };
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\r\n?/g, "\n") }; }
  catch { return { excluded: "unsupported_encoding" }; }
}

/** Conservative DML screening for the v1.1 schema-path exception. Remove nested
 * comments before matching, so comment-separated INSERT/COPY cannot opt data in.
 * String bodies are deliberately included: stored SQL data/procedures are excluded too. */
export function containsSqlData(text: string): boolean {
  const chunks: string[] = []; let index = 0; let begin = 0;
  while (index < text.length) {
    if (text.startsWith("--", index)) {
      chunks.push(text.slice(begin, index), " "); const end = text.indexOf("\n", index); index = end < 0 ? text.length : end; begin = index;
    } else if (text.startsWith("/*", index)) {
      chunks.push(text.slice(begin, index), " "); let depth = 1; index += 2;
      while (index < text.length && depth) {
        if (text.startsWith("/*", index)) { depth++; index += 2; }
        else if (text.startsWith("*/", index)) { depth--; index += 2; } else index++;
      }
      if (depth) return true; begin = index;
    } else index++;
  }
  chunks.push(text.slice(begin)); const normalized = chunks.join("");
  return /\b(?:insert\s+into|load\s+data|merge\s+into|delete\s+from)\b/i.test(normalized)
    || (/\bcopy\b/i.test(normalized) && /\bfrom\b/i.test(normalized))
    || (/\bupdate\b/i.test(normalized) && /\bset\b/i.test(normalized));
}
