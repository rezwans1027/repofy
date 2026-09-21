import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { LocatorCrypto, locatorCryptoFromEnvironment } from "../../../src/domain/evidence/locator-crypto";
import { fixtureCrypto } from "../../helpers/evidence-fixtures";

const context = { repositoryId: randomUUID(), snapshotId: randomUUID(), locatorId: randomUUID() };
const locator = { kind: "file" as const, path: "private/synthetic.ts", symbol: "syntheticFunction", lines: { start: 2, end: 4 } };

describe("encrypted evidence locators", () => {
  it("decrypts pinned branch provenance only in its original purpose and row", () => {
    const crypto = fixtureCrypto(); const encrypted = crypto.encryptBranch("private-branch", context);
    expect(crypto.decryptBranch(encrypted, context)).toBe("private-branch");
    expect(() => crypto.decryptBranch(encrypted, { ...context, snapshotId: randomUUID() })).toThrow("Locator could not be decrypted");
    expect(() => crypto.decryptBranch(crypto.protectLocator(locator, context).locatorEncrypted, context)).toThrow("Locator could not be decrypted");
  });
  it("uses repository-scoped keyed content hashes without retaining source", () => {
    const crypto = fixtureCrypto(); const hash = crypto.fingerprintContent("synthetic private source", context.repositoryId);
    expect(hash).toEqual(crypto.fingerprintContent("synthetic private source", context.repositoryId));
    expect(hash).not.toEqual(crypto.fingerprintContent("synthetic private source", randomUUID()));
    expect(hash).not.toEqual(crypto.fingerprintContent("changed source", context.repositoryId));
    expect(JSON.stringify(hash)).not.toContain("private source");
  });
  it("uses unique IVs, stable keyed lookup, and authenticated round trips", () => {
    const crypto = fixtureCrypto();
    const first = crypto.protectLocator(locator, context); const second = crypto.protectLocator(locator, context);
    expect(first.locatorEncrypted).not.toEqual(second.locatorEncrypted);
    expect(first.fingerprint).toEqual(second.fingerprint);
    expect(crypto.decryptLocator(first.locatorEncrypted, context)).toEqual(locator);
    expect(JSON.stringify(first)).not.toContain(locator.path);
    expect(crypto.protectLocator(locator, { ...context, repositoryId: randomUUID() }).fingerprint).not.toEqual(first.fingerprint);
  });
  it.each(["repositoryId", "snapshotId", "locatorId"] as const)("rejects row substitution by %s", key => {
    const crypto = fixtureCrypto(); const { locatorEncrypted } = crypto.protectLocator(locator, context);
    expect(() => crypto.decryptLocator(locatorEncrypted, { ...context, [key]: randomUUID() })).toThrow("Locator could not be decrypted");
  });
  it("rejects changed ciphertext and purpose substitution", () => {
    const crypto = fixtureCrypto(); const { locatorEncrypted } = crypto.protectLocator(locator, context);
    const parts = locatorEncrypted.split("."); parts[6] = (parts[6][0] === "A" ? "B" : "A") + parts[6].slice(1);
    expect(() => crypto.decryptLocator(parts.join("."), context)).toThrow("Locator could not be decrypted");
    expect(() => crypto.decryptLocator(crypto.encryptBranch("synthetic-branch", context), context)).toThrow("Locator could not be decrypted");
  });
  it.each(["raw private source", "v1.1.0.0.AA.AA.AA", "v1.9.0.0.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAA"])("rejects invalid envelopes with no input in errors", value => {
    expect(() => fixtureCrypto().decryptLocator(value, context)).toThrow(/^Locator could not be decrypted$/);
  });
  it("retains old keys for immutable artifacts while new writes use a new version", () => {
    const old = fixtureCrypto().protectLocator(locator, context);
    const rotated = new LocatorCrypto({ activeVersion: "2.0.0", keys: {
      "1.0.0": { encryptionKey: Buffer.alloc(32, 17), fingerprintKey: Buffer.alloc(32, 29) },
      "2.0.0": { encryptionKey: Buffer.alloc(32, 31), fingerprintKey: Buffer.alloc(32, 37) },
    } });
    expect(rotated.decryptLocator(old.locatorEncrypted, context)).toEqual(locator);
    expect(rotated.protectLocator(locator, context).locatorEncrypted).toMatch(/^v1\.2\.0\.0\./);
  });
  it("requires separate full-length encryption and fingerprint secrets lazily", () => {
    expect(() => locatorCryptoFromEnvironment({})).toThrow("configuration is required");
    expect(() => locatorCryptoFromEnvironment({ EVIDENCE_LOCATOR_KEY_VERSION: "1.0.0", EVIDENCE_LOCATOR_ENCRYPTION_KEY: "bad", EVIDENCE_FINGERPRINT_KEY: "bad" })).toThrow("configuration is required");
    expect(() => new LocatorCrypto({ activeVersion: "1.0.0", keys: {} })).toThrow("Locator key unavailable");
    for (const keys of [{ encryptionKey: Buffer.alloc(16), fingerprintKey: Buffer.alloc(32) }, { encryptionKey: Buffer.alloc(32), fingerprintKey: Buffer.alloc(32) }]) {
      expect(() => new LocatorCrypto({ activeVersion: "1.0.0", keys: { "1.0.0": keys } })).toThrow("Invalid locator key configuration");
    }
    const crypto = locatorCryptoFromEnvironment({ EVIDENCE_LOCATOR_KEY_VERSION: "1.0.0", EVIDENCE_LOCATOR_ENCRYPTION_KEY: "11".repeat(32), EVIDENCE_FINGERPRINT_KEY: "22".repeat(32) });
    expect(crypto.decryptLocator(crypto.protectLocator(locator, context).locatorEncrypted, context)).toEqual(locator);
  });
});
