import { createClient } from "@/lib/supabase/server";

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
  options?: { revalidate?: number | false },
): Promise<ServerResult<T>> {
  const supabase = await createClient();
  // getUser() validates the JWT server-side (signature + expiry);
  // getSession() only reads the token from cookies without verification.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "unauthenticated" };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { data: null, error: "unauthenticated" };

  const cacheStrategy: RequestInit =
    options?.revalidate !== undefined && options.revalidate !== false
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" };

  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    ...cacheStrategy,
  });

  if (!res.ok) {
    const error: ServerError =
      res.status === 401 ? "unauthenticated" :
      res.status === 403 ? "forbidden" :
      res.status === 404 ? "not-found" :
      "server-error";
    return { data: null, error };
  }

  const json = await res.json();
  return { data: json.data as T, error: null };
}
