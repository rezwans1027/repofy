CREATE TABLE IF NOT EXISTS public.pending_signups (
  email          text        PRIMARY KEY,
  display_name   text        NOT NULL,
  otp_code       text        NOT NULL,
  otp_expires_at timestamptz NOT NULL,
  attempts       integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;
-- No policies = deny all for anon/authenticated. Backend uses service_role (bypasses RLS).
