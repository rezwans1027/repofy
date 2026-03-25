ALTER TABLE public.advice_jobs ADD COLUMN request_id TEXT;
CREATE INDEX idx_advice_jobs_request_id ON public.advice_jobs (request_id) WHERE request_id IS NOT NULL;
