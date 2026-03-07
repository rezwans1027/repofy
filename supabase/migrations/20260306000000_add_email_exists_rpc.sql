CREATE OR REPLACE FUNCTION public.email_exists_in_auth(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  );
$$;

-- Only the service_role (backend) should call this; block direct client access.
REVOKE EXECUTE ON FUNCTION public.email_exists_in_auth(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_exists_in_auth(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_exists_in_auth(text) FROM authenticated;
