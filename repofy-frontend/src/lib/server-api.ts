import { createClient } from "@/lib/supabase/server";

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be set in production");
  }
  return "http://localhost:3001/api";
}

export async function serverFetch<T>(path: string): Promise<T | null> {
  const supabase = await createClient();
  // getUser() validates the JWT server-side (signature + expiry);
  // getSession() only reads the token from cookies without verification.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.data as T;
}
