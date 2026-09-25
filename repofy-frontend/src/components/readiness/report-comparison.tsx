"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ComparisonSchema, EVIDENCE_CHANGES, type Comparison } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ReadinessOwner, ReadinessError, cardClass, privateQueryOptions, percent, words } from "./report-shared";
const difference = (n: number | null) => n === null ? "Unknown / not comparable numerically" : `${n > 0 ? "+" : ""}${Number((n * 100).toFixed(2))} percentage points`;
export function ReportComparison({ baselineId, targetId }: { baselineId: string; targetId: string }) {
  return <ReadinessOwner>{actor => <OwnedComparison key={`${actor}:${baselineId}:${targetId}`} actor={actor} baselineId={baselineId} targetId={targetId} />}</ReadinessOwner>;
}
function OwnedComparison({ actor, baselineId, targetId }: { actor: string; baselineId: string; targetId: string }) {
  const [repository, setRepository] = useState(""), [change, setChange] = useState(""), [capability, setCapability] = useState(""), [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ targetReportId: targetId, offset: String(offset), limit: "30", ...(repository ? { repositoryId: repository } : {}), ...(change ? { change } : {}), ...(capability ? { capabilityId: capability } : {}) });
  const query = useQuery({ queryKey: ["readiness", actor, baselineId, "comparison", params.toString()], ...privateQueryOptions,
    queryFn: async ({ signal }) => {
      const data = await api.get<Comparison>(`/v1/readiness-reports/${baselineId}/comparisons?${params}`, { signal, cache: "no-store", schema: ComparisonSchema });
      if (data.baseline.reportId !== baselineId || data.target.reportId !== targetId) throw new Error("Comparison membership mismatch");
      return data;
    } });
  if (query.isPending) return <p role="status">Comparing saved observations…</p>;
  if (query.error) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Comparison unavailable</h1><ReadinessError error={query.error} retry={() => void query.refetch()} /><p>Deleted baselines are not reconstructed. Comparisons may also be disabled during rollout.</p><Link className="underline" href="/readiness">Saved reports</Link></div>;
  const data = query.data!;
  function filter(set: (value: string) => void, value: string) { set(value); setOffset(0); }
  return <article className="space-y-8"><header className="space-y-3"><Link className="underline" href="/readiness">Saved reports</Link><h1 className="text-3xl font-semibold">Changes in your project evidence</h1>
    <p>Before {new Date(data.baseline.createdAt).toLocaleString()} → after {new Date(data.target.createdAt).toLocaleString()}</p>
    <div className="flex flex-wrap gap-4"><Link className="underline" href={`/readiness/reports/${baselineId}`}>Open baseline report</Link><Link className="underline" href={`/readiness/reports/${targetId}`}>Open target report</Link></div></header>
    <aside className={cardClass} aria-label="Comparison interpretation"><h2 className="text-xl font-semibold">{data.comparability === "comparable" ? "Compatible evidence measurements" : "Interpret differences with care"}</h2>
      <ul className="list-disc space-y-2 pl-5">{data.notes.map(note => <li key={note}>{note}</li>)}</ul><p>Recorded causes: {data.causes.length ? data.causes.map(words).join("; ") : "No commit, scope or version changes identified."}</p></aside>
    <section className="space-y-3" aria-labelledby="comparison-projects"><h2 id="comparison-projects" className="text-xl font-semibold">Repository snapshots</h2>{data.repositories.map(repo => <article key={repo.repositoryId} className={cardClass}><h3 className="font-semibold">{repo.label}</h3>
      {(["baseline", "target"] as const).map(side => <div key={side}><h4 className="font-medium">{side === "baseline" ? "Before" : "After"}</h4>{repo[side] ? <><p>Exact commit: <code className="break-all">{repo[side].commitSha}</code></p><p>Snapshot captured {new Date(repo[side].capturedAt).toLocaleString()} · {words(repo[side].visibility)} · {repo[side].access === "active" ? "Current access active" : "Access revoked; no source access inferred"}</p></> : <p>{side === "baseline" ? "Repository added to the selection." : "Repository removed from the selection; not a loss of skill."}</p>}</div>)}</article>)}</section>
    <details className={cardClass}><summary className="cursor-pointer font-medium">Analysis versions on each side</summary>{(["baseline", "target"] as const).map(side => <div key={side}><h2 className="font-semibold">{side === "baseline" ? "Before" : "After"}</h2><dl className="space-y-2 text-sm">{Object.entries(data[side].versions).map(([key, value]) => <div key={key}><dt>{words(key)}</dt><dd className="break-all">{typeof value === "object" ? JSON.stringify(value) : value}</dd></div>)}</dl></div>)}<p>Comparison algorithm: {data.algorithm}</p></details>
    <section className="space-y-3" aria-labelledby="delta-heading"><h2 id="delta-heading" className="text-xl font-semibold">Strength, confidence and assessability</h2><p>These are differences in recorded measurements. Unknown values remain unknown.</p>
      <ul className="grid gap-3 sm:grid-cols-2">{data.capabilities.filter(c => c.strengthDelta !== 0 || c.confidenceDelta !== 0 || c.assessabilityChanged).map(c => <li key={c.capabilityId} className={cardClass}><h3 className="font-semibold">{c.label}</h3>
        <p>Strength {percent(c.baseline?.strength ?? null)} → {percent(c.target?.strength ?? null)} · {difference(c.strengthDelta)}</p><p>Confidence {percent(c.baseline?.confidence ?? null)} → {percent(c.target?.confidence ?? null)} · {difference(c.confidenceDelta)}</p>
        <p>Assessed fraction {percent(c.baseline?.assessableFraction ?? null)} → {percent(c.target?.assessableFraction ?? null)}{c.assessabilityChanged ? " · Assessability changed" : ""}</p></li>)}</ul></section>
    <section className="space-y-3" aria-labelledby="role-deltas"><h2 id="role-deltas" className="text-xl font-semibold">Five role coverage changes</h2><ul className="grid gap-3 sm:grid-cols-2">{data.roles.map(role => <li key={role.roleId} className={cardClass}><h3 className="font-semibold">{words(role.roleId)}</h3>{data.algorithm !== "evidence-diff-1.0.3" || role.baseline === null && role.target === null ? <p>Role readiness comparison unavailable. Review each report for evidence and assessment limits.</p> : <><p>Coverage {percent(role.baseline)} → {percent(role.target)} · {difference(role.coverageDelta)}</p><p>Confidence change: {difference(role.confidenceDelta)}</p></>}<p>Unknown requirement weight {percent(role.baselineUnknownWeight)} → {percent(role.targetUnknownWeight)}</p></li>)}</ul></section>
    <section className="space-y-4" aria-labelledby="evidence-changes"><h2 id="evidence-changes" className="text-xl font-semibold">Evidence changes</h2>
      <p>{EVIDENCE_CHANGES.map(key => `${data.counts[key]} ${key}`).join(" · ")}. Counts describe both complete reports; filters below affect only this list.</p>
      <div className="grid gap-3 sm:grid-cols-3"><label>Repository<select aria-label="Comparison repository" className="block w-full rounded-md border bg-background p-2" value={repository} onChange={e => filter(setRepository, e.target.value)}><option value="">All repositories</option>{data.repositories.map(r => <option key={r.repositoryId} value={r.repositoryId}>{r.label}</option>)}</select></label>
        <label>Evidence change<select aria-label="Evidence change" className="block w-full rounded-md border bg-background p-2" value={change} onChange={e => filter(setChange, e.target.value)}><option value="">All changes</option>{EVIDENCE_CHANGES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Capability<select aria-label="Comparison capability" className="block w-full rounded-md border bg-background p-2" value={capability} onChange={e => filter(setCapability, e.target.value)}><option value="">All capabilities</option>{data.capabilities.map(c => <option key={c.capabilityId} value={c.capabilityId}>{c.label}</option>)}</select></label></div>
      <p role="status">{data.filteredCount} matching observations. {data.evidence.length} on this page.</p><ul className="space-y-3">{data.evidence.map(row => <li key={`${row.baselineEvidenceId}:${row.targetEvidenceId}`} className={cardClass}><h3 className="font-semibold">{words(row.change)} · {data.repositories.find(r => r.repositoryId === row.repositoryId)?.label}</h3>
        <p>{words(row.sourceType)} observation · {words(row.detector)} · Match: {words(row.basis)}</p><p>{row.interpretation === "uncertain_identity" ? "Identity uncertain. This is not counted as evidence gained or lost." : row.interpretation === "limited_by_scope_or_versions" ? "Scope, permission or version differences limit interpretation." : "Comparable stored observation; this is not a skill rating."}</p>
        <div className="flex flex-wrap gap-4">{row.baselineEvidenceId && <Link className="underline" href={`/readiness/reports/${baselineId}?evidence=${row.baselineEvidenceId}`}>Inspect baseline evidence</Link>}{row.targetEvidenceId && <Link className="underline" href={`/readiness/reports/${targetId}?evidence=${row.targetEvidenceId}`}>Inspect target evidence</Link>}</div></li>)}</ul>
      <div className="flex gap-3">{offset > 0 && <Button variant="outline" onClick={() => setOffset(0)}>First changes page</Button>}{data.nextOffset !== null && <Button variant="outline" onClick={() => setOffset(data.nextOffset!)}>More changes</Button>}</div>
    </section>
  </article>;
}
