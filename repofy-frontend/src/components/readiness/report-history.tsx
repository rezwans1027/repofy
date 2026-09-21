"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ReportHistorySchema, type ReportHistory } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ReadinessOwner, ReadinessError, privateQueryOptions, cardClass } from "./report-shared";

export function ReadinessHistory() { return <ReadinessOwner>{actor => <History key={actor} actor={actor} />}</ReadinessOwner>; }
function History({ actor }: { actor: string }) {
  const [cursors, setCursors] = useState<string[]>([]); const after = cursors.at(-1);
  const query = useQuery({ queryKey: ["readiness", actor, "history", after], ...privateQueryOptions,
    queryFn: ({ signal }) => api.get<ReportHistory>(`/v1/readiness-reports?limit=20${after ? `&afterReportId=${after}` : ""}`, { signal, cache: "no-store", schema: ReportHistorySchema }) });
  return <section className="space-y-6"><header className="space-y-3"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Private workspace</p>
    <h1 className="text-3xl font-semibold">Project evidence and role readiness</h1>
    <p className="text-muted-foreground">Explore what your repositories demonstrate, where evidence is limited, and what to build next.</p>
    <div className="flex flex-wrap gap-4"><Link className="underline" href="/readiness/new">Select repositories</Link><Link className="underline" href="/readiness/jobs">Analysis progress and history</Link></div></header>
    {query.isPending && <p role="status">Loading saved reports…</p>}
    {query.error && <ReadinessError error={query.error} retry={() => void query.refetch()} />}
    {query.error && cursors.length > 0 && <Button variant="outline" onClick={() => setCursors([])}>Return to latest reports</Button>}
    {!query.error && query.data && <><h2 className="text-xl font-semibold">Saved reports</h2>
      {query.data.items.length === 0 && <div className={cardClass}><h3 className="font-medium">No saved reports yet</h3><p>Choose authorized repositories to start your first private analysis. Completed reports will appear here.</p></div>}
      <ul className="grid gap-4 sm:grid-cols-2">{query.data.items.map(report => <li key={report.reportId} className={cardClass}>
        <h3 className="font-semibold"><Link className="underline" href={`/readiness/reports/${report.reportId}`}>Report from {new Date(report.createdAt).toLocaleString()}</Link></h3>
        <p>{report.repositoryCount} {report.repositoryCount === 1 ? "repository" : "repositories"} · Owner only</p>
      </li>)}</ul>
      <nav aria-label="Report pages" className="flex gap-3"><Button variant="outline" disabled={!cursors.length} onClick={() => setCursors(c => c.slice(0, -1))}>Previous reports</Button>
        <Button variant="outline" disabled={!query.data.nextReportId} onClick={() => setCursors(c => [...c, query.data!.nextReportId!])}>More reports</Button></nav></>}
    <p className="text-sm text-muted-foreground">Saved results remain readable while new analyses are unavailable. <Link className="underline" href="/settings">Export your data or delete your account in Settings.</Link></p>
  </section>;
}
