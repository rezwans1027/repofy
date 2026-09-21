"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AnalysisJobResponseSchema, type AnalysisJobResponse, type SavedRepositorySelection, type StartAnalysisRequest } from "@repofy/contracts";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CoverageSummary } from "./analyzer-coverage";
import { DeleteAnalysis } from "./report-shared";

const options = { staleTime: 0, gcTime: 0, retry: false as const, refetchOnWindowFocus: true, refetchOnReconnect: true };
const message = (error: unknown) => error instanceof ApiError ? error.message : "Unable to reach analysis. Reconnect and try again.";
export function StartAnalysisButton({ actor, saved, disabled }: { actor: string; saved: SavedRepositorySelection; disabled: boolean }) {
  const router = useRouter(); const mounted = useRef(true); const pending = useRef(false);
  const submitted = useRef<StartAnalysisRequest | null>(null); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const available = useQuery({ queryKey: ["analyses", actor, "availability"], queryFn: ({ signal }) => api.get<{ available: boolean }>("/v1/analyses/availability", {
    signal, cache: "no-store", schema: z.strictObject({ available: z.boolean() }) }), ...options });
  async function start() {
    if (pending.current) return; pending.current = true; setBusy(true); setError(undefined);
    const storageKey = `repofy:analysis-request:${actor}:${saved.revision}`;
    try {
      if (!submitted.current) {
        let key: string | null = null;
        try { key = sessionStorage.getItem(storageKey); } catch { /* Memory key still survives request replay. */ }
        if (!z.uuid().safeParse(key).success) key = crypto.randomUUID();
        submitted.current = { contractVersion: "1.0.0", repositoryIds: saved.repositories.map(r => r.repositoryId),
          includeMetadata: { commits: false, pullRequests: false, ci: false }, failurePolicy: "fail_all_v1", idempotencyKey: key! };
        try { sessionStorage.setItem(storageKey, key!); } catch { /* Storage may be disabled. */ }
      }
      const job = await api.post<AnalysisJobResponse>("/v1/analyses", { body: submitted.current, schema: AnalysisJobResponseSchema });
      if (mounted.current) {
        try { sessionStorage.removeItem(storageKey); } catch { /* Optional persistence. */ }
        router.push(`/readiness/jobs/${job.jobId}`);
      }
    } catch (error) { if (mounted.current) setError(message(error)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="space-y-2"><Button disabled={disabled || busy || !available.data?.available} onClick={start} aria-describedby="analysis-availability">{busy ? "Starting…" : "Start Analysis"}</Button>
    <p id="analysis-availability" className="text-sm text-muted-foreground">{available.data?.available ? "Start with your saved selection. Analysis is private and currently costs no credits." : "Analysis is not available yet. Saving only updates repository authorization."}</p>
    {error && <p role="alert">{error}</p>}
    <Link href="/readiness/jobs" className="text-cyan underline">View previous analyses</Link>
  </div>;
}
const stageNames: Record<string, string> = { queued: "Waiting for a worker", acquiring_access: "Checking repository access", downloading: "Downloading pinned snapshots",
  inventorying: "Inventorying safe files", extracting: "Extracting evidence", aggregating: "Combining evidence", synthesizing: "Preparing report", validating: "Validating report",
  completed: "Completed", cleanup: "Cleaning up", authorization: "Checking access", snapshot: "Preparing snapshots", aggregation: "Combining evidence" };
const failures: Record<string, string> = {
  REPOSITORY_ACCESS_REVOKED: "Repository access changed. Reconnect GitHub and save an authorized selection before starting again.",
  CONSENT_REQUIRED: "Confirm your authorization in the repository selection before starting again.",
  MODEL_OUTCOME_UNKNOWN: "The report could not be safely recovered. No result was published. Contact support before starting again.",
  FEATURE_NOT_IMPLEMENTED: "A required analysis step is unavailable. Try a new analysis after the service is ready.",
  ANALYSIS_VALIDATION_FAILED: "The analysis did not pass validation. Review your repository selection or contact support.",
  PROVIDER_FAILURE: "The provider remained unavailable after bounded retries. Try a new analysis later.",
  DATABASE_FAILURE: "The analysis could not be saved after bounded retries. Try again later.",
  WORKER_EXPIRED: "The worker could not finish within its retry budget. Try a new analysis later.",
  REPOSITORY_TOO_LARGE: "A repository exceeded the scan limits. No partial scan was saved. Choose a smaller repository or use .repofyignore; excluded files remain part of the recorded limitations.",
  INSUFFICIENT_EVIDENCE: "The assessed scope contained insufficient evidence. Choose supported repositories or wait for broader analyzer support; repeating this scan does not add support.",
  UNSUPPORTED_ARCHIVE: "A repository archive or ignore rule could not be safely processed. Review the repository or contact support.",
  SECRET_SCAN_BLOCKED_CONTENT: "The security scan could not finish safely. Contact support before trying again.",
};
export function AnalysisProgress({ jobId }: { jobId?: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">Loading your account…</p>;
  if (!user) return <p>Sign in to view your analyses.</p>;
  return <OwnedProgress key={`${user.id}:${jobId ?? "list"}`} actor={user.id} jobId={jobId} />;
}
function OwnedProgress({ actor, jobId }: { actor: string; jobId?: string }) {
  const client = useQueryClient(); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false;
    void client.cancelQueries({ queryKey: ["analyses", actor] }); client.removeQueries({ queryKey: ["analyses", actor] }); }; }, [actor, client]);
  const query = useQuery({ queryKey: ["analyses", actor, jobId ?? "list"], queryFn: async ({ signal }) => jobId
    ? [await api.get<AnalysisJobResponse>(`/v1/analyses/${jobId}`, { signal, schema: AnalysisJobResponseSchema, cache: "no-store" })]
    : api.get<AnalysisJobResponse[]>("/v1/analyses", { signal, schema: z.array(AnalysisJobResponseSchema), cache: "no-store" }), ...options,
    refetchInterval: query => query.state.data?.some(job => ["queued", "running"].includes(job.status)) ? query.state.error ? 30000 : 5000 : false });
  const mutation = useMutation({ mutationFn: ({ id, action }: { id: string; action: "cancel" | "retry" }) =>
    api.post(`/v1/analyses/${id}/${action}`, { schema: AnalysisJobResponseSchema }),
    onSuccess: () => { if (mounted.current) void query.refetch(); } });
  return <section className="space-y-6 sentry-block" data-sentry-block>
    <h1 className="text-2xl font-semibold">{jobId ? "Analysis progress" : "Your analyses"}</h1>
    <p>Progress is saved. You can leave this page and return later.</p>
    <Link href="/readiness" className="block underline">Saved readiness reports</Link>
    <Link href="/readiness/new" className="text-cyan underline">Manage repository access or start a new analysis</Link>
    {query.isPending && <p role="status">Loading analysis…</p>}
    {query.error && <div role="alert"><p>{message(query.error)}</p><Button onClick={() => query.refetch()}>Reconnect and refresh</Button></div>}
    {mutation.error && <p role="alert">{message(mutation.error)}</p>}
    {query.data?.length === 0 && <p>No analyses yet.</p>}
    {query.data?.map(job => <article key={job.jobId} className="rounded-lg border border-border p-4 space-y-3">
      {!jobId && <Link href={`/readiness/jobs/${job.jobId}`} className="underline">Analysis from {new Date(job.createdAt).toLocaleString()}</Link>}
      <p role="status">{job.status === "completed" ? "Analysis completed" : job.status === "failed" ? "Analysis failed" : job.status === "canceled" ? "Analysis canceled" : job.status === "expired" ? "Analysis expired" : stageNames[job.stage] ?? "Processing evidence"}</p>
      {job.attempt && <p>Attempt {job.attempt.number} of 3</p>}
      {job.status === "queued" && job.attempt && <p>Waiting to retry after an interruption.</p>}
      {job.status === "failed" && <p>{failures[job.failureCode] ?? "This analysis could not finish. Review repository access and try again later."}</p>}
      {job.coverage?.map((coverage, index) => <CoverageSummary key={coverage.snapshotId} coverage={coverage}
        label={jobId && job.coverage?.length === 1 ? "Analyzer coverage" : `Analyzer coverage for repository ${index + 1} in analysis ${job.jobId}`} />)}
      {job.status === "completed" && !job.coverage?.length && <CoverageSummary />}
      {job.status === "expired" && <p>The analysis reached its time limit. Start a new analysis when ready.</p>}
      {job.status === "completed" && <Link href={`/readiness/reports/${job.report.reportId}`} className="underline">View saved report</Link>}
      {["queued", "running"].includes(job.status) && <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: job.jobId, action: "cancel" })}>Cancel analysis</Button>}
      {job.status === "queued" && job.attempt && <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: job.jobId, action: "retry" })}>Retry now</Button>}
      <DeleteAnalysis id={job.jobId} kind="job" onDeleted={jobId ? undefined : () => void query.refetch()} />
    </article>)}
  </section>;
}
