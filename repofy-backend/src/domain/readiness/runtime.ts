import { getSupabaseAdmin } from "../../config/supabase";
import { locatorCryptoFromEnvironment } from "../evidence/locator-crypto";
import { githubConnectionService } from "../github-app/runtime";
import { ReadinessReader } from "./reader";
export function readinessReader() {
  return new ReadinessReader(getSupabaseAdmin(), () => locatorCryptoFromEnvironment(process.env), {
    verifyRepository: (...args) => githubConnectionService().verifyRepository(...args),
  });
}
