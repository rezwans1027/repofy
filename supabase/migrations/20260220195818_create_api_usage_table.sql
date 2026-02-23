create table api_usage (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  endpoint text not null,
  model text not null,
  prompt_tokens integer not null,
  completion_tokens integer not null,
  total_tokens integer not null,
  estimated_cost numeric
);

alter table api_usage enable row level security;
