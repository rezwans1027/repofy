import { getSupabaseAdmin } from "../../config/supabase";
import { readinessReader } from "../readiness/runtime";
import { GitHubSnapshotSource } from "../ingestion/source";
import { githubConnectionService } from "../github-app/runtime";
import { locatorCryptoFromEnvironment } from "../evidence/locator-crypto";
import { RescanService } from "./service";
export function rescanService() {
  return new RescanService(getSupabaseAdmin(), readinessReader(), {
    resolve: (...args) => new GitHubSnapshotSource(githubConnectionService()).resolve(...args),
  }, () => locatorCryptoFromEnvironment(process.env));
}
