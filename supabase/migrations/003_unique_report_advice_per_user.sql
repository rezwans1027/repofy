-- Enforce one report and one advice per (user, analyzed_username).
-- This enables atomic upserts and prevents duplicate rows.

-- 1. Clean up any existing duplicates (keep the most recent per pair)
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

-- 2. Add unique constraints
ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_analyzed_unique UNIQUE (user_id, analyzed_username);

ALTER TABLE public.advice
  ADD CONSTRAINT advice_user_analyzed_unique UNIQUE (user_id, analyzed_username);

-- 3. Add UPDATE policies (required for upsert's ON CONFLICT DO UPDATE)
CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own advice"
  ON public.advice FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
