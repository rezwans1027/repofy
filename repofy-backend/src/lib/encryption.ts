import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";

const VERSION_BYTE = 0x01;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

let _key: Buffer | undefined;

function getKey(): Buffer {
  if (!_key) {
    _key = Buffer.from(env.tokenEncryptionKey, "hex");
    if (_key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
    }
  }
  return _key;
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns base64(0x01 || IV[12] || AuthTag[16] || Ciphertext[N]).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([
    Buffer.from([VERSION_BYTE]),
    iv,
    authTag,
    encrypted,
  ]);

  return packed.toString("base64");
}

/**
 * Decrypt a ciphertext produced by `encryptToken`.
 * Throws on tampered data or wrong key.
 */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const packed = Buffer.from(ciphertext, "base64");

  const version = packed[0];
  if (version !== VERSION_BYTE) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const iv = packed.subarray(1, 1 + IV_LENGTH);
  const authTag = packed.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Check whether a value looks like an encrypted token (starts with version byte
 * when base64-decoded). Used during migration to distinguish legacy plaintext
 * tokens from encrypted ones.
 */
export function isEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, "base64");
    // Must have at least version byte + IV + auth tag + 1 byte ciphertext
    return buf.length >= 1 + IV_LENGTH + AUTH_TAG_LENGTH + 1 && buf[0] === VERSION_BYTE;
  } catch {
    return false;
  }
}
