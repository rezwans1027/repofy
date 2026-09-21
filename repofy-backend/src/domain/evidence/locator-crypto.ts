import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { InternalLocatorSchema, type InternalLocator } from "@repofy/contracts/internal";

export interface LocatorKeyring {
  activeVersion: string;
  keys: Record<string, { encryptionKey: Buffer; fingerprintKey: Buffer }>;
}
export interface LocatorContext { repositoryId: string; snapshotId: string; locatorId: string }

/** Keys are injected by the worker's secret provider, never read from the database. */
export class LocatorCrypto {
  constructor(private readonly keyring: LocatorKeyring) {
    if (!keyring.keys[keyring.activeVersion]) throw new Error("Locator key unavailable");
    for (const [version, keys] of Object.entries(keyring.keys)) {
      if (!/^\d+\.\d+\.\d+$/.test(version) || keys.encryptionKey.length !== 32 || keys.fingerprintKey.length !== 32
        || timingSafeEqual(keys.encryptionKey, keys.fingerprintKey)) throw new Error("Invalid locator key configuration");
    }
  }

  private encrypt(value: unknown, context: LocatorContext, purpose: string): string {
    const version = this.keyring.activeVersion;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keyring.keys[version].encryptionKey, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(JSON.stringify(["repofy-locator-v1", version, purpose, context.repositoryId, context.snapshotId, context.locatorId])));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return `v1.${version}.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
  }

  protectLocator(input: InternalLocator, context: LocatorContext) {
    const locator = InternalLocatorSchema.parse(input);
    const version = this.keyring.activeVersion;
    // Repository-scoped keyed lookup; paths from unrelated repositories cannot be correlated.
    const fingerprint = createHmac("sha256", this.keyring.keys[version].fingerprintKey)
      .update(JSON.stringify(["repofy-locator-fingerprint-v1", context.repositoryId, locator])).digest("hex");
    return { locatorEncrypted: this.encrypt(locator, context, "locator"), fingerprint: `sha256:${fingerprint}`, fingerprintKeyVersion: version };
  }

  encryptBranch(branch: string, context: LocatorContext): string { return this.encrypt({ branch }, context, "branch"); }

  /** Internal content lookup only. Never publish a guessable hash of private source. */
  fingerprintContent(text: string, repositoryId: string): { digest: string; keyVersion: string } {
    const version = this.keyring.activeVersion;
    return { digest: `sha256:${createHmac("sha256", this.keyring.keys[version].fingerprintKey)
      .update(JSON.stringify(["repofy-content-v1", repositoryId, text])).digest("hex")}`, keyVersion: version };
  }

  decryptBranch(envelope: string, context: LocatorContext): string {
    const value = this.decrypt(envelope, context, "branch") as { branch?: unknown };
    if (!value || typeof value.branch !== "string") throw new Error("Locator could not be decrypted");
    return value.branch;
  }

  decryptLocator(envelope: string, context: LocatorContext): InternalLocator {
    try { return InternalLocatorSchema.parse(this.decrypt(envelope, context, "locator")); }
    catch { throw new Error("Locator could not be decrypted"); }
  }
  private decrypt(envelope: string, context: LocatorContext, purpose: string): unknown {
    try {
      const parts = envelope.split(".");
      if (parts.length !== 7 || parts[0] !== "v1") throw new Error();
      const version = parts.slice(1, 4).join(".");
      const key = this.keyring.keys[version];
      if (!key) throw new Error();
      const iv = Buffer.from(parts[4], "base64url");
      const tag = Buffer.from(parts[5], "base64url");
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", key.encryptionKey, iv, { authTagLength: 16 });
      decipher.setAAD(Buffer.from(JSON.stringify(["repofy-locator-v1", version, purpose, context.repositoryId, context.snapshotId, context.locatorId])));
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[6], "base64url")), decipher.final()]).toString("utf8"));
    } catch { throw new Error("Locator could not be decrypted"); }
  }
}

/** Lazy: disabled applications do not need locator secrets at startup. No OAuth key reuse. */
export function locatorCryptoFromEnvironment(values: Record<string, string | undefined>): LocatorCrypto {
  const version = values.EVIDENCE_LOCATOR_KEY_VERSION;
  const encryption = values.EVIDENCE_LOCATOR_ENCRYPTION_KEY;
  const fingerprint = values.EVIDENCE_FINGERPRINT_KEY;
  if (!version || !encryption || !fingerprint || !/^[a-fA-F0-9]{64}$/.test(encryption) || !/^[a-fA-F0-9]{64}$/.test(fingerprint)) {
    throw new Error("Locator key configuration is required for evidence persistence");
  }
  return new LocatorCrypto({ activeVersion: version, keys: { [version]: { encryptionKey: Buffer.from(encryption, "hex"), fingerprintKey: Buffer.from(fingerprint, "hex") } } });
}
