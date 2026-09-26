"use client";

import { MetadataOptionsSchema, type MetadataOptions, type ReportView, type SelectedRepository } from "@repofy/contracts";

export const NO_METADATA: MetadataOptions = { commits: false, pullRequests: false, ci: false };
export const metadataScope = (options: MetadataOptions) => [options.commits, options.pullRequests, options.ci].map(Number).join("");

export function readMetadataChoice(key: string, fallback: MetadataOptions): MetadataOptions {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw && MetadataOptionsSchema.safeParse(JSON.parse(raw));
    if (parsed && parsed.success) return parsed.data;
  } catch { /* Optional storage; current form state still works. */ }
  return fallback;
}
export function saveMetadataChoice(key: string, options: MetadataOptions) {
  try { sessionStorage.setItem(key, JSON.stringify(options)); } catch { /* Optional storage. */ }
}

/** Older API responses can still disclose requested scope through captured coverage. */
export function reportMetadataOptions(view: ReportView): MetadataOptions {
  if (view.metadataOptions) return view.metadataOptions;
  const requested = (sources: string[]) => view.report.coverage.some(c => c.structural?.metadata.some(m => sources.includes(m.source) && m.state !== "not_requested"));
  return { commits: requested(["commits"]), pullRequests: requested(["pullRequests"]), ci: requested(["checks", "statuses", "actions"]) };
}

const choices = [
  { key: "commits", label: "Include commit history", description: "Bounded history ending at each analyzed commit. Uses repository contents read access.", permissions: ["contents"] },
  { key: "pullRequests", label: "Include pull request metadata", description: "Pull requests associated with each analyzed commit. Requires Pull requests read access.", permissions: ["pullRequests"] },
  { key: "ci", label: "Include CI results", description: "Checks, commit statuses and Actions for each exact commit. Each source requires its corresponding read permission.", permissions: ["checks", "commitStatuses", "actions"] },
] as const;

export function MetadataChoices({ value, onChange, repositories, disabled = false }: {
  value: MetadataOptions; onChange(value: MetadataOptions): void; repositories: readonly SelectedRepository[]; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border border-border p-4">
    <legend className="px-1 font-medium">Optional repository metadata</legend>
    <p className="text-sm text-muted-foreground">Choose additional evidence to include. Read permissions are checked during analysis. Missing optional permissions or unavailable metadata are recorded as limitations. Source analysis still requires active repository access.</p>
    {choices.map(choice => {
      const known = repositories.filter(r => r.metadataPermissions);
      const missing = known.some(r => choice.permissions.some(p => r.metadataPermissions![p] === "none"));
      return <div key={choice.key} className="space-y-1">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={value[choice.key]}
          onChange={event => onChange({ ...value, [choice.key]: event.target.checked })} />
          <span><span className="font-medium">{choice.label}</span><span className="block text-sm text-muted-foreground">{choice.description}</span></span></label>
        {missing && <p className="text-sm">Last saved permissions are missing at least one required read scope for some selected repositories. Update the GitHub App installation to include that metadata.</p>}
        {known.length < repositories.length && <p className="text-sm text-muted-foreground">Saved permission details are incomplete. Current access will be checked when this metadata is requested.</p>}
      </div>;
    })}
  </fieldset>;
}
