CREATE INDEX IF NOT EXISTS idx_pending_signups_otp_expires_at
  ON public.pending_signups (otp_expires_at);
