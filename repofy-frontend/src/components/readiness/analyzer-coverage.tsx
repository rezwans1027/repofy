import { COVERAGE_REASON_LABELS, type AnalyzerCoverage, type CoverageDeclaration } from "@repofy/contracts";

const depths = { inventory: "Inventory only", baseline: "Baseline structure", bounded_patterns: "Selected implementation patterns", unsupported: "Not supported" } as const;
const states = { assessable: "Declared scope assessed", partially_assessable: "Partially assessable", not_assessable: "Not assessable",
  evidence_not_observed_within_assessed_scope: "Evidence not observed within assessed scope" } as const;
const languages: Record<string, string> = { typescript: "TypeScript / TSX", javascript: "JavaScript / JSX", python: "Python", java: "Java", json: "JSON",
  yaml: "YAML", sql: "SQL", prisma: "Prisma", markdown: "Markdown", text: "Text", toml: "TOML", xml: "XML", dockerfile: "Dockerfile", kotlin: "Kotlin", swift: "Swift" };

export function CoveragePreview({ declaration }: { declaration?: CoverageDeclaration }) {
  return <aside aria-label="Analyzer support" className="rounded-lg border border-border p-4 space-y-2">
    <p className="font-medium">Coverage determined after scanning</p>
    {declaration ? <>
      <ul aria-label="Declared language support" className="flex flex-wrap gap-2">{[
        { id: "tsjs", label: "TypeScript / JavaScript" }, { id: "python", label: "Python" }, { id: "java", label: "Java" },
      ].map(({ id, label }) => {
        const support = declaration.entries.find(entry => entry.id === id);
        return <li key={id} className="rounded border border-border px-2 py-1 text-sm">{label}: {support ? depths[support.depth] : "Unknown support"}</li>;
      })}</ul>
      <p>SQL, configuration, documentation and CI can contribute evidence independently.</p>
      <p>Framework presence alone does not establish implementation support. Native mobile behavior and AI runtime quality are not assessed.</p>
      <p>All safe files enter inventory. Implementation analysis is limited to {declaration.selection.maxImplementationFiles} TS/JS files and 2 MiB of source, in path order. Omitted scope is recorded. Repositories over ingestion limits fail; no reduced scan is offered.</p>
      <p className="text-sm text-muted-foreground">Analyzer coverage {declaration.version}. Code, tests and builds are never run.</p>
      {declaration.disabledParsers.length > 0 && <p>{COVERAGE_REASON_LABELS.parser_disabled}</p>}
    </> : <p>Support details are unavailable. No language coverage is assumed.</p>}
  </aside>;
}

/** Shared by job progress and the later owner report. Old reports remain explicitly unknown. */
export function CoverageSummary({ coverage, label = "Analyzer coverage" }: { coverage?: AnalyzerCoverage; label?: string }) {
  const achieved = coverage?.assessment;
  if (!achieved) return <section aria-label={label}><p>Coverage unknown</p><p>{COVERAGE_REASON_LABELS.legacy_coverage_unknown}</p></section>;
  const counts = achieved.counts;
  return <section aria-label={label} className="space-y-3">
    <p className="font-medium">{states[achieved.state]} · coverage {achieved.declaration.version}</p>
    {achieved.result === "insufficient_evidence" && <p>Insufficient evidence. Choose repositories with supported source or wait for broader analyzer support. Repeating this scan will not add language support.</p>}
    <p>{counts.analyzedFiles} of {counts.totalFiles} discovered files structurally analyzed; {counts.eligibleFiles} eligible, {counts.excludedFiles} excluded, {counts.unparsedFiles} eligible files unparsed or unsupported.</p>
    <p>These are file processing counts, not skill scores. Excluded files have unknown language and capability scope.</p>
    {achieved.languages.length > 0 && <><div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm [&_th]:pr-3 [&_td]:pr-3"><caption className="text-left font-medium">Achieved language coverage</caption>
      <thead><tr><th scope="col">Language</th><th scope="col">Depth achieved</th><th scope="col">Files analyzed / eligible</th><th scope="col">Implementation pass</th></tr></thead>
      <tbody>{achieved.languages.map(row => <tr key={row.language}><th scope="row">{languages[row.language] ?? "Other language"}</th><td>{depths[row.depth]}</td>
        <td>{row.analyzedFiles} / {row.eligibleFiles}</td><td>{row.implementationAnalyzedFiles}</td></tr>)}</tbody></table></div>
      <ul aria-label="Achieved language coverage" className="space-y-3 sm:hidden">{achieved.languages.map(row => <li key={row.language} className="border-l-2 border-border pl-3 text-sm">
        <p className="font-medium">{languages[row.language] ?? "Other language"}: {depths[row.depth]}</p>
        <p>{row.analyzedFiles} / {row.eligibleFiles} eligible files structurally analyzed.</p>
        <p>{row.implementationAnalyzedFiles} files assessed for implementation patterns.</p>
      </li>)}</ul>
    </>}
    <ul className="list-disc pl-5">{achieved.reasons.map(reason => <li key={reason}>{COVERAGE_REASON_LABELS[reason]}</li>)}</ul>
    {coverage.structural && <details><summary>Source and history coverage</summary>
      <ul className="space-y-2 mt-2">{coverage.structural.sources.map(source => <li key={source.source}>{source.source}: {source.analyzedFiles} / {source.eligibleFiles} eligible files processed;
        {" "}{source.parseFailures} parse failures, {source.limitedFiles} budget limits, {source.unsupportedFiles} unsupported.</li>)}</ul>
      <p>Optional provider records are bounded to two pages of 50 per source. Source configuration alone does not show a passing CI run.</p>
      <ul>{coverage.structural.metadata.map(source => <li key={source.source}>{source.source}: {source.state.replaceAll("_", " ")}; {source.records} records, {source.exactCommitRecords} tied to this exact commit.</li>)}</ul>
    </details>}
    <details><summary>Capability assessment scope</summary><ul className="space-y-2 mt-2">{achieved.capabilities.map(cap => <li key={cap.capabilityId}>
      <span className="font-medium">{cap.capabilityId.replaceAll("_", " ")}: {states[cap.state]}</span>
      <p>{depths[cap.depth]}; {cap.observations} observations. {cap.analyzedFiles} / {cap.eligibleFiles} eligible files assessed.</p>
      {cap.reasons.includes("no_observed_evidence") && <p>{COVERAGE_REASON_LABELS.no_observed_evidence}</p>}
      {cap.reasons.includes("native_mobile_not_assessed") && <p>{COVERAGE_REASON_LABELS.native_mobile_not_assessed}</p>}
      {cap.reasons.includes("ai_runtime_not_assessed") && <p>{COVERAGE_REASON_LABELS.ai_runtime_not_assessed}</p>}
    </li>)}</ul></details>
  </section>;
}
