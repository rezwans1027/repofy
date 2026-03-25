-- Restrict profiles from public read to authenticated-only read.
-- The /profile/[username] page fetches from GitHub API, not this table.
-- Backend uses service_role which bypasses RLS.

DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
