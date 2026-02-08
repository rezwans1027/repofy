-- Create reports table (must exist before 002_add_analyzed_name)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  analyzed_username text NOT NULL,
  overall_score integer NOT NULL,
  recommendation text NOT NULL,
  report_data jsonb NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reports" ON public.reports;
CREATE POLICY "Users can delete their own reports"
  ON public.reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
