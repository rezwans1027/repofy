-- Add stable numeric GitHub user ID for durable account linking.
-- github_username is mutable (old names can be reclaimed by others),
-- so this column becomes the primary lookup key for returning users.
ALTER TABLE public.github_tokens
  ADD COLUMN github_user_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_github_tokens_github_user_id
  ON public.github_tokens (github_user_id)
  WHERE github_user_id IS NOT NULL;
