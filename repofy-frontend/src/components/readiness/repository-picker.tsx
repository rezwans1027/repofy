"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { GitHubAccountsResponseSchema, GitHubConnectionStartResponseSchema, GitHubInstallationsResponseSchema,
  GitHubRepositoriesResponseSchema, GitHubRepositorySummarySchema, SavedRepositorySelectionSchema, type SavedRepositorySelection,
  type SaveRepositorySelectionSchema } from "@repofy/contracts";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { StartAnalysisButton } from "./analysis-progress";
import { CoveragePreview } from "./analyzer-coverage";

type Candidate = z.infer<typeof GitHubRepositorySummarySchema> & { ownerType: "User" | "Organization" };
const issueMessages: Record<string, string> = {
  invalid_state: "This connection expired or belongs to another session. Start again with Connect GitHub.",
  invalid_request: "This connection request is invalid. Start again with Connect GitHub.",
  not_found: "This connection is no longer available. Reconnect GitHub to continue.",
  database_failure: "The connection could not be saved. Try connecting again later.",
  pending_approval: "An organization owner must approve the GitHub App installation before repositories can appear.",
  installation_suspended: "This installation is suspended. Ask the installation owner to restore access, then refresh.",
  insufficient_permissions: "The GitHub App needs read access to repository contents. Manage the installation, then refresh.",
  reconnect_required: "Reconnect your GitHub identity. For an organization, sign in to its SSO first.",
  installation_missing: "Install the GitHub App for this account, or ask an organization owner to approve it.",
  access_changed: "Repository access changed. Refresh and select authorized repositories again.",
  rate_limited: "GitHub is limiting requests. Wait before refreshing.",
  provider_unavailable: "GitHub is temporarily unavailable. Try refreshing later.",
  pagination_limit: "Narrow the repositories available to this installation in GitHub settings.",
  identity_conflict: "This GitHub identity is already linked to another Repofy account.",
};
const queryOptions = { staleTime: 0, gcTime: 0, retry: false as const, refetchOnWindowFocus: true };
function message(error: unknown) { return error instanceof ApiError ? error.message : "Repository access is unavailable. Try refreshing."; }

export function RepositoryPicker({ connectionStatus }: { connectionStatus?: string } = {}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">Loading your account…</p>;
  if (!user) return <p>Sign in to manage repository access.</p>;
  // A user switch unmounts all private UI state, including pending selections and consent.
  return <OwnedPicker key={user.id} actor={user.id} connectionStatus={connectionStatus} />;
}
function OwnedPicker({ actor, connectionStatus }: { actor: string; connectionStatus?: string }) {
  const client = useQueryClient();
  const selection = useQuery({ queryKey: ["repository-access", actor, "selection"],
    queryFn: ({ signal }) => api.get<SavedRepositorySelection>("/v1/repository-selections", { signal, schema: SavedRepositorySelectionSchema, cache: "no-store" }), ...queryOptions });
  useEffect(() => () => { void client.cancelQueries({ queryKey: ["repository-access", actor] }); client.removeQueries({ queryKey: ["repository-access", actor] }); }, [actor, client]);
  return <section className="space-y-6 sentry-block" data-sentry-block aria-labelledby="repository-heading">
    <div className="space-y-2"><h1 id="repository-heading" className="text-2xl font-semibold">Select repository access</h1>
      <p className="text-muted-foreground">Save the repositories you authorize for future project evidence and role readiness analysis.</p></div>
    {selection.isPending && <p role="status">Loading saved selection…</p>}
    {selection.isError && <div role="alert"><p>{message(selection.error)}</p><Button onClick={() => selection.refetch()}>Retry saved selection</Button></div>}
    {selection.data && <SelectionEditor key={selection.data.revision} actor={actor} saved={selection.data} connectionStatus={connectionStatus} />}
  </section>;
}
function SelectionEditor({ actor, saved, connectionStatus: callbackStatus }: { actor: string; saved: SavedRepositorySelection; connectionStatus?: string }) {
  const client = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [account, setAccount] = useState(""); const [installation, setInstallation] = useState("");
  const [search, setSearch] = useState(""); const [attested, setAttested] = useState(false);
  const [notice, setNotice] = useState("");
  const [chosen, setChosen] = useState<Map<string, Candidate>>(() => new Map(saved.repositories.filter(item => item.status === "active").map(item => [item.repositoryId, item])));
  const retryRequest = useRef<{ fingerprint: string; body: z.infer<typeof SaveRepositorySelectionSchema> } | null>(null);
  const accounts = useQuery({ queryKey: ["repository-access", actor, "accounts"], queryFn: ({ signal }) => api.get<z.infer<typeof GitHubAccountsResponseSchema>>("/v1/github/accounts", { signal, schema: GitHubAccountsResponseSchema, cache: "no-store" }), ...queryOptions });
  const installations = useInfiniteQuery({ queryKey: ["repository-access", actor, "installations", account], enabled: !!account,
    initialPageParam: null as string | null, getNextPageParam: (page: z.infer<typeof GitHubInstallationsResponseSchema>) => page.nextCursor,
    queryFn: ({ signal, pageParam }) => api.get<z.infer<typeof GitHubInstallationsResponseSchema>>(`/v1/github/installations?${new URLSearchParams({ accountId: account, perPage: "30", ...(pageParam ? { cursor: pageParam } : {}) })}`, { signal, schema: GitHubInstallationsResponseSchema, cache: "no-store" }), ...queryOptions });
  const installationItems = [...new Map(installations.data?.pages.flatMap(page => page.installations).map(item => [item.installationId, item]) ?? []).values()];
  const currentInstallation = installationItems.find(item => item.installationId === installation);
  const repositories = useInfiniteQuery({ queryKey: ["repository-access", actor, "repositories", account, installation], enabled: !!currentInstallation && currentInstallation.status === "active" && currentInstallation.permissions.contents !== "none",
    initialPageParam: null as string | null, getNextPageParam: (page: z.infer<typeof GitHubRepositoriesResponseSchema>) => page.nextCursor,
    queryFn: ({ signal, pageParam }) => api.get<z.infer<typeof GitHubRepositoriesResponseSchema>>(`/v1/repositories?${new URLSearchParams({ accountId: account, installationId: installation, perPage: "30", ...(pageParam ? { cursor: pageParam } : {}) })}`, { signal, schema: GitHubRepositoriesResponseSchema, cache: "no-store" }), ...queryOptions });
  const repositoryItems = [...new Map(repositories.data?.pages.flatMap(page => page.repositories).map(item => [item.repositoryId, item]) ?? []).values()];
  const applySaved = (value: SavedRepositorySelection) => {
    if (!mounted.current) return;
    client.removeQueries({ queryKey: ["repository-access", actor, "repositories"] });
    client.setQueryData(["repository-access", actor, "selection"], value);
  };
  const save = useMutation({ mutationFn: (body: z.infer<typeof SaveRepositorySelectionSchema>) => api.post<SavedRepositorySelection>("/v1/repository-selections", { body, schema: SavedRepositorySelectionSchema }), onSuccess: applySaved });
  const remove = useMutation({ mutationFn: (grant: string) => api.delete<SavedRepositorySelection>(`/v1/repository-selections/${grant}`, { schema: SavedRepositorySelectionSchema }), onSuccess: applySaved });
  const connect = useMutation({ mutationFn: (accountId?: string) => api.post<z.infer<typeof GitHubConnectionStartResponseSchema>>("/v1/github/installations/start", { body: { intent: "install", returnTo: "/readiness/new", ...(accountId ? { accountId } : {}) }, schema: GitHubConnectionStartResponseSchema }),
    onSuccess: result => { if (mounted.current) window.location.assign(result.authorizeUrl); } });
  const busy = save.isPending || remove.isPending || connect.isPending;
  const needsAttestation = [...chosen.values()].some(item => item.visibility === "private" || item.ownerType === "Organization");
  const issues = [...new Set([...(installations.data?.pages.flatMap(page => page.issues) ?? []), ...(repositories.data?.pages.flatMap(page => page.issues) ?? [])])];
  const retryAfter = [...(installations.data?.pages ?? []), ...(repositories.data?.pages ?? [])].reduce((value, page) => Math.max(value, page.retryAfterSeconds ?? 0), 0);
  function toggle(item: Candidate) {
    setChosen(previous => { const next = new Map(previous); if (next.has(item.repositoryId)) next.delete(item.repositoryId); else if (next.size < saved.policy.maxRepositories) next.set(item.repositoryId, item); return next; });
    setAttested(false); setNotice("");
  }
  async function refresh() {
    setNotice("Refreshing access and saved selection…");
    setChosen(new Map()); setAttested(false);
    await client.resetQueries({ queryKey: ["repository-access", actor] });
    setNotice("");
  }
  function submit() {
    const repositories = [...chosen.values()].map(({ repositoryId, accountId, installationId }) => ({ repositoryId, accountId, installationId })).sort((a, b) => a.repositoryId.localeCompare(b.repositoryId));
    const content = { repositories, expectedRevision: saved.revision, ...(attested ? { attestation: { version: saved.policy.attestationVersion, accepted: true as const } } : {}) };
    const fingerprint = JSON.stringify(content);
    if (retryRequest.current?.fingerprint !== fingerprint) retryRequest.current = { fingerprint, body: { ...content, idempotencyKey: crypto.randomUUID() } };
    save.mutate(retryRequest.current.body);
  }
  return <div className="space-y-6">
    <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
      <p>Choose up to {saved.policy.maxRepositories} repositories. Archived repositories and repositories without a default branch are not eligible.</p>
      <p>The GitHub App uses read access to selected repositories. Your own GitHub permissions also limit access. Organization approval does not authorize you to submit every organization repository.</p>
      <p>Saving this selection stores access records and encrypted repository names. It does not fetch source code or run repository code, tests, or build tools. Reports are private by default.</p>
      <CoveragePreview declaration={saved.policy.coverage} />
    </div>
    {callbackStatus && issueMessages[callbackStatus] && <p role="status">{issueMessages[callbackStatus]}</p>}
    {callbackStatus === "connected" && <p role="status">GitHub connected. Choose an identity and installation below.</p>}
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy} onClick={() => connect.mutate(undefined)}>Connect GitHub</Button>
      <Button variant="outline" disabled={busy} onClick={refresh}>Refresh access and saved selection</Button>
      <a className="text-cyan underline self-center" href="https://github.com/settings/installations" target="_blank" rel="noreferrer">Manage GitHub installations</a>
    </div>
    {[accounts.error, installations.error, repositories.error, save.error, remove.error, connect.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{message(error)}</p>)}
    {save.error instanceof ApiError && save.error.code === "REPOSITORY_ACCESS_REVOKED" && <p role="alert">Access was revoked. Refresh before selecting repositories again.</p>}
    {notice && <p role="status">{notice}</p>}
    {accounts.isPending && <p role="status">Loading GitHub identities…</p>}
    {accounts.data?.accounts.length === 0 && <p>No GitHub identities connected. Connect GitHub to discover eligible repositories.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><label htmlFor="github-identity">GitHub identity</label><select id="github-identity" className="block w-full rounded border border-border bg-background p-2" value={account} disabled={busy} onChange={event => { setAccount(event.target.value); setInstallation(""); setSearch(""); }}>
        <option value="">Choose an identity</option>{accounts.data?.accounts.map(item => <option key={item.accountId} value={item.accountId}>{item.login} — {item.status.replaceAll("_", " ")}</option>)}</select></div>
      <div className="space-y-2"><label htmlFor="github-installation">Installation</label><select id="github-installation" className="block w-full rounded border border-border bg-background p-2" value={installation} disabled={!account || busy} onChange={event => { setInstallation(event.target.value); setSearch(""); }}>
        <option value="">Choose an installation</option>{installationItems.map(item => <option key={item.installationId} value={item.installationId}>{item.ownerLogin} — {item.ownerType}, {item.status}</option>)}</select></div>
    </div>
    {account && <Button variant="outline" disabled={busy} onClick={() => connect.mutate(account)}>Reconnect or install for this identity</Button>}
    {installations.isFetching && <p role="status">Loading installations…</p>}
    {account && installations.data && !installationItems.length && <p>No installations available. Install the app for this identity; organization installations may need owner approval.</p>}
    {installations.hasNextPage && <Button variant="outline" disabled={installations.isFetchingNextPage} onClick={() => installations.fetchNextPage()}>Load more installations</Button>}
    {currentInstallation && <p>{currentInstallation.ownerType} installation: {currentInstallation.status}. Repository scope: {currentInstallation.selection}. Contents permission: {currentInstallation.permissions.contents}.</p>}
    {currentInstallation?.status === "suspended" && <p role="status">{issueMessages.installation_suspended}</p>}
    {currentInstallation?.permissions.contents === "none" && <p role="status">{issueMessages.insufficient_permissions}</p>}
    {issues.map(issue => <p role="status" key={issue}>{issueMessages[issue]}</p>)}
    {retryAfter > 0 && <p>Try again after {retryAfter} seconds.</p>}
    {installation && <div className="space-y-3">
      <label className="block">Search loaded repositories<input type="search" className="mt-2 block w-full rounded border border-border p-2" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <p className="text-sm text-muted-foreground">Search covers repositories loaded for this installation. Load more to include additional pages.</p>
      {repositories.isFetching && <p role="status">Loading repositories…</p>}
      {repositories.data && !repositoryItems.length && <p>No eligible repositories available. Check selected repository access in GitHub.</p>}
      {repositoryItems.length > 0 && !repositoryItems.some(item => item.fullName.toLowerCase().includes(search.toLowerCase())) && <p>No loaded repositories match your search.</p>}
      <ul className="divide-y divide-border rounded-lg border border-border">{repositoryItems.filter(item => item.fullName.toLowerCase().includes(search.toLowerCase())).map(item => <li key={item.repositoryId} className="p-3">
        <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={chosen.has(item.repositoryId)} disabled={busy || item.archived || !item.defaultBranch || (!chosen.has(item.repositoryId) && chosen.size >= saved.policy.maxRepositories)} onChange={() => toggle({ ...item, ownerType: currentInstallation!.ownerType })} />
          <span className="break-all">{item.fullName}<span className="block text-sm text-muted-foreground">{item.visibility} · {currentInstallation?.ownerType}{item.archived ? " · Archived — not eligible" : !item.defaultBranch ? " · No default branch — not eligible" : ""}</span></span></label>
      </li>)}</ul>
      {repositories.hasNextPage && <Button variant="outline" disabled={repositories.isFetchingNextPage} onClick={() => repositories.fetchNextPage()}>Load more repositories</Button>}
    </div>}
    <div className="rounded-lg border border-border p-4 space-y-4">
      <h2 className="font-semibold">Selection ({chosen.size}/{saved.policy.maxRepositories})</h2>
      <ul className="space-y-2">{[...chosen.values()].map(item => <li className="flex justify-between gap-3" key={item.repositoryId}><span className="break-all">{item.fullName} · {item.visibility} · {item.ownerType}</span><Button variant="outline" disabled={busy} onClick={() => toggle(item)} aria-label={`Deselect ${item.fullName}`}>Deselect</Button></li>)}</ul>
      {!chosen.size && <p>No repositories selected.</p>}
      {needsAttestation && <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={attested} disabled={busy} onChange={event => setAttested(event.target.checked)} /><span>{saved.policy.attestationText}</span></label>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || chosen.size > saved.policy.maxRepositories || (needsAttestation && !attested)} onClick={submit}>{save.isPending ? "Saving…" : "Save selection"}</Button>
        </div>
      <StartAnalysisButton actor={actor} saved={saved} disabled={busy || !chosen.size || saved.repositories.some(r => r.status !== "active") || chosen.size !== saved.repositories.length || saved.repositories.some(r => !chosen.has(r.repositoryId))} />
    </div>
    <div className="space-y-3"><h2 className="font-semibold">Saved access</h2>
      {!saved.repositories.length && <p>No saved repository access.</p>}
      {saved.repositories.map(item => <div key={item.grantId} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"><p className="break-all">{item.fullName} — {item.status === "revoked" ? "Access revoked. Refresh and select again to reauthorize." : "Saved"}</p>
        <Button variant="outline" disabled={busy} onClick={() => remove.mutate(item.grantId)} aria-label={`Remove access to ${item.fullName}`}>Remove access</Button></div>)}
      <p className="text-sm text-muted-foreground">Removing access blocks future retrieval. It preserves historical reports; account deletion removes your retained data.</p>
    </div>
  </div>;
}
