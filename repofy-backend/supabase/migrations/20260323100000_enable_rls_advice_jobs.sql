ALTER TABLE public.advice_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own advice jobs"
  ON public.advice_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to advice jobs"
  ON public.advice_jobs FOR ALL
  USING (auth.role() = 'service_role');
