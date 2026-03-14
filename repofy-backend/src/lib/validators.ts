import * as net from "node:net";
import * as dns from "node:dns/promises";

/** Valid GitHub username: 1-39 alphanumeric/hyphen chars, no leading/trailing hyphen */
export const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Max number of IDs allowed in a batch delete request */
export const MAX_DELETE_IDS = 50;

// ---------------------------------------------------------------------------
// SSRF-safe URL validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the given IP address belongs to a private, loopback,
 * link-local, or otherwise internal range that should never be the target
 * of server-side requests.
 */
function isPrivateIP(ip: string): boolean {
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — extract the v4 part
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalized = v4Mapped ? v4Mapped[1] : ip;

  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true;                         // 127.0.0.0/8  loopback
    if (a === 10) return true;                          // 10.0.0.0/8   private
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local
    if (a === 0) return true;                            // 0.0.0.0/8
    return false;
  }

  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === "::1") return true;                    // loopback
    if (lower === "::") return true;                     // unspecified
    if (lower.startsWith("fe80:")) return true;          // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    return false;
  }

  // Not a recognized IP format — treat as unsafe
  return true;
}

export interface ValidateUrlOptions {
  /** Allowed schemes. Defaults to ["https"] in production, ["http", "https"] otherwise. */
  allowedSchemes?: string[];
  /** If true, the hostname is allowed to resolve to a private IP. Default: false. */
  allowPrivateIPs?: boolean;
  /** Optional allowlist of permitted hostnames. If provided, the hostname must match one. */
  hostnameAllowlist?: string[];
}

/**
 * Validate a URL string for safe server-side use (anti-SSRF).
 *
 * Checks:
 * 1. The string parses as a valid URL.
 * 2. The scheme is in the allowed set.
 * 3. The hostname is not an IP literal in a private range.
 * 4. (Optional) The hostname matches an allowlist.
 *
 * Returns the parsed URL on success, or throws with a descriptive message.
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

  // 1. Scheme check
  const isProduction = (process.env.NODE_ENV ?? "production") === "production";
  const allowedSchemes = opts.allowedSchemes ?? (isProduction ? ["https"] : ["http", "https"]);
  const scheme = parsed.protocol.replace(/:$/, "");
  if (!allowedSchemes.includes(scheme)) {
    throw new Error(
      `${label}: disallowed scheme "${scheme}" — allowed: ${allowedSchemes.join(", ")}`,
    );
  }

  // 2. Block userinfo (user:pass@host style URLs, commonly used in SSRF bypasses)
  if (parsed.username || parsed.password) {
    throw new Error(`${label}: URL must not contain user credentials`);
  }

  // 3. Private IP check — if the hostname is an IP literal, check immediately
  if (!opts.allowPrivateIPs) {
    const host = parsed.hostname;
    // Remove brackets from IPv6 literals
    const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    if (net.isIP(bare) && isPrivateIP(bare)) {
      throw new Error(`${label}: URL points to a private/internal IP address`);
    }
  }

  // 4. Hostname allowlist
  if (opts.hostnameAllowlist && opts.hostnameAllowlist.length > 0) {
    if (!opts.hostnameAllowlist.includes(parsed.hostname)) {
      throw new Error(
        `${label}: hostname "${parsed.hostname}" not in allowlist [${opts.hostnameAllowlist.join(", ")}]`,
      );
    }
  }

  return parsed;
}

/**
 * Resolve a hostname's IP addresses and verify none are private/internal.
 * Call this at runtime before making the actual request for full SSRF protection
 * (defends against DNS rebinding where a public hostname resolves to a private IP).
 */
export async function assertHostNotPrivate(hostname: string, label: string): Promise<void> {
  // If it's already an IP literal, check directly
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (net.isIP(bare)) {
    if (isPrivateIP(bare)) {
      throw new Error(`${label}: resolved to private/internal IP ${bare}`);
    }
    return;
  }

  // Resolve DNS
  let addresses: string[];
  try {
    const result = await dns.lookup(hostname, { all: true });
    addresses = result.map((r) => r.address);
  } catch (err) {
    throw new Error(`${label}: DNS resolution failed for "${hostname}" — ${err}`);
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new Error(
        `${label}: hostname "${hostname}" resolves to private/internal IP ${addr}`,
      );
    }
  }
}
