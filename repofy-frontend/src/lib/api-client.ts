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

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth, body, signal, ...rest } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    ...rest,
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new ApiError(json.error || `Request failed`, res.status);
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
};
