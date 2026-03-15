import * as net from "node:net";

/** Valid GitHub username: 1-39 alphanumeric/hyphen chars, no leading/trailing hyphen */
export const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Max number of IDs allowed in a batch delete request */
export const MAX_DELETE_IDS = 50;

/** Valid UUID v4 (case-insensitive) */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// SSRF-safe URL validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the given IP address belongs to a private, loopback,
 * link-local, or otherwise internal range that should never be the target
 * of server-side requests.
 */
function isPrivateIP(ip: string): boolean {
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalized = v4Mapped ? v4Mapped[1] : ip;

  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === "::1") return true;
    if (lower === "::") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }

  return true;
}

export interface ValidateUrlOptions {
  allowedSchemes?: string[];
  allowPrivateIPs?: boolean;
  hostnameAllowlist?: string[];
}

/**
 * Validate a URL string for safe server-side use (anti-SSRF).
 */
export function validateSafeUrl(
  raw: string,
  label: string,
  opts: ValidateUrlOptions = {},
): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label}: invalid URL — "${raw}"`);
  }

  const isProduction = (process.env.NODE_ENV ?? "production") === "production";
  const allowedSchemes = opts.allowedSchemes ?? (isProduction ? ["https"] : ["http", "https"]);
  const scheme = parsed.protocol.replace(/:$/, "");
  if (!allowedSchemes.includes(scheme)) {
    throw new Error(
      `${label}: disallowed scheme "${scheme}" — allowed: ${allowedSchemes.join(", ")}`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label}: URL must not contain user credentials`);
  }

  if (!opts.allowPrivateIPs) {
    const host = parsed.hostname;
    const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    if (net.isIP(bare) && isPrivateIP(bare)) {
      throw new Error(`${label}: URL points to a private/internal IP address`);
    }
  }

  if (opts.hostnameAllowlist && opts.hostnameAllowlist.length > 0) {
    if (!opts.hostnameAllowlist.includes(parsed.hostname)) {
      throw new Error(
        `${label}: hostname "${parsed.hostname}" not in allowlist [${opts.hostnameAllowlist.join(", ")}]`,
      );
    }
  }

  return parsed;
}
