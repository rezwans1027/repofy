import { Resend } from "resend";
import { env } from "./env";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (!_client) {
    _client = new Resend(env.resendApiKey);
  }
  return _client;
}
