import { Router, type RequestHandler, type Request } from "express";
import { suppressTracing } from "@sentry/node";
import { z } from "zod";
import { GitHubConnectionStartResponseSchema, GitHubPageQuerySchema, GitHubRepositoryQuerySchema } from "@repofy/contracts";
import { getSupabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { extractAccessToken } from "../lib/cookie-utils";
import { sendError, sendSuccess } from "../lib/response";
import { digest, randomSecret } from "../domain/github-app/crypto";
import { GitHubAppError } from "../domain/github-app/errors";
import { ProviderId } from "../domain/github-app/provider";
import { githubConnectionService } from "../domain/github-app/runtime";
import type { ConnectionSession, GitHubConnectionService } from "../domain/github-app/service";
import { GitHubConnectionRepository } from "../domain/github-app/repository";

const COOKIE = "repofy_github_connection";
const cookieOptions = () => ({ httpOnly: true, secure: env.isProduction, sameSite: "lax" as const, path: "/api/v1/github/installations", maxAge: 600000 });
const sessionSchema = z.object({ sub: z.uuid(), session_id: z.uuid() });
const callbackQuery = z.strictObject({ state: z.string().regex(/^[A-Za-z0-9_-]{43}$/), installation_id: ProviderId.optional(),
  setup_action: z.enum(["install", "update", "request"]).optional() });
const authQuery = z.strictObject({ state: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().min(1).max(512).regex(/^[A-Za-z0-9_]+$/).optional(),
  error: z.string().max(100).optional(), error_description: z.string().max(2000).optional(), error_uri: z.string().max(2000).optional() });
function parsed<T>(schema: z.ZodType<T>, input: unknown): T {
  const value = schema.safeParse(input); if (!value.success) throw new GitHubAppError("invalid_request"); return value.data;
}

/** Revalidate the Supabase session for each integration request; no legacy token cache.
 * Only decode session_id AFTER getUser verifies this exact JWT. Refresh preserves session_id;
 * logout/new login does not. An expired callback requires signing in and restarting. */
export const requireConnectionSession: RequestHandler = async (req, res, next) => {
  const reject = () => {
    if (req.get("Accept")?.includes("text/html") && /\/github\/installations\/(authorize|callback)$/.test(req.path)) {
      res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
      res.redirect(303, "/login");
    } else sendError(res, 401, "Sign in to Repofy, then start the GitHub connection again.");
  };
  try {
    const token = extractAccessToken(req);
    if (!token || token.length > 16384) { reject(); return; }
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    let claims;
    try { claims = sessionSchema.parse(JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"))); } catch { /* rejected below */ }
    if (error || !data.user || !claims || claims.sub !== data.user.id) { reject(); return; }
    if (!await new GitHubConnectionRepository(getSupabaseAdmin()).activeSession(data.user.id, claims.session_id)) {
      reject(); return;
    }
    res.locals.githubActor = data.user.id;
    res.locals.githubSession = claims.session_id;
    next();
  } catch { reject(); }
};
function flowSession(req: Request, actor: string, sessionId: string, nonce?: string): ConnectionSession {
  const secret = nonce ?? req.cookies?.[COOKIE];
  if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new GitHubAppError("invalid_state");
  return { actor, binding: digest(`${actor}:${sessionId}:${secret}`), sessionId };
}
export function createGitHubAppRoutes(gate: RequestHandler, factory: () => GitHubConnectionService = githubConnectionService): Router {
  const router = Router();
  const handle = (fn: (req: Request, service: GitHubConnectionService, actor: string, session: string) => Promise<unknown>, redirect = false, start = false): RequestHandler => async (req, res, next) => {
    try {
      res.setHeader("Referrer-Policy", "no-referrer");
      const value = await suppressTracing(() => fn(req, factory(), res.locals.githubActor, res.locals.githubSession));
      if (redirect) {
        const result = value as { redirect: string; pending: boolean };
        if (!result.pending) res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
        else res.cookie(COOKIE, req.cookies[COOKIE], cookieOptions());
        res.redirect(303, result.redirect);
      } else if (start) {
        const result = value as { authorizeUrl: string; expiresAt: string; nonce: string };
        res.cookie(COOKIE, result.nonce, cookieOptions());
        sendSuccess(res, GitHubConnectionStartResponseSchema.parse({ authorizeUrl: result.authorizeUrl, expiresAt: result.expiresAt }));
      } else sendSuccess(res, value);
    } catch (error) {
      if (!(error instanceof GitHubAppError)) { next(error); return; }
      if (redirect) res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
      // Browser callbacks return to the same-origin picker with a safe, enumerated
      // recovery state. API callers retain the established structured error response.
      if (redirect && req.get("Accept")?.includes("text/html")) {
        res.redirect(303, `/readiness/new?github=${encodeURIComponent(error.code)}`);
        return;
      }
      const status = error.code === "not_found" || error.code === "installation_missing" ? 404 : error.code === "rate_limited" ? 429
        : ["provider_unavailable", "database_failure"].includes(error.code) ? 503
        : ["invalid_request", "invalid_state"].includes(error.code) ? 400 : 403;
      if (error.retryAfterSeconds) res.setHeader("Retry-After", error.retryAfterSeconds);
      sendError(res, status, error.message);
    }
  };
  router.post("/github/installations/start", gate, requireConnectionSession, handle(async (req, service, actor, session) => {
    const nonce = randomSecret();
    const result = await service.start(flowSession(req, actor, session, nonce), req.body);
    return { ...result, nonce };
  }, false, true));
  router.get("/github/installations/authorize", gate, requireConnectionSession, handle(async (req, service, actor, session) => {
    const query = parsed(authQuery, req.query);
    return service.authorize(flowSession(req, actor, session), query.state, query.error ? undefined : query.code);
  }, true));
  router.get("/github/installations/callback", gate, requireConnectionSession, handle(async (req, service, actor, session) => {
    const query = parsed(callbackQuery, req.query);
    return service.installed(flowSession(req, actor, session), query.state, query.installation_id, query.setup_action);
  }, true));
  router.get("/github/accounts", gate, requireConnectionSession, handle(async (req, service, actor) => {
    parsed(z.strictObject({}), req.query); return service.accounts(actor);
  }));
  router.delete("/github/accounts/:accountId", gate, requireConnectionSession, handle(async (req, service, actor) => {
    parsed(z.strictObject({}), req.query);
    await service.unlink(actor, parsed(z.uuid(), req.params.accountId)); return { disconnected: true };
  }));
  router.get("/github/installations", gate, requireConnectionSession, handle(async (req, service, actor) => {
    const query = parsed(GitHubPageQuerySchema, req.query);
    return service.installations(actor, query.accountId, query.cursor, query.perPage);
  }));
  router.get("/repositories", gate, requireConnectionSession, handle(async (req, service, actor) => {
    const query = parsed(GitHubRepositoryQuerySchema, req.query);
    return service.repositories(actor, query.accountId, query.installationId, query.cursor, query.perPage);
  }));
  return router;
}
