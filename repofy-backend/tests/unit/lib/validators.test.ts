import { describe, it, expect, vi, afterEach } from "vitest";
import { USERNAME_RE, UUID_RE, MAX_DELETE_IDS, validateSafeUrl } from "../../../src/lib/validators";

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

describe("UUID_RE", () => {
  it("accepts valid UUID v4", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects too-short string", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716")).toBe(false);
  });

  it("rejects wrong characters", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-44665544gggg")).toBe(false);
  });

  it("rejects missing hyphens", () => {
    expect(UUID_RE.test("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(UUID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(UUID_RE.test("")).toBe(false);
  });
});

describe("MAX_DELETE_IDS", () => {
  it("equals 50", () => {
    expect(MAX_DELETE_IDS).toBe(50);
  });
});

describe("validateSafeUrl", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns parsed URL for valid http URL (test env)", () => {
    process.env.NODE_ENV = "test";
    const result = validateSafeUrl("http://example.com/path", "test");
    expect(result).toBeInstanceOf(URL);
    expect(result.hostname).toBe("example.com");
  });

  it("rejects invalid URL strings", () => {
    expect(() => validateSafeUrl("not-a-url", "test")).toThrow("invalid URL");
  });

  it("rejects disallowed schemes (ftp)", () => {
    process.env.NODE_ENV = "test";
    expect(() => validateSafeUrl("ftp://example.com", "test")).toThrow(
      "disallowed scheme",
    );
  });

  it("rejects disallowed schemes (javascript)", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("javascript:alert(1)", "test"),
    ).toThrow("disallowed scheme");
  });

  it("rejects URLs with credentials", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://user:pass@example.com", "test"),
    ).toThrow("must not contain user credentials");
  });

  it("rejects private IP 127.0.0.1", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://127.0.0.1", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects private IP 10.x", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://10.0.0.1", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects private IP 172.16.x", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://172.16.0.1", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects private IP 192.168.x", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://192.168.1.1", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects private IP 169.254.x", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://169.254.1.1", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects private IP 0.x", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://0.0.0.0", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects IPv6 loopback (::1)", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://[::1]", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects IPv6 link-local (fe80::)", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://[fe80::1]", "test"),
    ).toThrow("private/internal IP");
  });

  it("rejects IPv6 ULA (fc/fd)", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://[fc00::1]", "test"),
    ).toThrow("private/internal IP");
    expect(() =>
      validateSafeUrl("http://[fd00::1]", "test"),
    ).toThrow("private/internal IP");
  });

  it("allows private IPs when allowPrivateIPs: true", () => {
    process.env.NODE_ENV = "test";
    const result = validateSafeUrl("http://127.0.0.1", "test", {
      allowPrivateIPs: true,
    });
    expect(result.hostname).toBe("127.0.0.1");
  });

  it("enforces hostname allowlist", () => {
    process.env.NODE_ENV = "test";
    expect(() =>
      validateSafeUrl("http://evil.com", "test", {
        hostnameAllowlist: ["example.com"],
      }),
    ).toThrow("not in allowlist");
  });

  it("allows non-listed hostnames when allowlist is empty", () => {
    process.env.NODE_ENV = "test";
    const result = validateSafeUrl("http://anything.com", "test", {
      hostnameAllowlist: [],
    });
    expect(result.hostname).toBe("anything.com");
  });

  it("production mode: rejects http, allows https", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      validateSafeUrl("http://example.com", "test"),
    ).toThrow("disallowed scheme");

    const result = validateSafeUrl("https://example.com", "test");
    expect(result.hostname).toBe("example.com");
  });
});
