-- Corrective migration: replace functional lower() indexes (if present)
-- with plain unique constraints that work with Supabase upsert onConflict.
--
-- Idempotent: safe to run whether the environment applied the old or new
-- version of migration 003.

-- 1. Normalize any remaining mixed-case usernames
UPDATE public.reports SET analyzed_username = lower(analyzed_username)
WHERE analyzed_username IS DISTINCT FROM lower(analyzed_username);

UPDATE public.advice SET analyzed_username = lower(analyzed_username)
WHERE analyzed_username IS DISTINCT FROM lower(analyzed_username);

-- 2. Drop functional indexes if they exist (old 003)
DROP INDEX IF EXISTS public.reports_user_analyzed_unique;
DROP INDEX IF EXISTS public.advice_user_analyzed_unique;

-- 3. Drop plain constraints if they exist (new 003), so we can recreate cleanly
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_user_analyzed_unique;
ALTER TABLE public.advice
  DROP CONSTRAINT IF EXISTS advice_user_analyzed_unique;

-- 4. Dedup any rows that collide after normalization
DELETE FROM public.reports
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, analyzed_username) id
  FROM public.reports
  ORDER BY user_id, analyzed_username, generated_at DESC
);

DELETE FROM public.advice
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, analyzed_username) id
  FROM public.advice
  ORDER BY user_id, analyzed_username, generated_at DESC
);

-- 5. Add plain unique constraints (compatible with onConflict)
ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_analyzed_unique UNIQUE (user_id, analyzed_username);

ALTER TABLE public.advice
  ADD CONSTRAINT advice_user_analyzed_unique UNIQUE (user_id, analyzed_username);
