"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ReportViewSchema, type ReportEvidenceQuery, type ReportView } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CoverageSummary } from "./analyzer-coverage";
import { CapabilityMap, Improvements, RoleViews } from "./report-assessments";
import { EvidenceExplorer } from "./evidence-explorer";
import { useRoleFocus } from "./role-focus";
import { RescanPanel } from "./rescan-panel";
import { ProvenancePanel } from "./provenance-panel";
import { ReadinessOwner, ReadinessError, privateQueryOptions, cardClass, ClaimText, DeleteAnalysis, recordReportEvent, type OpenEvidence } from "./report-shared";

export function ReadinessReport({ reportId, evidenceId }: { reportId: string; evidenceId?: string }) {
  return <ReadinessOwner>{actor => <OwnedReport key={`${actor}:${reportId}:${evidenceId ?? ""}`} actor={actor} reportId={reportId} evidenceId={evidenceId} />}</ReadinessOwner>;
}
function OwnedReport({ actor, reportId, evidenceId }: { actor: string; reportId: string; evidenceId?: string }) {
  const query = useQuery({ queryKey: ["readiness", actor, reportId, "view"], ...privateQueryOptions,
    queryFn: async ({ signal }) => {
      const view = await api.get<ReportView>(`/v1/readiness-reports/${reportId}/view`, { signal, cache: "no-store", schema: ReportViewSchema });
      if (view.report.ownerUserId !== actor || view.report.reportId !== reportId) throw new Error("Report membership mismatch");
      return view;
    } });
  useEffect(() => { if (query.data) recordReportEvent(reportId, { event: "report_viewed" }); }, [query.data, reportId]);
  if (query.isPending) return <p role="status">Loading your private report…</p>;
  if (query.error) return <ReadinessError error={query.error} retry={() => void query.refetch()} />;
  return query.data ? <ReportContent actor={actor} view={query.data} evidenceId={evidenceId} /> : null;
}
export function ReportContent({ actor, view, evidenceId }: { actor: string; view: ReportView; evidenceId?: string }) {
  const [filter, setFilter] = useState<ReportEvidenceQuery>(evidenceId ? { evidenceId } : {}); const [showEvidence, setShowEvidence] = useState(!!evidenceId);
  const focus = useRoleFocus(actor, view);
  const evidenceHeading = useRef<HTMLHeadingElement>(null); const returnTarget = useRef<HTMLElement | null>(null);
  const { report } = view;
  useEffect(() => { if (evidenceId) evidenceHeading.current?.focus(); }, [evidenceId]);
  const displayedClaims = new Set(report.capabilityGroups.flatMap(g => g.capabilities.flatMap(c => c.state === "assessed" ? [c.reasoning.claimId] : [])));
  const additionalClaims = report.claims.filter(c => !displayedClaims.has(c.claimId));
  const openEvidence: OpenEvidence = query => {
    returnTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFilter(query); setShowEvidence(true);
    // Focus the destination after React has committed an updated filter.
    requestAnimationFrame(() => evidenceHeading.current?.focus());
  };
  return <article className="space-y-10"><header className="space-y-4"><Link className="underline text-sm" href="/readiness">All saved reports</Link>
    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Owner only · Saved analysis</p><h1 className="text-3xl font-semibold">Your project evidence</h1>
    <p className="text-muted-foreground">A bounded view of what these repository snapshots demonstrate, with evidence and limitations you can inspect.</p>
    <p>Analyzed {new Date(report.createdAt).toLocaleString()} · {report.snapshots.length} {report.snapshots.length === 1 ? "repository" : "repositories"}</p>
    <nav aria-label="Report sections" className="flex flex-wrap gap-4 text-sm underline"><a href="#projects">Projects and scope</a><a href="#capabilities">Capabilities</a><a href="#roles">Role coverage</a><a href="#improvements">Improvements</a><a href="#evidence" onClick={() => setShowEvidence(true)}>Evidence</a></nav>
  </header>
    {focus.control}
    <RescanPanel actor={actor} view={view} />
    <aside className={cardClass} aria-label="How to read this report"><h2 className="font-semibold">Evidence has boundaries</h2><p>This report describes the selected snapshots. Source was inspected statically; code, tests, and builds were not executed. Contribution confidence and unassessable scope remain unknown.</p>
      <ul className="list-disc pl-5">{report.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></aside>
    <section id="projects" className="space-y-4" aria-labelledby="projects-heading"><h2 id="projects-heading" className="text-2xl font-semibold">Projects and analyzed scope</h2>
      <p className="text-sm text-muted-foreground">Repository labels preserve privacy. Inspect a permitted evidence location to confirm its GitHub name.</p>
      {report.snapshots.map(snapshot => {
        const access = view.repositories.find(r => r.snapshotId === snapshot.snapshotId);
        const supported = view.aggregation?.capabilities.filter(c => c.support.some(s => s.repositoryId === snapshot.repositoryId)) ?? [];
        return <article key={snapshot.snapshotId} className={cardClass}><h3 className="text-lg font-semibold">{snapshot.repositoryLabel}</h3>
          <p>{snapshot.repositoryVisibility === "private" ? "Private repository evidence" : "Public repository evidence"} · Owner-only report{access?.access === "revoked" ? " · Access revoked; locations hidden" : ""}</p>
          <p>Exact commit: <code className="break-all">{snapshot.commitSha}</code></p><p>Snapshot captured {new Date(snapshot.createdAt).toLocaleString()}</p>
          <CoverageSummary label={`Analyzer coverage for ${snapshot.repositoryLabel}`} coverage={report.coverage.find(c => c.snapshotId === snapshot.snapshotId)} />
          <details><summary className="cursor-pointer font-medium">Capability evidence in {snapshot.repositoryLabel}</summary>
            <div className="mt-3 flex flex-wrap gap-2">{supported.length ? supported.map(c => <Button key={c.capabilityId} variant="outline" size="sm" className="h-auto whitespace-normal"
              onClick={() => openEvidence({ repositoryId: snapshot.repositoryId, capabilityId: c.capabilityId })}>{view.capabilities.find(d => d.capabilityId === c.capabilityId)?.label ?? c.capabilityId.replaceAll("_", " ")}</Button>)
              : <p>No positive capability mappings were retained for this repository. Review coverage for unassessable scope.</p>}</div>
          </details>
          <Button variant="outline" onClick={() => openEvidence({ repositoryId: snapshot.repositoryId })}>Evidence from {snapshot.repositoryLabel}</Button>
        </article>;
      })}
      <details className={cardClass}><summary className="cursor-pointer font-medium">Analysis versions and provenance</summary>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">{[
          ["Run", report.analysisRunId], ["Report schema", report.contractVersion], ["Snapshot identity", report.versions.snapshotIdentity],
          ["Extractor", `${report.versions.extractorBundle.id} ${report.versions.extractorBundle.version}`], ["Detector bundle", `${report.versions.detectorBundle.id} ${report.versions.detectorBundle.version}`],
          ["Coverage manifest", report.versions.coverageManifest], ["Taxonomy", `${report.versions.taxonomy.id} ${report.versions.taxonomy.version}`],
          ["Aggregation", `${report.versions.aggregationPolicy.id} ${report.versions.aggregationPolicy.version}`], ["Disclosure", `${report.versions.disclosurePolicy.id} ${report.versions.disclosurePolicy.version}`],
          ["Security policy", report.versions.ingestionPolicyHash ?? "Not retained"], ["Model", report.versions.synthesis.kind === "model" ? `${report.versions.synthesis.model.identifier} ${report.versions.synthesis.model.version}` : "Not used"],
          ["Prompt", report.versions.synthesis.kind === "model" ? report.versions.synthesis.prompt.version : "Not used"],
          ["Narrative policy", report.narrative?.policy ?? "Not retained"], ["Improvement ranking", report.narrative?.rankingPolicy ?? "Not retained"],
        ].map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{key}</dt><dd className="break-all">{value}</dd></div>)}</dl>
        <p>Saved validated content is immutable. Access and privacy restrictions are checked separately.</p>
      </details>
    </section>
    <CapabilityMap view={focus.ordered} openEvidence={openEvidence} />
    <ProvenancePanel view={view} />
    {additionalClaims.length > 0 && <section className={cardClass}><h2 className="text-lg font-semibold">Additional statements</h2>{additionalClaims.map(c => <ClaimText key={c.claimId} claim={c} openEvidence={openEvidence} />)}</section>}
    <RoleViews view={focus.ordered} openEvidence={openEvidence} />
    <Improvements view={focus.ordered} openEvidence={openEvidence} />
    <section id="evidence" className="space-y-4" aria-labelledby="evidence-heading"><h2 ref={evidenceHeading} tabIndex={-1} id="evidence-heading" className="text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">Evidence explorer</h2>
      {showEvidence ? <><Button variant="outline" onClick={() => { setShowEvidence(false); if (returnTarget.current?.isConnected) returnTarget.current.focus(); else evidenceHeading.current?.focus(); }}>Close evidence and return</Button>
        <EvidenceExplorer actor={actor} view={view} filter={filter} setFilter={setFilter} /></> : <Button variant="outline" onClick={() => openEvidence({})}>Browse evidence</Button>}
    </section>
    <footer className="flex flex-wrap items-center gap-4 border-t border-border pt-6"><DeleteAnalysis id={report.reportId} /><Link className="underline text-sm" href="/settings">Account export and deletion</Link></footer>
  </article>;
}
