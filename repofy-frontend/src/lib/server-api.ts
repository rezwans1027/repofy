import { cookies } from "next/headers";
import { z } from "zod";

export type ServerError = "unauthenticated" | "forbidden" | "not-found" | "server-error";

export type ServerResult<T> =
  | { data: T; error: null }
  | { data: null; error: ServerError };

function getBaseUrl() {
  const url = process.env.API_BACKEND_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("API_BACKEND_URL must be set in production");
  }
  return "http://localhost:3001/api";
}

export async function serverFetch<T>(
  path: string,
  options?: { revalidate?: number | false; schema?: z.ZodType<T> },
): Promise<ServerResult<T>> {
  // Forward request cookies to the backend (includes access_token + refresh_token)
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  if (!cookieHeader) return { data: null, error: "unauthenticated" };

  const cacheStrategy: RequestInit =
    options?.revalidate !== undefined && options.revalidate !== false
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" };

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(10_000),
      ...cacheStrategy,
    });
  } catch (err) {
    if (
      err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      console.error(`[serverFetch] Request to ${path} timed out after 10 s`);
      return { data: null, error: "server-error" };
    }
    throw err;
  }

  // TODO(auth): SSR cookie staleness — backend auto-refreshes from refresh_token
  // so the data request succeeds, but Server Components cannot reliably forward
  // Set-Cookie headers back to the browser. The browser's access_token cookie
  // may stay stale until the next client-side API call refreshes it via the
  // rewrite proxy.

  if (!res.ok) {
    const error: ServerError =
      res.status === 401 ? "unauthenticated" :
      res.status === 403 ? "forbidden" :
      res.status === 404 ? "not-found" :
      "server-error";
    return { data: null, error };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { data: null, error: "server-error" };
  }

  const raw = (json as Record<string, unknown>).data;

  if (options?.schema) {
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      console.error(`[serverFetch] Zod validation failed for ${path}:`, parsed.error.issues);
      return { data: null, error: "server-error" };
    }
    return { data: parsed.data, error: null };
  }

  return { data: raw as T, error: null };
}
