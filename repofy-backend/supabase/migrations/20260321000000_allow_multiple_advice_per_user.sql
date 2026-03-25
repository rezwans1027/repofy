-- Drop the unique constraint that enforces one-per-user-per-username
ALTER TABLE public.advice DROP CONSTRAINT IF EXISTS advice_user_analyzed_unique;
ALTER TABLE public.advice DROP CONSTRAINT IF EXISTS advice_user_id_analyzed_username_key;

-- Add a non-unique index for efficient lookups (list, exists queries)
CREATE INDEX IF NOT EXISTS idx_advice_user_username
  ON public.advice (user_id, analyzed_username);
