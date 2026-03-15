import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type ServerError = "unauthenticated" | "forbidden" | "not-found" | "server-error";

export type ServerResult<T> =
  | { data: T; error: null }
  | { data: null; error: ServerError };

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be set in production");
  }
  return "http://localhost:3001/api";
}

export async function serverFetch<T>(
  path: string,
  options?: { revalidate?: number | false; schema?: z.ZodType<T> },
): Promise<ServerResult<T>> {
  const supabase = await createClient();

  // getUser() validates the JWT server-side (signature + expiry). If the
  // token was rotated it also refreshes the session and writes the new
  // cookies on this SSR client instance.
  //
  // getSession() is then called on the *same* client — so the access_token
  // is guaranteed to come from the post-refresh cookie store.  We must call
  // getUser() *before* getSession() (never parallel, never reversed) because
  // getSession() only reads from storage without verification.
  //
  // As a defence-in-depth measure we also assert that the session belongs to
  // the verified user, catching any cookie-level mismatch.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "unauthenticated" };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) {
    return { data: null, error: "unauthenticated" };
  }

  const cacheStrategy: RequestInit =
    options?.revalidate !== undefined && options.revalidate !== false
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" };

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
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
