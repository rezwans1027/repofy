"use client";
import type { ReportView, SnapshotProvenance } from "@repofy/contracts";
import { cardClass, words } from "./report-shared";
const labels: Record<SnapshotProvenance["signals"][number], string> = {
  provider_fork: "The provider declares this repository a fork. Original work may also be present.",
  provider_template_origin: "The provider exposes a template-origin relationship. This does not describe how much the project changed.",
  generated_files: "Generated-file patterns affected the recorded scan scope. This is a heuristic classification, not AI-code detection.",
  vendor_files: "Dependency/vendor paths were excluded. Their presence does not establish individual authorship.",
  possible_bulk_initial_commit: "A single visible root head contains at least 100 files. Importing or squashing can produce this pattern; bulk creation is only a possibility.",
  limited_history: "Visible history is limited. Missing history does not imply missing skill.",
  multiple_linked_identities: "The history sample includes both the connected provider identity and another linked identity. Responsibilities are unknown.",
  connected_identity_association: "A provider-linked commit identity matches the connected GitHub account. This is an account association, not proof of implementation authorship.",
  other_identity_association: "A provider-linked commit identity differs from the connected account. This is not evidence of misconduct.",
  unlinked_commit_author: "Some commit records lack a provider-linked author identity. Author names and emails are not used as identity verification.",
  history_unavailable: "History was unavailable or not requested. Contribution remains unknown.",
};
export function ProvenancePanel({ view }: { view: ReportView }) {
  const assessment = view.aggregation?.provenance;
  return <section className="space-y-4" aria-labelledby="provenance-heading"><h2 id="provenance-heading" className="text-2xl font-semibold">Contribution and provenance context</h2>
    <p>Contribution confidence: Unknown. Context does not establish definitive authorship, legal ownership, AI generation, personal skill or understanding. Forks, templates, private work and unavailable history carry no automatic score penalty.</p>
    {!assessment ? <p>This older analysis did not retain the provenance context policy. An explicit rescan can use the current policy; this saved report remains unchanged.</p> : <><p>Policy {assessment.policy.id} · {assessment.policy.version}. Capability strength and confidence are unchanged by these context signals.</p>
      {assessment.snapshots.map(s => <article className={cardClass} key={s.snapshotId}><h3 className="font-semibold">{view.report.snapshots.find(r => r.snapshotId === s.snapshotId)?.repositoryLabel ?? "Repository"}</h3>
        <p>Observed {new Date(s.observedAt).toLocaleString()}. Fork/template information is current provider context; history describes the pinned commit and bounded ancestors.</p>
        <p>History: {words(s.history.state)} · {s.history.records} records. Connected account associations: {s.history.linkedToConnected}; other linked accounts: {s.history.linkedToOthers}; unlinked: {s.history.unlinked}.</p>
        <p>Excluded generated paths: {s.files.generatedExcluded}; source files with generated markers: {s.files.generatedMarked}; dependency/vendor files: {s.files.vendorExcluded}; total inventory: {s.files.total}.</p>
        <ul className="list-disc space-y-2 pl-5">{s.signals.map(signal => <li key={signal}>{labels[signal]}</li>)}</ul>
        <p>Provider context: {words(s.provider.state)}. {s.provider.fork === null ? "Fork status unknown." : s.provider.fork ? "Provider-declared fork." : "The provider does not declare a fork."} {s.provider.templateOrigin === "unknown" && "Template origin unknown; a missing relationship does not prove a project started from scratch."}</p>
      </article>)}</>}
  </section>;
}
