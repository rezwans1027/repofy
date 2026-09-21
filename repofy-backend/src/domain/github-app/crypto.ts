import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { GitHubAppError } from "./errors";

export const randomSecret = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Only USER credentials, PKCE verifiers, cursors and private names may be sealed here.
 * Installation tokens never enter persistence. Purpose/actor binding prevents substitution. */
export class GitHubVault {
  private readonly key: Buffer;
  constructor(key: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new GitHubAppError("provider_unavailable");
    this.key = Buffer.from(key, "hex");
  }
  seal(value: unknown, context: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(`repofy-github-v1:${context}`));
    const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return ["g1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
  }
  open(value: string, context: string): unknown {
    try {
      const [version, iv, tag, bytes, extra] = value.split(".");
      if (version !== "g1" || extra || !iv || !tag || !bytes || value.length > 16000) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(`repofy-github-v1:${context}`));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8"));
    } catch { throw new GitHubAppError("reconnect_required"); }
  }
}
