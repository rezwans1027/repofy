CREATE OR REPLACE FUNCTION increment_otp_attempt(p_email text, p_max_attempts integer)
RETURNS TABLE (
  email text, display_name text, otp_code text,
  otp_expires_at timestamptz, attempts integer, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.pending_signups ps
     SET attempts = ps.attempts + 1
   WHERE ps.email = p_email
     AND ps.attempts < p_max_attempts
     AND ps.otp_expires_at > now()
  RETURNING ps.email, ps.display_name, ps.otp_code,
            ps.otp_expires_at, ps.attempts, ps.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_otp_attempt(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_otp_attempt(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_otp_attempt(text, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION increment_otp_attempt(text, integer) TO service_role;
