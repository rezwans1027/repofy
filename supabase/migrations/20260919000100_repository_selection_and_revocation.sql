-- Run 05. Additive; revoked grants are never reactivated.
ALTER TABLE public.repository_access_grants ADD COLUMN access_revision uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.repository_access_grants ADD COLUMN statement_text text CHECK (length(statement_text) <= 1000);
ALTER TABLE public.repository_access_grants ADD COLUMN attestation_confirmed boolean NOT NULL DEFAULT false;
CREATE TABLE feature_one_private.github_security_epoch (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO feature_one_private.github_security_epoch DEFAULT VALUES;
CREATE TABLE feature_one_private.github_webhook_receipts (
  delivery_id uuid PRIMARY KEY, body_hash text NOT NULL CHECK(body_hash ~ '^[a-f0-9]{64}$'),
  event text NOT NULL CHECK(length(event) <= 80), action text NOT NULL CHECK(length(action) <= 80),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX github_webhook_receipt_retention ON feature_one_private.github_webhook_receipts(received_at);
CREATE TABLE public.repository_selections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE feature_one_private.repository_selection_items (
  user_id uuid NOT NULL REFERENCES public.repository_selections(user_id) ON DELETE CASCADE,
  repository_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  display_encrypted text NOT NULL CHECK (display_encrypted ~ '^g1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' AND length(display_encrypted) <= 16000),
  PRIMARY KEY(user_id, repository_id),
  FOREIGN KEY(grant_id, user_id, repository_id) REFERENCES public.repository_access_grants(id, user_id, repository_id) ON DELETE CASCADE
);
CREATE TABLE feature_one_private.repository_selection_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, key)
);
ALTER TABLE public.repository_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repository_selections FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA feature_one_private FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN ('grant_verified', 'grant_revoked', 'analysis_created', 'run_created', 'report_completed', 'analysis_canceled', 'analysis_deleted', 'github_linked', 'github_unlinked', 'repository_selected', 'repository_deselected'));

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_safe_metadata_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_safe_metadata_check CHECK (
  jsonb_typeof(safe_metadata) = 'object' AND safe_metadata - ARRAY['repository_count','evidence_count','private_count'] = '{}'
  AND (NOT safe_metadata ? 'repository_count' OR (safe_metadata->>'repository_count') ~ '^[0-9]{1,5}$')
  AND (NOT safe_metadata ? 'evidence_count' OR (safe_metadata->>'evidence_count') ~ '^[0-9]{1,5}$')
  AND (NOT safe_metadata ? 'private_count' OR (safe_metadata->>'private_count') ~ '^[0-9]{1,5}$'));
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_object_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_object_type_check CHECK (object_type IN ('grant','job','run','report','github_account','repository_selection'));

-- Applied to ALL revocation paths, including legacy unlink and service-only RPCs.
CREATE FUNCTION feature_one_private.grant_revoked_revision() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    NEW.access_revision := gen_random_uuid();
    UPDATE public.repository_selections SET revision = gen_random_uuid() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION feature_one_private.grant_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF to_jsonb(OLD) - ARRAY['revoked_at','verified_at','access_revision'] IS DISTINCT FROM to_jsonb(NEW) - ARRAY['revoked_at','verified_at','access_revision']
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
    OR (NEW.access_revision <> OLD.access_revision AND NOT (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)) THEN RAISE EXCEPTION 'IMMUTABLE_IDENTITY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER grant_revoked_revision BEFORE UPDATE ON public.repository_access_grants FOR EACH ROW EXECUTE FUNCTION feature_one_private.grant_revoked_revision();
CREATE FUNCTION feature_one_private.installation_access_changed() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.status <> 'active' OR (OLD.permissions ? 'contents' AND NOT NEW.permissions ? 'contents')
    OR OLD.provider_owner_id <> NEW.provider_owner_id) THEN
    UPDATE public.repository_access_grants SET revoked_at = now() WHERE installation_id = NEW.id AND revoked_at IS NULL;
    DELETE FROM public.github_discovered_repositories WHERE installation_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER installation_access_changed AFTER UPDATE ON public.github_installations FOR EACH ROW EXECUTE FUNCTION feature_one_private.installation_access_changed();

CREATE FUNCTION public.feature_one_selection_epoch() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT revision FROM feature_one_private.github_security_epoch;
$$;
CREATE FUNCTION public.feature_one_selection_read(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.repository_selections WHERE user_id = p_actor) THEN
   INSERT INTO public.repository_selections(user_id) VALUES(p_actor) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('revision', (SELECT revision FROM public.repository_selections WHERE user_id = p_actor),
   'items', (SELECT coalesce(jsonb_agg(jsonb_build_object('repositoryId', s.repository_id, 'grantId', g.id,
     'accessRevision', g.access_revision, 'accountId', g.github_account_id, 'installationId', g.installation_id,
     'status', CASE WHEN g.revoked_at IS NULL AND a.revoked_at IS NULL AND i.status = 'active' THEN 'active' ELSE 'revoked' END,
     'attestedAt', to_char(g.attested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'displayEncrypted', s.display_encrypted)
     ORDER BY s.repository_id), '[]') FROM feature_one_private.repository_selection_items s
       JOIN public.repository_access_grants g ON g.id = s.grant_id JOIN public.github_accounts a ON a.id = g.github_account_id
       JOIN public.github_installations i ON i.id = g.installation_id WHERE s.user_id = p_actor));
END $$;

CREATE FUNCTION public.feature_one_selection_save(p_actor uuid, p_expected uuid, p_key uuid, p_hash text, p_epoch uuid,
  p_items jsonb, p_limit integer, p_attestation boolean, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; prior text; current_revision uuid; epoch uuid; g uuid;
  keep_ids uuid[] := '{}'; a public.github_accounts; i public.github_installations; r public.repositories;
BEGIN
  -- Serialize selections with security deliveries. No network calls inside this transaction.
  SELECT revision INTO epoch FROM feature_one_private.github_security_epoch FOR UPDATE;
  INSERT INTO public.repository_selections(user_id) VALUES(p_actor) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.repository_selections WHERE user_id = p_actor FOR UPDATE;
  SELECT request_hash INTO prior FROM feature_one_private.repository_selection_requests WHERE user_id = p_actor AND key = p_key;
  IF prior IS NOT NULL THEN
    IF prior <> p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN public.feature_one_selection_read(p_actor); -- Always return CURRENT authorization, never a cached active grant.
  END IF;
  IF epoch <> p_epoch THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  IF current_revision <> p_expected THEN RAISE EXCEPTION 'SELECTION_CONFLICT'; END IF;
  IF p_limit NOT BETWEEN 1 AND 10 OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > p_limit
    OR (SELECT count(DISTINCT value->>'repositoryId') FROM jsonb_array_elements(p_items)) <> jsonb_array_length(p_items)
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    PERFORM feature_one_private.github_require_credential(p_actor, (item->>'accountId')::uuid, (item->>'credentialRevision')::uuid);
    SELECT * INTO a FROM public.github_accounts WHERE id = (item->>'accountId')::uuid AND user_id = p_actor AND revoked_at IS NULL FOR SHARE;
    IF NOT FOUND OR a.provider_user_id <> item#>>'{facts,providerUserId}' THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
    SELECT * INTO i FROM public.github_installations WHERE id = (item->>'installationId')::uuid AND status = 'active' FOR SHARE;
    IF NOT FOUND OR NOT i.permissions ? 'contents' OR i.provider_installation_id <> item#>>'{facts,providerInstallationId}'
      OR i.provider_owner_id <> item#>>'{facts,providerOwnerId}' OR i.owner_type <> item#>>'{facts,ownerType}' THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
    SELECT r0.* INTO r FROM public.repositories r0 JOIN public.github_discovered_repositories d ON d.repository_id = r0.id
      WHERE r0.id = (item->>'repositoryId')::uuid AND d.user_id = p_actor AND d.account_id = a.id AND d.installation_id = i.id FOR SHARE OF d, r0;
    IF NOT FOUND OR r.provider_repository_id <> item#>>'{facts,providerRepositoryId}' THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
    IF (item#>>'{facts,visibility}' = 'private' OR i.owner_type = 'Organization') AND NOT p_attestation THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
    UPDATE public.repositories SET visibility = item#>>'{facts,visibility}', updated_at = now() WHERE id = r.id;
    keep_ids := array_append(keep_ids, r.id);
    SELECT g0.id INTO g FROM feature_one_private.repository_selection_items s JOIN public.repository_access_grants g0 ON g0.id = s.grant_id
      WHERE s.user_id = p_actor AND s.repository_id = r.id AND g0.github_account_id = a.id AND g0.installation_id = i.id AND g0.revoked_at IS NULL
        AND (g0.attestation_confirmed OR (item#>>'{facts,visibility}' = 'public' AND i.owner_type = 'User'));
    IF g IS NULL THEN
      INSERT INTO public.repository_access_grants(user_id, github_account_id, installation_id, repository_id,
        attestation_id, statement_version, attested_at, verified_at, statement_text, attestation_confirmed)
      VALUES(p_actor, a.id, i.id, r.id, gen_random_uuid(), '1.0.0', now(), now(), CASE WHEN p_attestation THEN
        'I own or am authorized to submit the selected private and organization repositories to Repofy for analysis. Organization installation approval does not replace my authorization.'
        ELSE 'I select these public personal repositories for future analysis.' END, p_attestation) RETURNING id INTO g;
      INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id) VALUES(p_actor, 'grant_verified', 'grant', g, p_request_id);
    ELSE
      UPDATE public.repository_access_grants SET verified_at = now() WHERE id = g;
    END IF;
    -- Replacing an identity also retires the previous grant; historical reports remain.
    UPDATE public.repository_access_grants SET revoked_at = now() WHERE id IN
      (SELECT grant_id FROM feature_one_private.repository_selection_items WHERE user_id = p_actor AND repository_id = r.id AND grant_id <> g) AND revoked_at IS NULL;
    INSERT INTO feature_one_private.repository_selection_items(user_id, repository_id, grant_id, display_encrypted)
      VALUES(p_actor, r.id, g, item->>'displayEncrypted') ON CONFLICT(user_id, repository_id)
      DO UPDATE SET grant_id = excluded.grant_id, display_encrypted = excluded.display_encrypted;
  END LOOP;
  UPDATE public.repository_access_grants SET revoked_at = now() WHERE id IN
    (SELECT grant_id FROM feature_one_private.repository_selection_items WHERE user_id = p_actor AND NOT repository_id = ANY(keep_ids)) AND revoked_at IS NULL;
  DELETE FROM feature_one_private.repository_selection_items WHERE user_id = p_actor AND NOT repository_id = ANY(keep_ids);
  UPDATE public.repository_selections SET revision = gen_random_uuid() WHERE user_id = p_actor;
  INSERT INTO feature_one_private.repository_selection_requests(user_id, key, request_hash) VALUES(p_actor, p_key, p_hash);
  INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id, safe_metadata)
    VALUES(p_actor, 'repository_selected', 'repository_selection', p_actor, p_request_id,
      jsonb_build_object('repository_count', jsonb_array_length(p_items), 'private_count', (SELECT count(*) FROM jsonb_array_elements(p_items) v WHERE v#>>'{facts,visibility}' = 'private')));
  RETURN public.feature_one_selection_read(p_actor);
END $$;

CREATE OR REPLACE FUNCTION public.feature_one_revoke_grant(p_actor uuid, p_grant uuid, p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM feature_one_private.github_security_epoch FOR UPDATE;
  UPDATE public.repository_access_grants SET revoked_at = now() WHERE id = p_grant AND user_id = p_actor AND revoked_at IS NULL;
  IF FOUND THEN
    INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id) VALUES(p_actor, 'grant_revoked', 'grant', p_grant, p_request_id);
  END IF;
END $$;
CREATE FUNCTION public.feature_one_selection_remove(p_actor uuid, p_grant uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.feature_one_revoke_grant(p_actor, p_grant, p_request_id);
  DELETE FROM feature_one_private.repository_selection_items WHERE user_id = p_actor AND grant_id = p_grant;
  IF FOUND THEN
    UPDATE public.repository_selections SET revision = gen_random_uuid() WHERE user_id = p_actor;
    INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
      VALUES(p_actor, 'repository_deselected', 'grant', p_grant, p_request_id);
  END IF;
  RETURN public.feature_one_selection_read(p_actor);
END $$;
CREATE FUNCTION public.feature_one_selection_check_grant(p_actor uuid, p_grant uuid, p_revision uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants;
BEGIN
  g := feature_one_private.require_grant(p_actor, p_grant);
  IF g.access_revision <> p_revision THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
END $$;

-- Restrictive observations win; restoration/addition never grants access. A fresh explicit
-- selection rechecks the provider. Conservative stale removals can require reselection.
CREATE FUNCTION public.feature_one_github_webhook(p_delivery uuid, p_hash text, p_event text, p_action text,
  p_installation text, p_repositories text[], p_provider_user text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE receipt feature_one_private.github_webhook_receipts; iid uuid; aid uuid; g record;
BEGIN
  PERFORM 1 FROM feature_one_private.github_security_epoch FOR UPDATE;
  SELECT * INTO receipt FROM feature_one_private.github_webhook_receipts WHERE delivery_id = p_delivery;
  IF FOUND THEN
    IF receipt.body_hash <> p_hash OR receipt.event <> p_event OR receipt.action <> p_action THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    RETURN true;
  END IF;
  INSERT INTO feature_one_private.github_webhook_receipts(delivery_id, body_hash, event, action) VALUES(p_delivery, p_hash, p_event, p_action);
  IF p_event NOT IN ('installation','installation_repositories','github_app_authorization','repository','member','membership','organization') THEN RETURN false; END IF;
  UPDATE feature_one_private.github_security_epoch SET revision = gen_random_uuid();
  SELECT id INTO iid FROM public.github_installations WHERE provider_installation_id = p_installation;
  IF p_event = 'github_app_authorization' AND p_action = 'revoked' THEN
    SELECT id INTO aid FROM public.github_accounts WHERE provider_user_id = p_provider_user;
    UPDATE public.github_accounts SET revoked_at = coalesce(revoked_at, now()) WHERE id = aid;
    DELETE FROM feature_one_private.github_user_credentials WHERE account_id = aid;
    DELETE FROM feature_one_private.github_connection_states WHERE user_id = (SELECT user_id FROM public.github_accounts WHERE id = aid);
    DELETE FROM public.github_installation_connections WHERE account_id = aid;
  END IF;
  FOR g IN SELECT id, user_id FROM public.repository_access_grants
    WHERE revoked_at IS NULL AND ((aid IS NOT NULL AND github_account_id = aid) OR (iid IS NOT NULL AND installation_id = iid AND (
      (p_event = 'installation' AND p_action IN ('deleted','suspend','new_permissions_accepted'))
      OR (p_event = 'installation_repositories' AND repository_id IN (SELECT id FROM public.repositories WHERE provider_repository_id = ANY(p_repositories)))
      OR (p_event IN ('repository','member') AND repository_id IN (SELECT id FROM public.repositories WHERE provider_repository_id = ANY(p_repositories)))
      OR p_event IN ('membership','organization')))) ORDER BY id FOR UPDATE LOOP
    UPDATE public.repository_access_grants SET revoked_at = now() WHERE id = g.id;
    INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
      VALUES(g.user_id, 'grant_revoked', 'grant', g.id, p_delivery);
  END LOOP;
  IF iid IS NOT NULL THEN
    DELETE FROM public.github_discovered_repositories WHERE installation_id = iid;
    UPDATE public.github_installations SET last_webhook_at = now(), status = CASE
      WHEN p_event = 'installation' AND p_action = 'deleted' THEN 'deleted'
      WHEN p_event = 'installation' AND p_action = 'suspend' THEN 'suspended' ELSE status END WHERE id = iid;
  END IF;
  RETURN false;
END $$;

-- Keep existing account export compatible; new fields on grants already flow through it.
CREATE FUNCTION public.feature_one_export_v3(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.feature_one_export_v2(p_actor) || jsonb_build_object('repositorySelections',
   (SELECT coalesce(jsonb_agg(jsonb_build_object('repositoryId', repository_id, 'grantId', grant_id)), '[]')
      FROM feature_one_private.repository_selection_items WHERE user_id = p_actor));
$$;
-- Reuse the established maintenance hook without changing its prior cleanup behavior.
ALTER FUNCTION public.feature_one_prune_retention() RENAME TO feature_one_prune_retention_before_selection;
REVOKE ALL ON FUNCTION public.feature_one_prune_retention_before_selection() FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.feature_one_prune_retention() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.feature_one_prune_retention_before_selection();
  DELETE FROM feature_one_private.github_webhook_receipts WHERE received_at < now() - interval '90 days';
  DELETE FROM feature_one_private.repository_selection_requests WHERE created_at < now() - interval '90 days';
END $$;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT p.oid::regprocedure AS signature, n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'feature_one_private' OR (n.nspname = 'public' AND (p.proname LIKE 'feature_one_selection_%'
      OR p.proname IN ('feature_one_github_webhook','feature_one_export_v3','feature_one_prune_retention','feature_one_revoke_grant'))) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', item.signature);
    IF item.nspname = 'public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', item.signature); END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
