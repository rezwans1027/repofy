/** Synthetic HTTP boundary for the real authorized metadata collector; no live requests. */
export function metadataTransport(unavailable: () => boolean) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input)); calls.push(url.pathname + url.search);
    const sha = url.searchParams.get('sha') ?? url.searchParams.get('head_sha') ?? url.pathname.match(/commits\/([a-f0-9]{40})/)?.[1];
    if (!sha || url.hostname !== 'api.github.com') throw new Error('Unexpected metadata fixture request');
    const ci = /check-runs|\/status$|actions\/runs/.test(url.pathname);
    if (ci && unavailable()) return new Response(null, { status: 503 });
    const at = '2026-09-20T00:00:00Z', author = { id: 100, type: 'User' }, repo = url.pathname.match(/synthetic-private-(\d+)/)?.[1] ?? '301';
    if (url.pathname.endsWith('/commits')) {
      // Both pages advertise more history. The real client's two-page limit
      // records truncation instead of treating these two records as complete history.
      const page = Number(url.searchParams.get('page'));
      return Response.json([{ sha: page === 1 ? sha : '9'.repeat(40), author, commit: { author: { date: at } }, parents: page === 1 ? [{ sha: '9'.repeat(40) }] : [] }],
        { headers: { link: '<https://api.github.com/ignored>; rel="next"' } });
    }
    if (url.pathname.endsWith('/pulls')) return Response.json([{ id: 21, state: 'closed', merged_at: at, updated_at: at, user: author, merge_commit_sha: sha, head: { sha, repo: { id: Number(repo) } } }]);
    if (url.pathname.endsWith('/check-runs')) return Response.json({ total_count: 1, check_runs: [{ id: 22, head_sha: sha, status: 'completed', conclusion: 'success', started_at: at }] });
    if (url.pathname.endsWith('/status')) return Response.json({ total_count: 1, sha, statuses: [{ id: 23, state: 'success', created_at: at, creator: author }] });
    if (url.pathname.endsWith('/actions/runs')) return Response.json({ total_count: 1, workflow_runs: [{ id: 24, head_sha: sha, status: 'completed', conclusion: 'success', created_at: at, actor: author, repository: { id: Number(repo) } }] });
    throw new Error('Unexpected metadata fixture endpoint');
  };
  return { fetcher, calls };
}
