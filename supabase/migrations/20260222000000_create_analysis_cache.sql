create table if not exists public.analysis_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  snapshot_hash text not null,
  model text not null,
  rubric_version text not null,
  scorer_response jsonb not null,
  scoring_result jsonb not null,
  narrative_report text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

create index idx_analysis_cache_key on public.analysis_cache(cache_key);
create index idx_analysis_cache_expires on public.analysis_cache(expires_at);
