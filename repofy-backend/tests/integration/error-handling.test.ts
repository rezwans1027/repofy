import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { getApp } from "../helpers/supertest-app";
import { errorHandler } from "../../src/middleware/errorHandler";

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

  it("returns 404 with correct Content-Type", async () => {
    const app = getApp();
    const res = await request(app).get("/api/unknown-route");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("returns consistent error shape { success, error }", async () => {
    const app = getApp();
    const res = await request(app).get("/api/unknown-route");

    expect(res.body).toStrictEqual({
      success: false,
      error: "Not found",
    });
  });

  it("error responses never contain stack traces (standalone errorHandler)", async () => {
    // Standalone test that a thrown error goes through errorHandler without leaking stack
    const app = express();
    app.get("/api/throw", (_req, _res) => {
      throw new Error("Unexpected failure");
    });
    app.use(errorHandler);

    const res = await request(app).get("/api/throw");

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toContain("at ");
  });

  it("full app error responses suppress stack traces", async () => {
    // Use getApp() to verify the real middleware stack also suppresses stacks on 404s
    const app = getApp();
    const res = await request(app).get("/api/nonexistent-route-for-stack-test");

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toContain("at ");
    expect(res.body.success).toBe(false);
  });
});
