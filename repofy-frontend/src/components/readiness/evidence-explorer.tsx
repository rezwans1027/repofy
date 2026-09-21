"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EvidenceLocationResponseSchema, ReportEvidencePageSchema, type EvidenceLocationResponse, type ReportEvidenceItem,
  type ReportEvidencePage, type ReportEvidenceQuery, type ReportView } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { FindingFeedbackControl } from "./finding-feedback";
import { cardClass, percent, words, privateQueryOptions, ReadinessError, recordReportEvent, type OpenEvidence } from "./report-shared";

export function EvidenceExplorer({ actor, view, filter, setFilter }: { actor: string; view: ReportView; filter: ReportEvidenceQuery; setFilter: OpenEvidence }) {
  const params = new URLSearchParams(Object.entries({ ...filter, limit: 20 }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  const query = useQuery({ queryKey: ["readiness", actor, view.report.reportId, "evidence", params.toString()], ...privateQueryOptions,
    queryFn: async ({ signal }) => {
      const page = await api.get<ReportEvidencePage>(`/v1/readiness-reports/${view.report.reportId}/evidence?${params}`, { signal, cache: "no-store", schema: ReportEvidencePageSchema });
      if (page.items.some(({ evidence: e }) => !view.report.snapshots.some(s => s.snapshotId === e.snapshotId && s.repositoryId === e.repositoryId && s.commitSha === e.commitSha)
        || filter.evidenceId && filter.evidenceId !== e.evidenceId)) throw new Error("Evidence membership mismatch");
      return page;
    } });
  function change(key: string, value: string) { setFilter({ ...filter, [key]: value || undefined, evidenceId: undefined, afterEvidenceId: undefined,
    ...(key === "roleId" ? { requirementId: undefined } : {}) }); }
  const role = view.roleDefinitions.find(r => r.roleId === filter.roleId);
  return <div className="space-y-4"><p>Inspect the observations behind this report. Locations require a fresh permission check. Raw source is not retained.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      { key: "repositoryId", label: "Repository", all: "All repositories", options: view.report.snapshots.map(s => [s.repositoryId, s.repositoryLabel]) },
      { key: "categoryId", label: "Capability category", all: "All categories", options: view.categories.map(c => [c.categoryId, c.label]) },
      { key: "roleId", label: "Role", all: "All roles", options: view.roleDefinitions.map(r => [r.roleId, r.name]) },
      { key: "requirementId", label: "Role requirement", all: "All requirements", options: role?.requirements.map(r => [r.requirementId, r.label]) ?? [] },
    ].map(({ key, label, all, options }) => <label key={key} className="min-w-0 space-y-1 text-sm">{label}<select aria-label={label} className="block w-full min-w-0 rounded-md border border-border bg-background p-2" value={filter[key as keyof ReportEvidenceQuery] ?? ""}
      disabled={key === "requirementId" && !role} onChange={e => change(key, e.target.value)}><option value="">{all}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>)}</div>
    {filter.capabilityId && <p>Capability: {view.capabilities.find(c => c.capabilityId === filter.capabilityId)?.label ?? words(filter.capabilityId)}</p>}
    {filter.evidenceId && <p>Showing cited evidence from this report.</p>}
    <Button variant="outline" onClick={() => setFilter({})}>Clear evidence filters</Button>
    {query.isPending && <p role="status">Loading evidence…</p>}
    {query.error && <ReadinessError error={query.error} retry={() => void query.refetch()} />}
    {!query.error && query.data && <><p role="status">{query.data.items.length ? `${query.data.items.length} observations on this page.` : "No observations match this scope. This does not establish missing skill."}</p>
      {query.data.items.map(item => <EvidenceCard key={`${item.evidence.evidenceId}:${item.access}:${item.evidence.repositoryVisibility}`} actor={actor} reportId={view.report.reportId} item={item}
        repositoryLabel={view.report.snapshots.find(s => s.snapshotId === item.evidence.snapshotId)?.repositoryLabel ?? "Repository"} />)}
      <div className="flex flex-wrap gap-3">{filter.afterEvidenceId && <Button variant="outline" onClick={() => setFilter({ ...filter, afterEvidenceId: undefined })}>First evidence page</Button>}
        {query.data.nextEvidenceId && <Button variant="outline" onClick={() => setFilter({ ...filter, afterEvidenceId: query.data!.nextEvidenceId! })}>More evidence</Button>}</div></>}
  </div>;
}
export function EvidenceCard({ actor, reportId, item, repositoryLabel }: { actor?: string; reportId: string; item: ReportEvidenceItem; repositoryLabel: string }) {
  const { evidence: e } = item; const [location, setLocation] = useState<EvidenceLocationResponse>(); const [busy, setBusy] = useState(false);
  const alive = useRef(true), generation = useRef(0);
  useEffect(() => {
    alive.current = true; generation.current++;
    const clear = () => { generation.current++; setLocation(undefined); setBusy(false); };
    window.addEventListener("blur", clear); document.addEventListener("visibilitychange", clear);
    return () => { alive.current = false; window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, []);
  async function resolveLocation() {
    const current = ++generation.current; setBusy(true); setLocation(undefined);
    try {
      const result = await api.post<EvidenceLocationResponse>(`/v1/readiness-reports/${reportId}/evidence/${e.evidenceId}/location`, { cache: "no-store", schema: EvidenceLocationResponseSchema });
      if (alive.current && current === generation.current) setLocation(result);
    } catch { if (alive.current && current === generation.current) setLocation({ state: "unavailable", evidenceId: e.evidenceId }); }
    finally { if (alive.current && current === generation.current) setBusy(false); }
  }
  const privateEvidence = e.repositoryVisibility === "private" || location?.state === "available" && location.visibility === "private";
  return <article className={cardClass}><header className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{repositoryLabel} · {words(e.sourceType)} observation</h3>
    <span className="rounded-md border border-border px-2 py-1 text-xs">{privateEvidence ? "Verified private evidence" : "Verified public evidence"} · Owner only</span></header>
    {item.access === "revoked" && <p role="status">Access revoked. Saved observations remain available; locations are hidden. <Link href="/readiness/new" className="underline">Review repository access</Link>.</p>}
    <ul className="list-disc space-y-2 pl-5">{e.observations.map((text, i) => <li key={i}>{text}</li>)}</ul>
    <p>Evidence strength: {percent(e.strength)} · Confidence: {percent(e.confidence)}. These measurements do not establish authorship or candidate skill.</p>
    <details onToggle={event => { if (event.currentTarget.open) recordReportEvent(reportId, { event: "evidence_opened", objectId: e.evidenceId }); }}><summary className="cursor-pointer font-medium">Why this observation supports the claim</summary>
      <div className="mt-3 space-y-3">{item.support.length ? <ul className="list-disc pl-5">{Array.from(new Set(item.support.map(s => `${words(s.basis)}: ${words(s.boundary)}`))).map(s => <li key={s}>{s}</li>)}</ul> : <p>No positive capability mapping was accepted for this observation.</p>}
        {e.implementation && <ul className="list-disc pl-5">{e.implementation.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>}
        <p>Detector: {e.detector.id} · version {e.detector.version}</p><p>Exact commit: <code className="break-all">{e.commitSha}</code></p>
        <p>Snapshot: <code className="break-all">{e.snapshotId}</code></p><p>Contribution confidence: {e.contribution.state === "unknown" ? "Unknown" : percent(e.contribution.confidence)}</p>
        <ul className="list-disc pl-5">{e.contribution.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>
      </div></details>
    {item.access === "active" && <Button variant="outline" disabled={busy} onClick={resolveLocation}>{busy ? "Checking permission…" : "Inspect permitted location"}</Button>}
    {actor && <FindingFeedbackControl actor={actor} reportId={reportId} finding={{ kind: "evidence", id: e.evidenceId }} label={`${repositoryLabel} ${words(e.sourceType)} observation`} />}
    {location && <div role="status" className="space-y-2">{location.state === "available" ? <><p>{location.repositoryLabel}: <code>{location.label}</code>{location.lines && ` · lines ${location.lines.start}–${location.lines.end}`}</p>
      {location.url && !privateEvidence && <a className="underline" href={location.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open exact commit on GitHub</a>}
      {location.visibility === "private" && <p>Verified private evidence. Location visible only after your permission check.</p>}</>
      : <p>{location.state === "access_revoked" ? "Repository access changed. Location hidden; reconnect GitHub before trying again." : location.state === "not_retained" ? "A file location is not retained for this provider observation." : "The location could not be verified. Try again later; no source was fetched."}</p>}</div>}
  </article>;
}
