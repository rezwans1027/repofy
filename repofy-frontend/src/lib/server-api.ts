import { createClient } from "@/lib/supabase/server";

const BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be set in production");
  }
  return "http://localhost:3001/api";
})();

export async function serverFetch<T>(path: string): Promise<T | null> {
  const supabase = await createClient();
  // Session already validated by middleware's getUser() call
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.data as T;
}
