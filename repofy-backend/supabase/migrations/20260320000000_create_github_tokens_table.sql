CREATE TABLE public.github_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_token TEXT NOT NULL,
  github_username TEXT NOT NULL,
  github_avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = only service-role key can access (backend pattern)
