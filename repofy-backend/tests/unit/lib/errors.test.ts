import { describe, it, expect } from "vitest";
import { isRefundableError } from "../../../src/lib/errors";

describe("isRefundableError", () => {
  it("returns true for AbortError (timeout/disconnect)", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    expect(isRefundableError(err)).toBe(true);
  });

  it("returns true for 5xx status objects", () => {
    expect(isRefundableError({ status: 500, message: "Internal" })).toBe(true);
    expect(isRefundableError({ status: 502, message: "Bad Gateway" })).toBe(true);
    expect(isRefundableError({ status: 503, message: "Unavailable" })).toBe(true);
  });

  it("returns false for 4xx status objects", () => {
    expect(isRefundableError({ status: 400, message: "Bad Request" })).toBe(false);
    expect(isRefundableError({ status: 404, message: "Not Found" })).toBe(false);
    expect(isRefundableError({ status: 429, message: "Rate Limited" })).toBe(false);
  });

  it("returns true for generic Error (unexpected exception)", () => {
    expect(isRefundableError(new Error("something broke"))).toBe(true);
  });

  it("returns true for string errors", () => {
    expect(isRefundableError("unknown error")).toBe(true);
  });

  it("returns true for null/undefined", () => {
    expect(isRefundableError(null)).toBe(true);
    expect(isRefundableError(undefined)).toBe(true);
  });
});
