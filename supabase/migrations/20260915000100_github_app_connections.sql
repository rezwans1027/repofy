-- Run 04: user-bound GitHub connections. Discovery is not a repository access grant.
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN ('grant_verified', 'grant_revoked', 'analysis_created', 'run_created', 'report_completed', 'analysis_canceled', 'analysis_deleted', 'github_linked', 'github_unlinked'));
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_object_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_object_type_check CHECK (object_type IN ('grant', 'job', 'run', 'report', 'github_account'));
ALTER TABLE public.github_installations ADD COLUMN repository_selection text CHECK (repository_selection IN ('all', 'selected'));
ALTER TABLE public.github_installations ADD COLUMN permissions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(permissions) = 'object');

CREATE TABLE feature_one_private.github_user_credentials (
  account_id uuid PRIMARY KEY REFERENCES public.github_accounts(id) ON DELETE CASCADE,
  credential_encrypted text NOT NULL CHECK (credential_encrypted ~ '^g1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' AND length(credential_encrypted) <= 16000),
  expires_at timestamptz NOT NULL,
  revision uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE feature_one_private.github_connection_states (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  binding_hash text NOT NULL CHECK (binding_hash ~ '^[a-f0-9]{64}$'),
  stage text NOT NULL CHECK (stage IN ('authorize', 'install')),
  payload_encrypted text NOT NULL CHECK (payload_encrypted ~ '^g1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' AND length(payload_encrypted) <= 16000),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX github_connection_state_expiry ON feature_one_private.github_connection_states(expires_at);
CREATE TABLE public.github_installation_connections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  installation_id uuid NOT NULL REFERENCES public.github_installations(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, installation_id),
  FOREIGN KEY (account_id, user_id) REFERENCES public.github_accounts(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, account_id, installation_id)
);
CREATE TABLE public.github_discovered_repositories (
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  repository_id uuid NOT NULL REFERENCES public.repositories(id),
  provider_owner_id feature_one_private.provider_id NOT NULL,
  locator_encrypted text NOT NULL CHECK (locator_encrypted ~ '^g1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' AND length(locator_encrypted) <= 16000),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, installation_id, repository_id),
  FOREIGN KEY (user_id, account_id, installation_id) REFERENCES public.github_installation_connections(user_id, account_id, installation_id) ON DELETE CASCADE
);

-- A shared lock serializes identity links with legacy login writes. Display names play no role.
CREATE FUNCTION feature_one_private.github_identity_conflict() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE provider text;
BEGIN
  IF TG_TABLE_NAME = 'github_tokens' THEN provider := NEW.github_user_id::text;
  ELSE provider := NEW.provider_user_id; END IF;
  IF provider IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('github-identity:' || provider, 0));
  IF EXISTS (SELECT 1 FROM public.github_accounts WHERE provider_user_id = provider AND user_id <> NEW.user_id)
    OR EXISTS (SELECT 1 FROM public.github_tokens WHERE github_user_id::text = provider AND user_id <> NEW.user_id) THEN
    RAISE EXCEPTION 'IDENTITY_CONFLICT';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER verified_github_accounts_conflict BEFORE INSERT OR UPDATE ON public.github_accounts FOR EACH ROW EXECUTE FUNCTION feature_one_private.github_identity_conflict();
CREATE TRIGGER github_tokens_conflict BEFORE INSERT OR UPDATE ON public.github_tokens FOR EACH ROW EXECUTE FUNCTION feature_one_private.github_identity_conflict();

CREATE FUNCTION public.feature_one_github_active_session(p_actor uuid, p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.sessions WHERE id = p_session AND user_id = p_actor);
$$;
CREATE FUNCTION public.feature_one_github_start_state(p_actor uuid, p_hash text, p_binding text, p_stage text, p_payload text, p_expires timestamptz, p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_expires <= now() OR p_expires > now() + interval '10 minutes 5 seconds' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  PERFORM 1 FROM auth.users WHERE id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = p_session AND user_id = p_actor) THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  DELETE FROM feature_one_private.github_connection_states WHERE expires_at <= now() OR (user_id = p_actor AND binding_hash = p_binding);
  IF (SELECT count(*) FROM feature_one_private.github_connection_states WHERE user_id = p_actor) >= 20 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  INSERT INTO feature_one_private.github_connection_states(state_hash, user_id, session_id, binding_hash, stage, payload_encrypted, expires_at)
    VALUES (p_hash, p_actor, p_session, p_binding, p_stage, p_payload, p_expires);
END $$;
CREATE FUNCTION public.feature_one_github_consume_state(p_actor uuid, p_hash text, p_binding text, p_stage text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE payload text;
BEGIN
  -- Atomic consumption across API processes. Retain a consumed authorization until link
  -- commits, so unlink can invalidate even a callback waiting on a provider response.
  UPDATE feature_one_private.github_connection_states SET consumed_at = now()
    WHERE state_hash = p_hash AND user_id = p_actor AND binding_hash = p_binding AND stage = p_stage AND expires_at > now() AND consumed_at IS NULL
    RETURNING payload_encrypted INTO payload;
  IF payload IS NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  RETURN payload;
END $$;

CREATE FUNCTION public.feature_one_github_link(p_actor uuid, p_provider text, p_login text, p_token text, p_expires timestamptz, p_state_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account uuid;
BEGIN
  PERFORM 1 FROM auth.users WHERE id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  DELETE FROM feature_one_private.github_connection_states WHERE state_hash = p_state_hash AND user_id = p_actor
    AND stage = 'authorize' AND consumed_at IS NOT NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF p_expires <= now() OR p_expires > now() + interval '8 hours 5 seconds' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF (SELECT count(*) FROM public.github_accounts WHERE user_id = p_actor) >= 20
    AND NOT EXISTS (SELECT 1 FROM public.github_accounts WHERE user_id = p_actor AND provider_user_id = p_provider) THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  INSERT INTO public.github_accounts(user_id, provider_user_id, login, verified_at)
    VALUES (p_actor, p_provider, p_login, now())
    ON CONFLICT (provider_user_id) DO UPDATE SET login = excluded.login, verified_at = now(), revoked_at = NULL
      WHERE github_accounts.user_id = p_actor RETURNING id INTO account;
  IF account IS NULL THEN RAISE EXCEPTION 'IDENTITY_CONFLICT'; END IF;
  INSERT INTO feature_one_private.github_user_credentials(account_id, credential_encrypted, expires_at)
    VALUES (account, p_token, p_expires) ON CONFLICT (account_id) DO UPDATE
      SET credential_encrypted = excluded.credential_encrypted, expires_at = excluded.expires_at, revision = gen_random_uuid();
  INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
    VALUES (p_actor, 'github_linked', 'github_account', account, gen_random_uuid());
  RETURN account;
END $$;
CREATE FUNCTION public.feature_one_github_accounts(p_actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('accountId', a.id, 'login', a.login,
    'status', CASE WHEN a.revoked_at IS NOT NULL THEN 'unlinked' WHEN c.expires_at > now() + interval '60 seconds' THEN 'connected' ELSE 'reconnect_required' END,
    'verifiedAt', to_char(a.verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY a.verified_at, a.id), '[]')
  FROM public.github_accounts a LEFT JOIN feature_one_private.github_user_credentials c ON c.account_id = a.id WHERE a.user_id = p_actor;
$$;
CREATE FUNCTION public.feature_one_github_identity(p_actor uuid, p_account uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('providerUserId', provider_user_id) FROM public.github_accounts WHERE user_id = p_actor AND id = p_account;
$$;
CREATE FUNCTION public.feature_one_github_credential(p_actor uuid, p_account uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('accountId', a.id, 'providerUserId', a.provider_user_id, 'login', a.login,
    'encrypted', c.credential_encrypted, 'expiresAt', to_char(c.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'revision', c.revision)
  FROM public.github_accounts a JOIN feature_one_private.github_user_credentials c ON c.account_id = a.id
  WHERE a.user_id = p_actor AND a.id = p_account AND a.revoked_at IS NULL AND c.expires_at > now() + interval '60 seconds';
$$;
CREATE FUNCTION feature_one_private.github_require_credential(p_actor uuid, p_account uuid, p_revision uuid) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.github_accounts WHERE id = p_account AND user_id = p_actor AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECONNECT_REQUIRED'; END IF;
  PERFORM 1 FROM feature_one_private.github_user_credentials WHERE account_id = p_account AND revision = p_revision AND expires_at > now() + interval '60 seconds' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECONNECT_REQUIRED'; END IF;
END $$;
CREATE FUNCTION public.feature_one_github_associate(p_actor uuid, p_account uuid, p_revision uuid, p_facts jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE installation uuid;
BEGIN
  PERFORM feature_one_private.github_require_credential(p_actor, p_account, p_revision);
  INSERT INTO public.github_installations(provider_installation_id, provider_owner_id, owner_type, status, last_verified_at, repository_selection, permissions)
    VALUES (p_facts->>'id', p_facts#>>'{account,id}', p_facts#>>'{account,type}',
      CASE WHEN p_facts->>'suspended_at' IS NULL THEN 'active' ELSE 'suspended' END, now(), p_facts->>'repository_selection', p_facts->'permissions')
    ON CONFLICT (provider_installation_id) DO UPDATE SET provider_owner_id = excluded.provider_owner_id,
      owner_type = excluded.owner_type, status = excluded.status, last_verified_at = now(), repository_selection = excluded.repository_selection, permissions = excluded.permissions
    RETURNING id INTO installation;
  INSERT INTO public.github_installation_connections(user_id, account_id, installation_id)
    VALUES (p_actor, p_account, installation) ON CONFLICT (account_id, installation_id) DO UPDATE SET verified_at = now();
  RETURN installation;
END $$;
CREATE FUNCTION public.feature_one_github_connection(p_actor uuid, p_account uuid, p_installation uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('providerInstallationId', i.provider_installation_id, 'providerOwnerId', i.provider_owner_id, 'ownerType', i.owner_type)
  FROM public.github_installation_connections c JOIN public.github_installations i ON i.id = c.installation_id
    JOIN public.github_accounts a ON a.id = c.account_id
  WHERE c.user_id = p_actor AND c.account_id = p_account AND c.installation_id = p_installation AND a.revoked_at IS NULL;
$$;
CREATE FUNCTION public.feature_one_github_mark_missing(p_actor uuid, p_account uuid, p_revision uuid, p_installation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM feature_one_private.github_require_credential(p_actor, p_account, p_revision);
  UPDATE public.github_installations SET status = 'deleted', last_verified_at = now() WHERE id = p_installation
    AND EXISTS (SELECT 1 FROM public.github_installation_connections WHERE installation_id = p_installation AND user_id = p_actor AND account_id = p_account);
END $$;
CREATE FUNCTION public.feature_one_github_discover(p_actor uuid, p_account uuid, p_revision uuid, p_installation uuid, p_repositories jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner text; item jsonb; repo uuid; result jsonb := '[]';
BEGIN
  PERFORM feature_one_private.github_require_credential(p_actor, p_account, p_revision);
  SELECT i.provider_owner_id INTO owner FROM public.github_installation_connections c JOIN public.github_installations i ON i.id = c.installation_id
    WHERE c.user_id = p_actor AND c.account_id = p_account AND c.installation_id = p_installation AND i.status = 'active' FOR SHARE OF c, i;
  IF owner IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF jsonb_typeof(p_repositories) <> 'array' OR jsonb_array_length(p_repositories) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_repositories) LOOP
    IF item->>'providerOwnerId' IS DISTINCT FROM owner THEN RAISE EXCEPTION 'ACCESS_CHANGED'; END IF;
    INSERT INTO public.repositories(provider_repository_id, visibility) VALUES (item->>'id', item->>'visibility')
      ON CONFLICT (provider_repository_id) DO UPDATE SET visibility = excluded.visibility, updated_at = now() RETURNING id INTO repo;
    INSERT INTO public.github_discovered_repositories(user_id, account_id, installation_id, repository_id, provider_owner_id, locator_encrypted)
      VALUES (p_actor, p_account, p_installation, repo, owner, item->>'locatorEncrypted')
      ON CONFLICT (account_id, installation_id, repository_id) DO UPDATE SET provider_owner_id = excluded.provider_owner_id,
        locator_encrypted = excluded.locator_encrypted, verified_at = now();
    result := result || jsonb_build_array(jsonb_build_object('providerRepositoryId', item->>'id', 'repositoryId', repo));
  END LOOP;
  RETURN result;
END $$;
CREATE FUNCTION public.feature_one_github_repository(p_actor uuid, p_account uuid, p_installation uuid, p_repository uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('providerRepositoryId', r.provider_repository_id, 'providerOwnerId', d.provider_owner_id, 'locatorEncrypted', d.locator_encrypted)
  FROM public.github_discovered_repositories d JOIN public.repositories r ON r.id = d.repository_id JOIN public.github_accounts a ON a.id = d.account_id
  WHERE d.user_id = p_actor AND d.account_id = p_account AND d.installation_id = p_installation AND d.repository_id = p_repository AND a.revoked_at IS NULL;
$$;
CREATE FUNCTION public.feature_one_github_unlink(p_actor uuid, p_account uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM auth.users WHERE id = p_actor FOR UPDATE;
  UPDATE public.github_accounts SET revoked_at = coalesce(revoked_at, now()) WHERE id = p_account AND user_id = p_actor;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM feature_one_private.github_user_credentials WHERE account_id = p_account;
  DELETE FROM feature_one_private.github_connection_states WHERE user_id = p_actor;
  UPDATE public.repository_access_grants SET revoked_at = coalesce(revoked_at, now()) WHERE user_id = p_actor AND github_account_id = p_account;
  DELETE FROM public.github_installation_connections WHERE user_id = p_actor AND account_id = p_account;
  INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
    VALUES (p_actor, 'github_unlinked', 'github_account', p_account, gen_random_uuid());
END $$;

CREATE OR REPLACE FUNCTION feature_one_private.prune_canonical() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  DELETE FROM public.repository_snapshots s WHERE NOT EXISTS (SELECT 1 FROM public.snapshot_receipts WHERE snapshot_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots WHERE snapshot_id = s.id);
  DELETE FROM public.repositories r WHERE NOT EXISTS (SELECT 1 FROM public.repository_access_grants WHERE repository_id = r.id)
    AND NOT EXISTS (SELECT 1 FROM public.repository_snapshots WHERE repository_id = r.id)
    AND NOT EXISTS (SELECT 1 FROM public.github_discovered_repositories WHERE repository_id = r.id);
  DELETE FROM public.github_installations i WHERE NOT EXISTS (SELECT 1 FROM public.repository_access_grants WHERE installation_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.github_installation_connections WHERE installation_id = i.id);
  DELETE FROM feature_one_private.github_connection_states WHERE expires_at <= now();
  DELETE FROM feature_one_private.github_user_credentials WHERE expires_at <= now();
END $$;

-- Preserve the prior export and extend only the safe owner projection.
-- Also run after connection cascades: a caller may force constraints immediate before
-- deleting another account in the same transaction, changing auth-trigger ordering.
CREATE CONSTRAINT TRIGGER github_discovery_cleanup AFTER DELETE ON public.github_discovered_repositories
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION feature_one_private.after_account_delete();
CREATE CONSTRAINT TRIGGER github_connection_cleanup AFTER DELETE ON public.github_installation_connections
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION feature_one_private.after_account_delete();
-- Keep the original RPC shape intact for old application instances during rollout/rollback.
CREATE FUNCTION public.feature_one_export_v2(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.feature_one_export(p_actor) || jsonb_build_object(
    'installations', (SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]') FROM public.github_installations i
      WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.installation_id = i.id AND g.user_id = p_actor)
        OR EXISTS (SELECT 1 FROM public.github_installation_connections c WHERE c.installation_id = i.id AND c.user_id = p_actor)),
    'repositories', (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'metadata_encrypted'), '[]') FROM public.repositories r
      WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.repository_id = r.id AND g.user_id = p_actor)
        OR EXISTS (SELECT 1 FROM public.github_discovered_repositories d WHERE d.repository_id = r.id AND d.user_id = p_actor)),
    'githubConnections', (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]') FROM public.github_installation_connections c WHERE c.user_id = p_actor),
    'discoveredRepositories', (SELECT coalesce(jsonb_agg(to_jsonb(d) - 'locator_encrypted'), '[]') FROM public.github_discovered_repositories d WHERE d.user_id = p_actor)
  );
$$;

DO $$ DECLARE item record; BEGIN
  ALTER TABLE public.github_installation_connections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.github_discovered_repositories ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.github_installation_connections, public.github_discovered_repositories FROM PUBLIC, anon, authenticated, service_role;
  REVOKE ALL ON ALL TABLES IN SCHEMA feature_one_private FROM PUBLIC, anon, authenticated, service_role;
  FOR item IN SELECT p.oid::regprocedure AS signature, n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'feature_one_private' OR (n.nspname = 'public' AND (p.proname LIKE 'feature_one_github_%' OR p.proname = 'feature_one_export_v2')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', item.signature);
    IF item.nspname = 'public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', item.signature); END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
