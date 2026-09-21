import type { RequestHandler } from "express";
import { suppressTracing } from "@sentry/node";
import { env } from "../config/env";
import { getSupabaseAdmin } from "../config/supabase";
import { GitHubWebhookService } from "../domain/github-app/webhook";
import { SelectionError } from "../domain/github-app/selection";

export const handleGitHubWebhook: RequestHandler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await suppressTracing(() => new GitHubWebhookService(getSupabaseAdmin(), env.featureOne.githubWebhookSecret ?? "")
      .receive(req.body, req.headers["x-hub-signature-256"], req.headers["x-github-delivery"], req.headers["x-github-event"]));
    res.json(result);
  } catch (error) {
    res.status(error instanceof SelectionError ? error.status : 503).json({ error: error instanceof SelectionError ? error.message : "GitHub delivery could not be processed." });
  }
};
