"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { Claim, ReportEvent, ReportEvidenceQuery } from "@repofy/contracts";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

export const privateQueryOptions = { staleTime: 0, gcTime: 0, retry: false as const, refetchOnWindowFocus: true, refetchOnReconnect: true };
export const cardClass = "min-w-0 rounded-xl border border-border bg-card p-5 space-y-3";
export const percent = (value: number | null) => value === null ? "Unknown" : `${Number((value * 100).toFixed(2))}%`;
export const words = (value: string) => value.replaceAll("_", " ");
export type OpenEvidence = (query: ReportEvidenceQuery) => void;

export function ReadinessOwner({ children }: { children: (actor: string) => ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">Loading your account…</p>;
  if (!user) return <p>Sign in to view your private readiness reports.</p>;
  return <OwnerCache key={user.id} actor={user.id}>{children(user.id)}</OwnerCache>;
}
function OwnerCache({ actor, children }: { actor: string; children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => () => { void client.cancelQueries({ queryKey: ["readiness", actor] }); client.removeQueries({ queryKey: ["readiness", actor] }); }, [actor, client]);
  return <div className="sentry-block break-words [overflow-wrap:anywhere]" data-sentry-block>{children}</div>;
}
export function ReadinessError({ error, retry }: { error: unknown; retry?: () => void }) {
  const text = error instanceof ApiError && error.status === 404 ? "This report or evidence is unavailable. It may have been deleted or belong to another account."
    : error instanceof ApiError && error.status === 401 ? "Your session expired. Sign in again to continue."
      : "We could not load a valid saved report. Your data has not changed. Try again.";
  return <div role="alert" className={cardClass}><p>{text}</p>{retry && <Button variant="outline" onClick={retry}>Try again</Button>}</div>;
}
export function recordReportEvent(reportId: string, event: ReportEvent) {
  // Only enumerated event names and opaque IDs. Telemetry never blocks reading.
  void api.post(`/v1/readiness-reports/${reportId}/events`, { body: event, cache: "no-store" }).catch(() => undefined);
}
export function ClaimText({ claim, openEvidence }: { claim: Claim; openEvidence: OpenEvidence }) {
  return <div className="space-y-2"><p>{claim.text}</p>{claim.verification === "unverified"
    ? <p className="text-sm text-muted-foreground">Unverified · {claim.basis === "candidate_reported" ? "Candidate reported" : "Insufficient evidence"}</p>
    : <div className="flex flex-wrap gap-2">{claim.evidenceIds.map((id, i) => <Button key={id} variant="outline" size="sm" onClick={() => openEvidence({ evidenceId: id })}>Supporting evidence {i + 1}</Button>)}</div>}</div>;
}
export function DeleteAnalysis({ id, kind = "report", onDeleted }: { id: string; kind?: "report" | "job"; onDeleted?: () => void }) {
  const client = useQueryClient(), router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function remove() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      await api.delete(`/v1/${kind === "job" ? "analyses" : "readiness-reports"}/${id}`, { cache: "no-store", schema: z.strictObject({ deleted: z.literal(true) }) });
      if (!alive.current) return;
      await client.cancelQueries({ queryKey: ["readiness"] }); client.removeQueries({ queryKey: ["readiness"] });
      await client.cancelQueries({ queryKey: ["analyses"] }); client.removeQueries({ queryKey: ["analyses"] });
      setOpen(false); if (onDeleted) onDeleted(); else router.replace("/readiness");
    } catch { if (alive.current) setError(true); } finally { if (alive.current) setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogTrigger asChild><Button variant="outline">Delete analysis</Button></DialogTrigger>
    <DialogContent className="sentry-block" data-sentry-block><DialogTitle>Delete this analysis?</DialogTitle>
      <DialogDescription>This removes the saved report and its analysis records, and stops dependent active work. Other analyses and your repository selection are retained.</DialogDescription>
      {error && <p role="alert">Deletion could not be confirmed. Try again.</p>}
      <DialogFooter><DialogClose asChild><Button variant="outline" disabled={busy}>Keep analysis</Button></DialogClose>
        <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete permanently"}</Button></DialogFooter>
    </DialogContent></Dialog>;
}
