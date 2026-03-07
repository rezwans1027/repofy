import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

function createApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

function createPostApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(limiter);
  app.post("/test", (_req, res) => res.json({ ok: true }));
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

describe("authRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("generates compound key from IP + email in POST body", async () => {
    const { authRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createPostApp(authRateLimit);

    // 10 requests with email-a should all pass
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/test")
        .send({ email: "a@test.com" });
      expect(res.status).toBe(200);
    }

    // 11th request with same email should be blocked
    const blocked = await request(app)
      .post("/test")
      .send({ email: "a@test.com" });
    expect(blocked.status).toBe(429);

    // A different email should still be allowed (separate key)
    const different = await request(app)
      .post("/test")
      .send({ email: "b@test.com" });
    expect(different.status).toBe(200);
  });

  it("falls back to IP-only key when no email is provided", async () => {
    const { authRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createPostApp(authRateLimit);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/test").send({});
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/test").send({});
    expect(blocked.status).toBe(429);
  });
});

describe("resendRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows 3 requests then blocks with 429", async () => {
    const { resendRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createPostApp(resendRateLimit);

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/test")
        .send({ email: "resend@test.com" });
      expect(res.status).toBe(200);
    }

    const blocked = await request(app)
      .post("/test")
      .send({ email: "resend@test.com" });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  });

  it("uses compound IP+email key so different emails have separate limits", async () => {
    const { resendRateLimit } = await import("../../../src/middleware/rateLimit");
    const app = createPostApp(resendRateLimit);

    // Exhaust limit for email-a
    for (let i = 0; i < 3; i++) {
      await request(app).post("/test").send({ email: "a@test.com" });
    }

    const blockedA = await request(app)
      .post("/test")
      .send({ email: "a@test.com" });
    expect(blockedA.status).toBe(429);

    // email-b should still be allowed
    const allowedB = await request(app)
      .post("/test")
      .send({ email: "b@test.com" });
    expect(allowedB.status).toBe(200);
  });
});
