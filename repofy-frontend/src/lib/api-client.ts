import { z } from "zod";
import { getAccessToken } from "@/lib/auth-token";

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be set in production");
  }
  return "http://localhost:3001/api";
}

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

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth, body, signal, headers: callerHeaders, ...rest } = opts;
  const headers: Record<string, string> = {};

  // Read the cached access token synchronously — no getSession() call,
  // no Web Locks, no async blocking. The auth provider keeps this in
  // sync via onAuthStateChange.
  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
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
