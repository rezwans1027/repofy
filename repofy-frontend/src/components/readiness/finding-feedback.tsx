"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FEEDBACK_CHOICES, FindingFeedbackResponseSchema, type FindingFeedbackResponse, type FindingReference } from "@repofy/contracts";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { privateQueryOptions, words } from "./report-shared";
type FeedbackProps = { actor: string; reportId: string; finding: FindingReference; label: string };
export function FindingFeedbackControl(props: FeedbackProps) {
  return <FindingFeedbackEditor key={`${props.actor}:${props.reportId}:${props.finding.kind}:${props.finding.id}`} {...props} />;
}
function FindingFeedbackEditor({ actor, reportId, finding, label }: FeedbackProps) {
  const client = useQueryClient(), radioId = useId(), alive = useRef(true), pending = useRef(false), dirty = useRef(false);
  const replay = useRef<{ body: string; key: string } | null>(null), draftRevision = useRef(0);
  const [open, setOpen] = useState(false), [choice, setChoice] = useState<typeof FEEDBACK_CHOICES[number]>("accurate"), [comment, setComment] = useState(""), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const key = ["readiness", actor, reportId, "feedback", finding.kind, finding.id], path = `/v1/readiness-reports/${reportId}/findings/${finding.kind}/${encodeURIComponent(finding.id)}/feedback`;
  function validate(data: FindingFeedbackResponse) {
    if (data.feedback && (data.feedback.reportId !== reportId || data.feedback.finding.kind !== finding.kind || data.feedback.finding.id !== finding.id)) throw new Error("Feedback membership mismatch"); return data;
  }
  const query = useQuery({ queryKey: key, ...privateQueryOptions, enabled: open,
    queryFn: async ({ signal }) => validate(await api.get<FindingFeedbackResponse>(path, { signal, cache: "no-store", schema: FindingFeedbackResponseSchema })) });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!dirty.current && query.data) { setChoice(query.data.feedback?.classification ?? "accurate"); setComment(query.data.feedback?.comment ?? ""); draftRevision.current = query.data.feedback?.revision ?? 0; } }, [query.data]);
  async function save() {
    if (pending.current || !query.data?.writable) return;
    pending.current = true; setBusy(true); setStatus("");
    const body = { classification: choice, comment, expectedRevision: draftRevision.current }, serialized = JSON.stringify(body);
    if (replay.current?.body !== serialized) replay.current = { body: serialized, key: crypto.randomUUID() };
    try {
      await client.cancelQueries({ queryKey: key });
      const data = validate(await api.post<FindingFeedbackResponse>(path, { body: { ...body, idempotencyKey: replay.current.key }, cache: "no-store", schema: FindingFeedbackResponseSchema }));
      if (!alive.current) return;
      dirty.current = false; replay.current = null; client.setQueryData(key, data); setStatus("Feedback saved for this finding version. It is awaiting review.");
    } catch (error) { if (alive.current) setStatus(error instanceof ApiError && error.status === 409 ? "Another response was saved. Reload the current response before editing." : "Feedback could not be confirmed. Keep comments short and omit credentials or personal details, then retry."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  async function reload() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setStatus("");
    try {
      const result = await query.refetch();
      if (!alive.current || !result.data || result.error) return;
      dirty.current = false; replay.current = null; draftRevision.current = result.data.feedback?.revision ?? 0;
      setChoice(result.data.feedback?.classification ?? "accurate"); setComment(result.data.feedback?.comment ?? "");
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="border-t border-border pt-3"><summary className="cursor-pointer font-medium">Feedback on {label}</summary>
    {open && <div className="mt-3 space-y-3 sentry-block" data-sentry-block><p>Your response is attached to this saved finding. It informs review; it does not change scores or verified claims. Comments are private to your account, are not sent to email or a model, and expire after 180 days without an edit. Avoid source code, credentials and personal details.</p>
      {query.isPending && <p role="status">Loading your response…</p>}{query.error && <p role="alert">Your response could not be loaded. Try again.</p>}
      {query.data && !query.error && <><p>Current response: {query.data.feedback ? words(query.data.feedback.classification) : "None"}. Review: {query.data.feedback ? words(query.data.feedback.disposition) : "Not submitted"}.</p>
        {!query.data.writable ? <p>New feedback is currently unavailable. Your saved response remains readable.</p> : <><fieldset disabled={busy}><legend className="font-medium">How accurate is this finding?</legend><div className="flex flex-wrap gap-3">{FEEDBACK_CHOICES.map(value => <label key={value} className="flex items-center gap-2"><input type="radio" name={radioId} value={value} checked={choice === value} onChange={() => { dirty.current = true; setChoice(value); }} />{value[0].toUpperCase() + value.slice(1)}</label>)}</div></fieldset>
          <label className="block">Optional comment<textarea maxLength={1000} disabled={busy} value={comment} onChange={e => { dirty.current = true; setComment(e.target.value); }} className="block w-full rounded-md border border-border bg-background p-2" rows={3} /></label>
          <Button disabled={busy} onClick={save}>{busy ? "Saving feedback…" : query.data.feedback ? "Update finding feedback" : "Save finding feedback"}</Button></>}</>}
      {status && <p role="status">{status}</p>}<Button variant="outline" disabled={busy} onClick={reload}>Reload current response</Button>
    </div>}
  </details>;
}
