"use client";
import { useState } from "react";
import { roleAvailability, type AggregatedCapability, type ReportView } from "@repofy/contracts";
import { Button } from "@/components/ui/button";
import { FindingFeedbackControl } from "./finding-feedback";
import { cardClass, ClaimText, percent, recordReportEvent, words, type OpenEvidence } from "./report-shared";

export function CapabilityMap({ view, openEvidence }: { view: ReportView; openEvidence: OpenEvidence }) {
  return <section id="capabilities" className="space-y-6" aria-labelledby="capability-heading"><h2 id="capability-heading" className="text-2xl font-semibold">Capability map</h2>
    <p>Strength describes the evidence observed. Confidence describes how reliably the analyzer can interpret it. Neither is a measure of your overall ability.</p>
    <p className="text-sm text-muted-foreground">Not observed means no supporting evidence was found within assessed scope. Not assessable means the analyzer cannot make that judgment; it remains unknown.</p>
    {view.report.capabilityGroups.map(group => <section key={group.groupId} className="space-y-3"><h3 className="text-lg font-semibold">{view.categories.find(c => c.categoryId === group.groupId)?.label ?? words(group.groupId)}</h3>
      <div className="grid gap-4 md:grid-cols-2">{group.capabilities.map(cap => {
        const trace = view.aggregation?.capabilities.find(c => c.capabilityId === cap.capabilityId);
        const label = view.capabilities.find(c => c.capabilityId === cap.capabilityId)?.label ?? words(cap.capabilityId);
        return <article key={cap.capabilityId} className={cardClass}><h4 id={`capability-${cap.capabilityId}`} tabIndex={-1} className="font-semibold">{label}</h4>
          <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Evidence strength</dt><dd className="font-medium">{cap.state === "assessed" ? `${percent(cap.strength)} · ${words(trace?.strengthBand ?? "assessed")}` : cap.state === "unknown" ? "Unknown · Not assessable" : "Not observed"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Confidence</dt><dd className="font-medium">{cap.state === "unknown" ? "Unknown" : `${percent(cap.confidence)}${trace?.confidenceLabel ? ` · ${words(trace.confidenceLabel)}` : ""}`}</dd></div></dl>
          {cap.state === "assessed" ? <ClaimText claim={cap.reasoning} openEvidence={openEvidence} /> : <p>{cap.explanation}</p>}
          <details id={`capability-scope-${cap.capabilityId}`}><summary className="cursor-pointer font-medium">Calculation and scope for {label}</summary><div className="mt-3 space-y-3">
            {trace ? <Calculation trace={trace} view={view} openEvidence={openEvidence} /> : <p>A detailed calculation trace was not retained for this older report.</p>}
          </div></details>
          {cap.state === "assessed" && <Button variant="outline" className="h-auto whitespace-normal" onClick={() => openEvidence({ capabilityId: cap.capabilityId })}>Explore all evidence for {label}</Button>}
          <FindingFeedbackControl actor={view.report.ownerUserId} reportId={view.report.reportId} finding={{ kind: "capability", id: cap.capabilityId }} label={label} />
        </article>;
      })}</div></section>)}
  </section>;
}
function Calculation({ trace, view, openEvidence }: { trace: AggregatedCapability; view: ReportView; openEvidence: OpenEvidence }) {
  const selected = trace.trace.clusters.find(c => c.clusterId === trace.trace.selectedClusterId);
  return <><p>The strongest supported cluster is used. Repeated evidence and additional repositories do not automatically increase strength.</p>
    {selected && <><p>Base strength {percent(selected.baseStrength)}; presence ceiling {percent(selected.presenceCeiling)}; resulting strength {percent(selected.strength)}.</p>
      <Button variant="outline" size="sm" onClick={() => openEvidence({ evidenceId: selected.baseEvidenceId })}>Inspect base evidence</Button>
      <ul className="space-y-2">{selected.corroboration.map(c => <li key={c.evidenceId}>{words(c.sourceType)} corroboration: +{percent(c.bonus)} strength. <Button variant="outline" size="sm" onClick={() => openEvidence({ evidenceId: c.evidenceId })}>Inspect corroboration</Button></li>)}</ul></>}
    {trace.trace.confidence && <p>Detector reliability {percent(trace.trace.confidence.reliability)}; assessed coverage {percent(trace.trace.confidence.coverageFraction)}; coverage factor {trace.trace.confidence.coverageFactor}; independent support bonus {percent(trace.trace.confidence.independentSupportBonus)}; confidence ceiling {percent(trace.trace.confidence.ceiling)}.</p>}
    <ul className="list-disc space-y-2 pl-5">{trace.trace.coverage.map(c => <li key={c.snapshotId}>{view.report.snapshots.find(s => s.snapshotId === c.snapshotId)?.repositoryLabel}: {words(c.state)}. {c.analyzedFiles} / {c.eligibleFiles} eligible files assessed; {c.excludedFiles} excluded.
      {c.reasons.length > 0 && <p>Scope: {c.reasons.map(words).join("; ")}.</p>}</li>)}</ul>
    <p>Contribution confidence: Unknown. Authorship is not inferred.</p><p>Limitations: {trace.uncertainty.map(words).join("; ")}.</p>
  </>;
}

export function RoleViews({ view, openEvidence }: { view: ReportView; openEvidence: OpenEvidence }) {
  const label = (id: string) => view.capabilities.find(c => c.capabilityId === id)?.label ?? words(id);
  const availability = view.roleAvailability ?? roleAvailability(view.report);
  return <section id="roles" className="space-y-4" aria-labelledby="roles-heading"><h2 id="roles-heading" className="text-2xl font-semibold">Five role views</h2>
    <p>Coverage describes repository evidence against a versioned role rubric. It is not a hiring recommendation, a candidate ranking, or a seniority estimate. The rubric and confidence values are not calibrated for those uses.</p>
    {view.report.roles.map(result => {
      const role = view.aggregation?.roles.find(r => r.template.roleId === result.template.roleId);
      const definition = view.roleDefinitions.find(r => r.roleId === result.template.roleId);
      const status = availability.find(r => r.template.roleId === result.template.roleId)!;
      return <article key={result.template.roleId} className={cardClass}><h3 className="text-lg font-semibold">{definition?.name ?? words(result.template.roleId)}</h3>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Role readiness</dt><dd className="text-xl font-semibold">{status.state === "unknown" ? "Unknown" : status.state === "unavailable" ? "Unavailable" : result.state === "assessed" ? percent(result.coverage) : "Unknown"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Unknown requirement weight</dt><dd>{role ? percent(role.unknownWeight) : "Not retained"}</dd></div></dl>
        {status.state !== "available" && <p>{status.reason === "required_confidence_unattainable"
          ? "This analyzer cannot reach the confidence required by this role rubric. A low or zero rubric calculation does not measure your readiness. Review the observed capabilities and scope below."
          : status.reason === "insufficient_coverage" ? "The selected snapshots do not provide assessable evidence for this role. Your readiness remains unknown."
            : "This analysis policy has not been qualified for role readiness. Review the observed capabilities and scope below."}</p>}
        {result.state === "assessed" && <details><summary className="cursor-pointer font-medium">Recorded rubric calculation for {definition?.name ?? words(result.template.roleId)}</summary>
          <p className="mt-3">Limited calculation: {percent(result.coverage)} weighted coverage; {percent(result.confidence)} confidence. These are recorded policy values, not a usable readiness score.</p>
          {role && <p>All requirement weights remain in the denominator: {role.numerator} / {role.denominator}. Unknown requirements are not observed weaknesses.</p>}
        </details>}
        {role && <>
          <div className="flex flex-wrap items-center gap-2"><span>Supporting capabilities:</span>{role.strongestCapabilityIds.length ? role.strongestCapabilityIds.map(id => <Button key={id} variant="outline" size="sm" className="h-auto whitespace-normal" onClick={() => openEvidence({ capabilityId: id })}>{label(id)}</Button>) : <span>None assessed.</span>}</div>
          <p>Contributing repositories: {role.leadingRepositories.length ? role.leadingRepositories.map(r => `${view.report.snapshots.find(s => s.repositoryId === r.repositoryId)?.repositoryLabel} (${percent(r.contribution)} weighted contribution)`).join("; ") : "No supporting repository contribution assessed."}</p>
          {role.gaps.length > 0 && <div><h4 className="font-medium">Important evidence gaps</h4><ul className="list-disc pl-5">{role.gaps.slice(0, 5).map(g => <li key={g.requirementId}>
            {definition?.requirements.find(d => d.requirementId === g.requirementId)?.label ?? label(g.requirementId)}: {g.state === "not_assessable" ? "Unknown, not assessable" : words(g.state)} · {percent(g.impact)} rubric impact{g.required ? " · Required" : ""}
          </li>)}</ul></div>}
          <details><summary className="cursor-pointer font-medium">Requirements and important gaps for {definition?.name ?? words(result.template.roleId)}</summary>
            <ul className="mt-4 space-y-4">{role.requirements.map(req => <li key={req.requirementId} className="space-y-2 border-l-2 border-border pl-4"><h4 className="font-medium">{definition?.requirements.find(d => d.requirementId === req.requirementId)?.label ?? label(req.requirementId)} · {req.required ? "Required" : "Supporting"}</h4>
              <p>{req.state === "unknown" ? "Unknown · Not assessable" : req.state === "satisfied" ? "Evidence threshold met" : "Evidence threshold not met"} · Weight {percent(req.weight)} · Contribution {percent(req.weightedContribution)}</p>
              <p>Strength {percent(req.strength)}; confidence {percent(req.confidence)}. Minimum strength {percent(req.minimumEvidence)}, minimum confidence {words(req.minimumConfidence)}.</p>
              {req.failures.length > 0 && <ul className="list-disc pl-5">{req.failures.map(f => <li key={f.capabilityId}>{label(f.capabilityId)}: {f.reasons.map(words).join("; ")}</li>)}</ul>}
              <Button variant="outline" size="sm" onClick={() => openEvidence({ roleId: result.template.roleId, requirementId: req.requirementId })}>Evidence for this requirement</Button>
            </li>)}</ul></details></>}
        <ul className="list-disc pl-5">{result.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul><p className="text-sm text-muted-foreground">Rubric version {result.template.version}. Repository evidence does not establish all professional capability.</p>
      </article>;
    })}
  </section>;
}

export function Improvements({ view, openEvidence }: { view: ReportView; openEvidence: OpenEvidence }) {
  const [role, setRole] = useState(""); const [effort, setEffort] = useState("");
  const label = (id: string) => view.capabilities.find(c => c.capabilityId === id)?.label ?? words(id);
  function showScope(id: string) {
    const scope = document.getElementById(`capability-scope-${id}`);
    if (scope instanceof HTMLDetailsElement) scope.open = true;
    document.getElementById(`capability-${id}`)?.focus();
  }
  const items = view.report.improvements.filter(i => (!role || i.roleIds.some(id => id === role)) && (!effort || i.effort === effort));
  return <section id="improvements" className="space-y-4" aria-labelledby="improvements-heading"><h2 id="improvements-heading" className="text-2xl font-semibold">Prioritized improvements</h2>
    <p>These are proposals for future evidence. They are not achievements already observed in your projects.</p>
    <div className="flex flex-wrap gap-4"><label className="space-y-1 text-sm">Filter improvements by role<select className="block rounded-md border bg-background p-2" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{view.roleDefinitions.map(r => <option key={r.roleId} value={r.roleId}>{r.name}</option>)}</select></label>
      <label className="space-y-1 text-sm">Filter improvements by effort<select className="block rounded-md border bg-background p-2" value={effort} onChange={e => setEffort(e.target.value)}><option value="">All efforts</option>{["small", "medium", "large", "unknown"].map(e => <option key={e} value={e}>{words(e)}</option>)}</select></label></div>
    {!items.length && <p>No improvement proposals match these filters.</p>}
    <ol className="space-y-4">{items.map(item => <li key={item.improvementId} className={cardClass}><h3 className="text-lg font-semibold">{item.title}: {item.capabilityIds.map(label).join(", ")}</h3>
      <p>Proposed · {words(item.effort)} effort · Priority {item.priority}</p>
      <p>Relevant roles: {item.roleIds.map(id => view.roleDefinitions.find(r => r.roleId === id)?.name ?? words(id)).join(", ")}</p>
      <ul className="space-y-3" aria-label="Gaps addressed">{view.report.gaps.filter(g => item.gapIds.includes(g.gapId)).map(g => <li key={g.gapId}>
        <p className="font-medium">{label(g.capabilityId)} · {g.state === "not_assessable" ? "Unknown, not assessable" : g.state === "not_observed" ? "Evidence not observed within assessed scope" : "Limited evidence"}</p>
        <p>{g.explanation.text}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`#capability-${g.capabilityId}`} className="underline" onClick={() => showScope(g.capabilityId)}>Review scope for {label(g.capabilityId)}</a>
          {g.state === "limited_evidence" && <Button variant="outline" size="sm" className="h-auto max-w-full whitespace-normal" onClick={() => openEvidence({ capabilityId: g.capabilityId })}>Inspect evidence for {label(g.capabilityId)}</Button>}
        </div>
      </li>)}</ul>
      <ClaimText claim={item.rationale} openEvidence={openEvidence} />
      <details onToggle={event => { if (event.currentTarget.open) recordReportEvent(view.report.reportId, { event: "improvement_opened", objectId: item.improvementId }); }}><summary className="cursor-pointer font-medium">Plan and acceptance criteria</summary><div className="mt-4 space-y-3">
        <h4 className="font-medium">Expected evidence gained</h4><ul className="list-disc pl-5">{item.expectedProof.map((text, i) => <li key={i}>{text}</li>)}</ul>
        <h4 className="font-medium">Acceptance criteria</h4><ul className="list-disc pl-5">{item.acceptanceCriteria.map((text, i) => <li key={i}>{text}</li>)}</ul>
        <h4 className="font-medium">Why this priority</h4><ul className="list-disc pl-5">{item.priorityReasons.map((text, i) => <li key={i}>{text}</li>)}</ul>
        {item.priorityTrace && <p>Relevance {item.priorityTrace.roleRelevance}; gap {item.priorityTrace.gap}; expected proof {item.priorityTrace.expectedProof}; confidence {item.priorityTrace.confidence}; effort factor {item.priorityTrace.effortCost}. {item.priorityTrace.confidenceBasis === "unknown" ? "Unknown scope has no measured gap and receives priority zero." : "Factors are calculated by the server."}</p>}
        <p>Relevant projects: {item.repositoryIds?.length ? item.repositoryIds.map(id => view.report.snapshots.find(s => s.repositoryId === id)?.repositoryLabel).join(", ") : "No specific project location identified."}</p>
        <p>A change location has not been established. For observed evidence, choose Inspect evidence, then Inspect permitted location to check the file and commit. Review scope when no supporting evidence was observed; a proposal is not verified evidence.</p>
      </div></details>
    </li>)}</ol>
  </section>;
}
