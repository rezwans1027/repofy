/** Deliberately small, deterministic and versioned; no repository configuration,
 * suppressions, plugins, network validation, subprocesses or match reporting.
 * This is a likely-secret filter, not a proof that arbitrary text is secret-free.
 * See ADR 0006 for coverage, conservative false positives and rollout gates. */
export interface SecretScanner { readonly version: "repofy-static-secrets-1.0.0"; isSensitive(text: string): boolean }
const signatures = [
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\b(?:sk|rk)-(?:proj-|svcacct-|live_|test_)?[A-Za-z0-9_-]{20,255}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,255}\b/,
  /\bAIza[A-Za-z0-9_-]{30,40}\b/,
  /\beyJ[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{5,2048}\b/,
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|https?):\/\/[^\s/:]{1,128}:[^\s/@]{1,256}@/i,
  /\b(?:authorization\s*[:=]\s*["']?\s*(?:bearer|basic)|aws_secret_access_key)\b/i,
  // Sensitive personal data: conservative exclusion includes synthetic examples.
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,128}\.[A-Z]{2,24}\b/i,
];
function entropy(value: string): number {
  const counts = new Map<string, number>(); for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let result = 0; for (const count of counts.values()) { const p = count / value.length; result -= p * Math.log2(p); } return result;
}
export const staticSecretScanner: SecretScanner = Object.freeze({
  version: "repofy-static-secrets-1.0.0" as const,
  isSensitive(text: string): boolean {
    if (signatures.some(pattern => pattern.test(text))) return true;
    // Bounded repetitions avoid catastrophic backtracking on adversarial source.
    const assignments = /(?:password|passwd|secret|token|api[_-]?key|credential|client[_-]?secret)[\w.-]{0,32}["']?\s{0,32}[:=]\s{0,32}["'`]?([^\s"'`,;}{]{4,256})/gi;
    for (const match of text.matchAll(assignments)) {
      const value = match[1];
      if (/^(?:process\.env\.|import\.meta\.env\.|os\.environ|\$\{|env\(|getenv\()/i.test(value)) continue;
      if (value.length >= 8 || entropy(value) >= 2) return true;
    }
    // Standalone high-entropy blobs (also catches unlabeled secrets in unusual files).
    for (const match of text.matchAll(/[A-Za-z0-9_+/=-]{32,256}/g)) {
      if (/[a-zA-Z]/.test(match[0]) && /[0-9]/.test(match[0]) && entropy(match[0]) >= 4.3) return true;
    }
    for (const match of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
      const digits = match[0].replace(/\D/g, ""); if (digits.length < 13 || digits.length > 19 || /^(.)\1+$/.test(digits)) continue;
      let sum = 0; let double = false;
      for (let i = digits.length - 1; i >= 0; i--) { let n = Number(digits[i]); if (double) { n *= 2; if (n > 9) n -= 9; } sum += n; double = !double; }
      if (sum % 10 === 0) return true;
    }
    return false;
  },
});
