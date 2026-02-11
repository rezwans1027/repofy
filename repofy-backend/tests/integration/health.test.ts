import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";

describe("GET /api/health", () => {
  it("returns 200 with status healthy", async () => {
    const app = getApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("healthy");
    expect(res.body.data.timestamp).toBeDefined();
    expect(res.body.data.uptime).toBeGreaterThan(0);
  });
});
