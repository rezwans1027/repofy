"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SavedRepositorySelectionSchema, RescanResponseSchema, RescanHistorySchema, type ReportView, type RescanHistory, type RescanResponse, type SavedRepositorySelection } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cardClass, privateQueryOptions, words } from "./report-shared";

export function RescanPanel({ actor, view }: { actor: string; view: ReportView }) {
  const router = useRouter(), reportId = view.report.reportId, base = `/v1/readiness-reports/${reportId}`;
  const [after, setAfter] = useState<string>(), [selected, setSelected] = useState<string[] | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const pending = useRef(false);
  const alive = useRef(true), replay = useRef<{ scope: string; key: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const availability = useQuery({ queryKey: ["readiness", actor, reportId, "rescan-availability"], ...privateQueryOptions,
    queryFn: ({ signal }) => api.get<{ available: boolean }>(`${base}/rescans/availability`, { signal, cache: "no-store", schema: z.strictObject({ available: z.boolean() }) }) });
  const selection = useQuery({ queryKey: ["readiness", actor, reportId, "rescan-selection"], ...privateQueryOptions, enabled: availability.data?.available === true,
    queryFn: ({ signal }) => api.get<SavedRepositorySelection>("/v1/repository-selections", { signal, cache: "no-store", schema: SavedRepositorySelectionSchema }) });
  const history = useQuery({ queryKey: ["readiness", actor, reportId, "rescans", after], ...privateQueryOptions,
    queryFn: ({ signal }) => api.get<RescanHistory>(`${base}/rescans?limit=20${after ? `&afterId=${after}` : ""}`, { signal, cache: "no-store", schema: RescanHistorySchema }),
    refetchInterval: q => q.state.data?.items.some(i => i.state === "queued" || i.state === "running") ? 5000 : false });
  const eligible = selection.data?.repositories.filter(r => r.status === "active") ?? [];
  const ids = (selected ?? eligible.filter(r => view.report.snapshots.some(s => s.repositoryId === r.repositoryId)).map(r => r.repositoryId)).filter(id => eligible.some(r => r.repositoryId === id));
  async function start() {
    if (pending.current || !ids.length) return; pending.current = true; setBusy(true); setMessage("");
    const storage = `repofy:rescan:${actor}:${reportId}:${selection.data?.revision}:${[...ids].sort().join(",")}`;
    try {
      let key: string | null = replay.current?.scope === storage ? replay.current.key : null;
      try { key ??= sessionStorage.getItem(storage); } catch { /* In-memory replay remains available. */ }
      if (!z.uuid().safeParse(key).success) key = crypto.randomUUID();
      replay.current = { scope: storage, key: key! };
      try { sessionStorage.setItem(storage, key!); } catch { /* Optional persistence. */ }
      const result = await api.post<RescanResponse>(`${base}/rescans`, { body: { repositoryIds: ids, idempotencyKey: key, includeMetadata: { commits: false, pullRequests: false, ci: false } }, cache: "no-store", schema: RescanResponseSchema });
      if (!alive.current) return;
      try { sessionStorage.removeItem(storage); } catch { /* Optional persistence. */ }
      replay.current = null;
      await history.refetch();
      if (!alive.current) return;
      if (result.state === "unchanged") setMessage("Nothing relevant changed. Your existing report is current for these commits and policies. No source was downloaded and no model call or charge was made.");
      else router.push(`/readiness/jobs/${result.job.jobId}`);
    } catch { if (alive.current) setMessage("The rescan could not be confirmed. Review repository access, then retry. Your baseline report is unchanged."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <section className={cardClass} aria-labelledby="rescans-heading"><h2 id="rescans-heading" className="text-xl font-semibold">Rescan and compare</h2>
    <p>This saved report is the baseline. A rescan pins the current commits of your chosen authorized repositories and preserves older reports. Unchanged compatible evidence is reused after permission checks. Internal rescans currently cost no credits.</p>
    <p>Optional GitHub history and CI metadata are off for this rescan. Comparisons explain any change in metadata scope.</p>
    {availability.data?.available ? <><fieldset className="space-y-2"><legend className="font-medium">Repositories for this rescan</legend>{eligible.map((r, index) => <label key={r.repositoryId} className="flex items-center gap-2">
      <input type="checkbox" checked={ids.includes(r.repositoryId)} disabled={busy} onChange={e => setSelected(e.target.checked ? [...ids, r.repositoryId] : ids.filter(id => id !== r.repositoryId))} />
      {view.report.snapshots.find(s => s.repositoryId === r.repositoryId)?.repositoryLabel ?? `Additional selected repository ${index + 1}`}</label>)}
      {!eligible.length && <p>No active saved repositories are available for this rescan.</p>}</fieldset>
      <Button disabled={busy || !ids.length || ids.length > (selection.data?.policy.maxRepositories ?? 0)} onClick={start}>{busy ? "Checking commits…" : "Rescan selected repositories"}</Button></>
      : <p>New rescans are unavailable. Saved reports remain readable.</p>}
    {selection.error && <p role="alert">Repository selection could not be loaded. Review access and try again.</p>}
    <Link className="block underline" href="/readiness/new">Manage authorized repository selection</Link>
    {message && <p role="status">{message}</p>}
    {history.error && <div><p role="status">Rescan history is temporarily unavailable.</p><Button variant="outline" onClick={() => { if (after) setAfter(undefined); else void history.refetch(); }}>Reload latest rescans</Button></div>}
    {history.data && <><h3 className="font-semibold">Immutable rescan history</h3>
      {history.data.parent.state === "available" && <p><Link className="underline" href={`/readiness/reports/${history.data.parent.reportId}`}>Open baseline report</Link>{" · "}
        <Link className="underline" href={`/readiness/reports/${history.data.parent.reportId}/compare/${reportId}`}>Compare with baseline</Link></p>}
      {history.data.parent.state === "unavailable" && <p>The baseline was deleted or is unavailable. It will not be reconstructed.</p>}
      {!history.data.items.length && <p>No rescans from this report yet.</p>}
      <ul className="space-y-2">{history.data.items.map(item => <li key={item.id}>{new Date(item.createdAt).toLocaleString()} · {words(item.state)}{" "}
        {item.reportId && item.state !== "unchanged" && <><Link className="underline" href={`/readiness/reports/${item.reportId}`}>Open saved result</Link>{" · "}<Link className="underline" href={`/readiness/reports/${reportId}/compare/${item.reportId}`}>Compare changes</Link></>}
        {item.jobId && !item.reportId && <Link className="underline" href={`/readiness/jobs/${item.jobId}`}>Open rescan progress</Link>}
        {item.state === "unchanged" && <span>Existing report retained; no charge.</span>}</li>)}</ul>
      <div className="flex gap-3">{after && <Button variant="outline" onClick={() => setAfter(undefined)}>Latest rescans</Button>}
        {history.data.nextId && <Button variant="outline" onClick={() => setAfter(history.data!.nextId!)}>Older rescans</Button>}</div></>}
  </section>;
}
