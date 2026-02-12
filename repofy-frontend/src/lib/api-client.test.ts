import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client module before api-client imports it
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
    },
  }),
}));

import { api, ApiError } from "./api-client";

describe("ApiError", () => {
  it("creates error with status and message", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});

describe("api.get", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes GET request and returns data", async () => {
    const mockData = { users: ["alice"] };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: mockData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await api.get("/test");
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ApiError on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await api.get("/fail");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).message).toBe("Bad request");
    }
  });

  it("throws ApiError when response is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 200 }),
    );

    await expect(api.get("/bad")).rejects.toThrow("Server returned non-JSON response");
  });

  it("includes auth header when auth option is true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.get("/secure", { auth: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });
});

describe("api.post", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes POST request with JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await api.post("/create", { body: { name: "test" } });
    expect(result).toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws ApiError when success is false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "Validation failed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(api.post("/validate")).rejects.toThrow("Validation failed");
  });
});

describe("api - network errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("propagates network error on GET", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await expect(api.get("/offline")).rejects.toThrow("Failed to fetch");
  });

  it("propagates network error on POST", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await expect(api.post("/offline")).rejects.toThrow("Failed to fetch");
  });
});
