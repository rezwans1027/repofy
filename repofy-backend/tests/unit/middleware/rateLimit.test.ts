import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

function createApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("aiRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows 5 requests then blocks with 429", async () => {
    const { aiRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createApp(aiRateLimit);

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get("/test");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  });
});

describe("githubRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows 30 requests then blocks with 429", async () => {
    const { githubRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createApp(githubRateLimit);

    for (let i = 0; i < 30; i++) {
      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get("/test");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  });
});
