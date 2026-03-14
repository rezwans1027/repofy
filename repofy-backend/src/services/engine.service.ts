import { env } from "../config/env";
import { fetchWithRetry } from "../lib/retry";
import { validateSafeUrl, assertHostNotPrivate } from "../lib/validators";

/** Hardcoded set of allowed engine API paths (defense-in-depth). */
const ALLOWED_ENGINE_PATHS = new Set(["/analyze", "/advice"]);

export async function callEngine<T>(
  path: string,
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  // 1. Validate the path is one of the known engine endpoints
  if (!ALLOWED_ENGINE_PATHS.has(path)) {
    throw new Error(`Engine: disallowed path "${path}"`);
  }

  // 2. Parse and validate the full URL (scheme + IP-literal check)
  const fullUrl = `${env.engineUrl}${path}`;
  const parsed = validateSafeUrl(fullUrl, `Engine ${path}`);

  // 3. DNS-resolution check: ensure the hostname doesn't resolve to a private IP
  //    (protects against DNS rebinding attacks). Skip in dev for localhost convenience.
  if (env.isProduction) {
    await assertHostNotPrivate(parsed.hostname, `Engine ${path}`);
  }

  const res = await fetchWithRetry(
    parsed.href,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": env.engineInternalKey,
      },
      body: JSON.stringify(body),
      signal,
    },
    { label: `Engine ${path}` },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Engine ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}
