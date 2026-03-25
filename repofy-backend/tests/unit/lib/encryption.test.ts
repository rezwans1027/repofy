import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "../../../src/lib/encryption";

describe("encryption", () => {
  const plaintext = "gho_abc123XYZ_someGitHubToken";

  it("round-trips: decrypt(encrypt(plaintext)) === plaintext", () => {
    const ciphertext = encryptToken(plaintext);
    const decrypted = decryptToken(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("produces unique IVs: same plaintext yields different ciphertexts", () => {
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);

    // Both should still decrypt correctly
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it("detects tampered ciphertext and throws", () => {
    const ciphertext = encryptToken(plaintext);
    const buf = Buffer.from(ciphertext, "base64");

    // Flip a byte in the encrypted payload area (after version + IV + auth tag)
    const tamperIndex = 1 + 12 + 16;
    buf[tamperIndex] ^= 0xff;

    const tampered = buf.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("isEncrypted() returns true for encrypted tokens", () => {
    const ciphertext = encryptToken(plaintext);
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it("isEncrypted() returns false for plaintext gho_* tokens", () => {
    expect(isEncrypted("gho_abc123XYZ_someGitHubToken")).toBe(false);
  });

  it("isEncrypted() returns false for empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });

  it("isEncrypted() returns false for arbitrary non-encrypted base64", () => {
    // Base64 of a short string that doesn't start with version byte 0x01
    expect(isEncrypted(Buffer.from("hello world").toString("base64"))).toBe(false);
  });
});
