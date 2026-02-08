-- Create reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  analyzed_username text not null,
  analyzed_name text,
  overall_score numeric,
  recommendation text,
  report_data jsonb not null,
  generated_at timestamptz default now() not null
);

-- Create advice table
create table if not exists public.advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  analyzed_username text not null,
  analyzed_name text,
  advice_data jsonb not null,
  generated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.reports enable row level security;
alter table public.advice enable row level security;

-- Reports: users can only see their own
create policy "Users can view their own reports"
  on public.reports for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reports"
  on public.reports for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own reports"
  on public.reports for delete
  using (auth.uid() = user_id);

-- Advice: users can only see their own
create policy "Users can view their own advice"
  on public.advice for select
  using (auth.uid() = user_id);

create policy "Users can insert their own advice"
  on public.advice for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own advice"
  on public.advice for delete
  using (auth.uid() = user_id);
