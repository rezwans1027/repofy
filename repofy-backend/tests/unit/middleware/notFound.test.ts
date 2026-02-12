import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { notFound } from "../../../src/middleware/notFound";

function createMocks() {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

describe("notFound middleware", () => {
  it("responds with 404 and { success: false, error: 'Not found' }", () => {
    const { req, res } = createMocks();

    notFound(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Not found",
    });
  });
});
