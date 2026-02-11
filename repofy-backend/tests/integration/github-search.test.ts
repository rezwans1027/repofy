import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createGitHubApiUser, createSearchResponse } from "../fixtures/github";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockFetchJson(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("GET /api/github/search", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns results for valid query", async () => {
    const searchResp = createSearchResponse(["octocat"]);
    const user = createGitHubApiUser();

    fetchMock
      .mockReturnValueOnce(mockFetchJson(searchResp))
      .mockReturnValueOnce(mockFetchJson(user));

    const app = getApp();
    const res = await request(app).get("/api/github/search?q=octocat");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe("octocat");
  });

  it("returns empty array for empty query", async () => {
    const app = getApp();
    const res = await request(app).get("/api/github/search?q=");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("returns empty array when no q param", async () => {
    const app = getApp();
    const res = await request(app).get("/api/github/search");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
