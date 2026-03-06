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
