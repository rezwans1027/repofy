import { createClient } from "@/lib/supabase/client";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api";

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
    const {
      data: { session },
    } = await getSupabase().auth.refreshSession();
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

  // Note: for production, validate with Zod before casting
  return json.data as T;
}

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return request<T>("GET", path, opts);
  },
  post<T>(path: string, opts?: RequestOptions) {
    return request<T>("POST", path, opts);
  },
};
