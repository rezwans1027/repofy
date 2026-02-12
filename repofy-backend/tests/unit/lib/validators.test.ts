import { describe, it, expect } from "vitest";
import { USERNAME_RE } from "../../../src/lib/validators";

describe("USERNAME_RE", () => {
  it("accepts valid simple username", () => {
    expect(USERNAME_RE.test("octocat")).toBe(true);
  });

  it("accepts hyphenated username", () => {
    expect(USERNAME_RE.test("a-b")).toBe(true);
  });

  it("accepts single character username", () => {
    expect(USERNAME_RE.test("a")).toBe(true);
  });

  it("accepts alphanumeric username", () => {
    expect(USERNAME_RE.test("abc123")).toBe(true);
  });

  it("accepts 39-character username", () => {
    const name = "a" + "b".repeat(37) + "c";
    expect(name.length).toBe(39);
    expect(USERNAME_RE.test(name)).toBe(true);
  });

  it("rejects leading hyphen", () => {
    expect(USERNAME_RE.test("-bad")).toBe(false);
  });

  it("rejects trailing hyphen", () => {
    expect(USERNAME_RE.test("bad-")).toBe(false);
  });

  it("rejects leading double hyphens", () => {
    // "--bad" fails because of the leading hyphen, not the double hyphen
    expect(USERNAME_RE.test("--bad")).toBe(false);
  });

  it("accepts mid-string double hyphens", () => {
    expect(USERNAME_RE.test("a--b")).toBe(true);
  });

  it("rejects 40+ character username", () => {
    const name = "a".repeat(40);
    expect(USERNAME_RE.test(name)).toBe(false);
  });

  it("rejects special characters", () => {
    expect(USERNAME_RE.test("@#$")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(USERNAME_RE.test("")).toBe(false);
  });

  it("is case insensitive (accepts uppercase)", () => {
    expect(USERNAME_RE.test("OctoCat")).toBe(true);
  });
});
