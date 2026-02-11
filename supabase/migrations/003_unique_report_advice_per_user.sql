-- Enforce one report and one advice per (user, analyzed_username).
-- This enables atomic upserts and prevents duplicate rows.

-- 1. Normalize existing usernames to lowercase
UPDATE public.reports SET analyzed_username = lower(analyzed_username)
WHERE analyzed_username IS DISTINCT FROM lower(analyzed_username);

UPDATE public.advice SET analyzed_username = lower(analyzed_username)
WHERE analyzed_username IS DISTINCT FROM lower(analyzed_username);

-- 2a. Clean up any duplicates (keep the most recent per pair)
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

-- 2b. Add unique constraints (plain columns — app normalizes to lowercase at write time)
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

-- 4. Auto-set generated_at to now() on update so upserts get a
--    server-side timestamp without relying on the client clock.
CREATE OR REPLACE FUNCTION public.set_generated_at()
RETURNS trigger AS $$
BEGIN
  NEW.generated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reports_generated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_generated_at();

CREATE TRIGGER trg_advice_generated_at
  BEFORE UPDATE ON public.advice
  FOR EACH ROW EXECUTE FUNCTION public.set_generated_at();
