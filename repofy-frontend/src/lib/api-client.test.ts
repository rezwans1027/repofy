import { describe, it, expect, vi, beforeEach } from "vitest";

import { api, ApiError } from "./api-client";
import { ReadinessReportResponseSchema } from "@repofy/contracts";
import { createSyntheticReportFixture } from "@repofy/contracts/testing";

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

  it("makes GET request with credentials: include", async () => {
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
      expect.objectContaining({ method: "GET", credentials: "include" }),
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
});

describe("api.post", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes POST request with JSON body and X-Requested-With header", async () => {
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
        credentials: "include",
        body: JSON.stringify({ name: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
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

describe("api - 401 auto-refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries request after successful refresh on 401", async () => {
    const mockData = { items: [1] };
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      // First call: original request returns 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
      )
      // Second call: refresh endpoint succeeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }),
      )
      // Third call: retried original request succeeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: mockData }), { status: 200 }),
      );

    const result = await api.get("/protected");
    expect(result).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does not auto-refresh for /auth/login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "Invalid" }), { status: 401 }),
    );

    await expect(api.post("/auth/login", { body: { email: "a@b.com", password: "x" } }))
      .rejects.toThrow("Invalid");
    // Only 1 call — no refresh attempted
    expect(fetch).toHaveBeenCalledTimes(1);
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

describe("v1 errors and refresh compatibility", () => {
  beforeEach(() => vi.restoreAllMocks());
  const failure = { success: false, error: "Readiness unavailable", code: "FEATURE_DISABLED", retryable: false, requestId: "synthetic-request" };
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it.each([false, true])("retains structured errors, including after refresh=%s", async (refresh) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    if (refresh) fetchSpy.mockResolvedValueOnce(jsonResponse({ success: false, error: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchSpy.mockResolvedValueOnce(jsonResponse(failure, 503));
    await expect(api.post("/v1/analyses", { body: { idempotencyKey: "synthetic-request" }, headers: { "X-Request-Id": "synthetic-request" } }))
      .rejects.toMatchObject({ message: failure.error, status: 503, code: failure.code, retryable: false, requestId: failure.requestId });
    if (refresh) {
      expect(fetchSpy.mock.calls[2]).toEqual(fetchSpy.mock.calls[0]);
      expect(fetchSpy.mock.calls[1][1]).toMatchObject({ credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
    }
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ headers: { "X-Requested-With": "XMLHttpRequest", "X-Request-Id": "synthetic-request" } });
  });

  it("parses shared success data on a refreshed request and does not pass schema to fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false, error: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: createSyntheticReportFixture() }));
    const report = await api.get("/v1/readiness-reports/synthetic", { schema: ReadinessReportResponseSchema });
    expect(report).toEqual(createSyntheticReportFixture());
    expect(fetchSpy.mock.calls[0][1]).not.toHaveProperty("schema");
  });

  it("rejects invalid success data after refresh", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401)).mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { contractVersion: "2.0.0" } }));
    await expect(api.get("/v1/readiness-reports/synthetic", { schema: ReadinessReportResponseSchema })).rejects.toThrow();
  });

  it("preserves the legacy session-expired message and retains v1 correlation when refresh fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ...failure, code: "UNAUTHENTICATED" }, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(api.get("/v1/analyses/synthetic")).rejects.toMatchObject({ message: "Session expired", status: 401, requestId: "synthetic-request" });
  });

  it("handles a non-JSON retried response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true })).mockResolvedValueOnce(new Response("unavailable", { status: 502 }));
    await expect(api.get("/v1/analyses/synthetic")).rejects.toMatchObject({ message: "Server returned non-JSON response", status: 502 });
  });
});
