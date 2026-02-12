import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../../src/config/env", () => ({
  env: {
    corsOrigin: "https://repofy.app",
  },
}));

import { corsMiddleware } from "../../../src/middleware/cors";

function createApp() {
  const app = express();
  app.use(corsMiddleware);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("corsMiddleware", () => {
  it("sets CORS headers for allowed origin", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/test")
      .set("Origin", "https://repofy.app");

    expect(res.headers["access-control-allow-origin"]).toBe("https://repofy.app");
  });

  it("always sets allow-origin to configured value (static origin mode)", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/test")
      .set("Origin", "https://evil.com");

    // With a string origin, cors always emits the configured value —
    // the browser enforces the actual same-origin check client-side
    expect(res.headers["access-control-allow-origin"]).toBe("https://repofy.app");
  });

  it("responds to preflight with allowed methods and headers", async () => {
    const app = createApp();
    const res = await request(app)
      .options("/test")
      .set("Origin", "https://repofy.app")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(res.headers["access-control-allow-headers"]).toContain("Content-Type");
  });
});
