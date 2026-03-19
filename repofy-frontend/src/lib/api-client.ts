import { z } from "zod";

function getBaseUrl() {
  // Browser: use relative path (goes through Next.js rewrites)
  if (typeof window !== "undefined") return "/api";

  // Server: direct call to backend
  const url = process.env.API_BACKEND_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("API_BACKEND_URL must be set in production for server-side calls");
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
  body?: unknown;
  schema?: z.ZodType;
}

// Paths that must never trigger auto-refresh (prevents recursion/deadlock)
const REFRESH_EXEMPT_PATHS = ["/auth/refresh", "/auth/login", "/auth/logout", "/auth/me"];

// Module-level refresh promise for race condition protection
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, signal, headers: callerHeaders, ...rest } = opts;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // CSRF protection: add X-Requested-With on mutating requests
  if (MUTATING_METHODS.has(method)) {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    ...rest,
    credentials: "include",
    headers: { ...(callerHeaders as Record<string, string>), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Auto-refresh on 401 (unless exempt path)
  if (res.status === 401 && !REFRESH_EXEMPT_PATHS.some((p) => path.startsWith(p))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry original request once
      const retryRes = await fetch(`${getBaseUrl()}${path}`, {
        method,
        ...rest,
        credentials: "include",
        headers: { ...(callerHeaders as Record<string, string>), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      let retryJson: Record<string, unknown>;
      try {
        retryJson = await retryRes.json();
      } catch {
        throw new ApiError("Server returned non-JSON response", retryRes.status);
      }

      if (!retryRes.ok || retryJson.success === false) {
        throw new ApiError(
          (retryJson.error as string) || "Request failed",
          retryRes.status,
        );
      }

      if (opts.schema) {
        return opts.schema.parse(retryJson.data) as T;
      }
      return retryJson.data as T;
    }

    // Refresh failed — throw so callers can handle (middleware handles route protection)
    throw new ApiError("Session expired", 401);
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("Server returned non-JSON response", res.status);
  }

  if (!res.ok || json.success === false) {
    throw new ApiError(
      (json.error as string) || "Request failed",
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
