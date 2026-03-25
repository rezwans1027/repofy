-- Feedback / bug reports / feature requests submitted by users
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null check (category in ('bug', 'feature', 'feedback')),
  message     text not null check (char_length(message) between 10 and 2000),
  created_at  timestamptz not null default now()
);

-- Index for admin queries
create index idx_feedback_created_at on public.feedback (created_at desc);
create index idx_feedback_user_id on public.feedback (user_id);

-- RLS
alter table public.feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Users can read their own feedback
create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
