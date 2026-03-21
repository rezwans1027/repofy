CREATE TABLE public.advice_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analyzed_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | completed | failed
  advice_id UUID REFERENCES public.advice(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_advice_jobs_user_status ON public.advice_jobs (user_id, status);
