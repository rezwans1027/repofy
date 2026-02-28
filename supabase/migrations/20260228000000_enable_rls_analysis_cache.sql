-- Enable RLS on analysis_cache so PostgREST does not expose cached AI outputs.
-- Only the service_role key (used by the backend) bypasses RLS; anon/authenticated
-- callers get zero rows.
alter table public.analysis_cache enable row level security;

-- No permissive policies → deny-all for anon and authenticated roles.
-- Service-role key bypasses RLS automatically.
