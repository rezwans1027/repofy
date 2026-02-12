import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";

describe("Error handling", () => {
  it("returns 404 for unknown routes", async () => {
    const app = getApp();
    const res = await request(app).get("/api/unknown-route");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Not found");
  });

  it("returns 404 for non-api routes", async () => {
    const app = getApp();
    const res = await request(app).get("/some-random-path");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
