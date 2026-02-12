import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import { sendError, sendSuccess } from "../../../src/lib/response";

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("sendError", () => {
  it("sends JSON with success: false and the given status", () => {
    const res = createMockRes();

    sendError(res, 400, "Bad request");

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Bad request",
    });
  });

  it("sends 500 status for server errors", () => {
    const res = createMockRes();

    sendError(res, 500, "Internal server error");

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
  });
});

describe("sendSuccess", () => {
  it("sends JSON with success: true and the given data", () => {
    const res = createMockRes();
    const data = { id: 1, name: "test" };

    sendSuccess(res, data);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 1, name: "test" },
    });
  });

  it("does not set status (defaults to 200)", () => {
    const res = createMockRes();

    sendSuccess(res, null);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: null,
    });
  });
});
