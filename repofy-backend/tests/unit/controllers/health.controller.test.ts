import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { getHealth } from "../../../src/controllers/health.controller";

describe("getHealth controller", () => {
  it("responds with healthy status, timestamp, and uptime", () => {
    const req = {} as Request;
    const jsonMock = vi.fn();
    const res = { json: jsonMock } as unknown as Response;

    getHealth(req, res, vi.fn());

    expect(jsonMock).toHaveBeenCalledOnce();
    const body = jsonMock.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.data.uptime).toBe("number");
  });
});
