import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be set in production");
  }
  return "http://localhost:3001/api";
})();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
  schema?: z.ZodType;
}

// Lazy singleton — defers client creation until first use,
// safe if this module is ever evaluated in a server context.
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth, body, signal, headers: callerHeaders, ...rest } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const supabase = getSupabase();
    let { data: { session } } = await supabase.auth.getSession();

    // If the cached token is expired (or about to expire in 60s), refresh it
    if (session?.expires_at && session.expires_at * 1000 - Date.now() < 60_000) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    ...rest,
    headers: { ...(callerHeaders as Record<string, string>), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("Server returned non-JSON response", res.status);
  }

  if (!res.ok || json.success === false) {
    throw new ApiError(
      (json.error as string) || `Request failed`,
      res.status,
    );
  }

  if (opts.schema) {
    return opts.schema.parse(json.data) as T;
  }
  return json.data as T;
}

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return request<T>("GET", path, opts);
  },
  post<T>(path: string, opts?: RequestOptions) {
    return request<T>("POST", path, opts);
  },
  delete<T>(path: string, opts?: RequestOptions) {
    return request<T>("DELETE", path, opts);
  },
};
