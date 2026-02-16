import { describe, it, expect, vi } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";
import { getHealth } from "../../../src/controllers/health.controller";

describe("getHealth controller", () => {
  function callGetHealth() {
    const { req, res, next } = createControllerMocks();
    getHealth(req, res, next);
    const jsonMock = res.json as ReturnType<typeof vi.fn>;
    return { body: jsonMock.mock.calls[0][0], next };
  }

  it("responds with healthy status, timestamp, and uptime", () => {
    const { body, next } = callGetHealth();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.data.uptime).toBe("number");
    expect(next).not.toHaveBeenCalled();
  });

  it("uptime is a non-negative number", () => {
    const { body, next } = callGetHealth();
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("timestamp is a valid ISO-8601 string", () => {
    const { body, next } = callGetHealth();
    const parsed = new Date(body.data.timestamp);
    expect(isNaN(parsed.getTime())).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it("response contains all required fields", () => {
    const { body, next } = callGetHealth();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("data.status");
    expect(body).toHaveProperty("data.timestamp");
    expect(body).toHaveProperty("data.uptime");
    expect(Object.keys(body)).toHaveLength(2); // success + data
    expect(Object.keys(body.data)).toHaveLength(3); // status + timestamp + uptime
    expect(next).not.toHaveBeenCalled();
  });
});
