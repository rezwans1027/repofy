-- Discovery locators are required by saved selections and workers. Invalidate
-- them for the same repository/installation scope as the corresponding grants.
-- Additions and restoration events neither delete unaffected locators nor revive grants.
CREATE OR REPLACE FUNCTION public.feature_one_github_webhook(p_delivery uuid, p_hash text, p_event text, p_action text,
  p_installation text, p_repositories text[], p_provider_user text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  receipt feature_one_private.github_webhook_receipts;
  iid uuid;
  aid uuid;
  g record;
  invalidate_installation boolean;
  affected_repositories uuid[];
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
    -- Cascades only this account's discovered repositories.
    DELETE FROM public.github_installation_connections WHERE account_id = aid;
  END IF;
  invalidate_installation := (p_event = 'installation' AND p_action IN ('deleted','suspend','new_permissions_accepted'))
    OR p_event IN ('membership','organization');
  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO affected_repositories FROM public.repositories
    WHERE p_event IN ('installation_repositories','repository','member') AND provider_repository_id = ANY(p_repositories);
  FOR g IN SELECT id, user_id FROM public.repository_access_grants
    WHERE revoked_at IS NULL AND ((aid IS NOT NULL AND github_account_id = aid)
      OR (iid IS NOT NULL AND installation_id = iid AND (invalidate_installation OR repository_id = ANY(affected_repositories))))
    ORDER BY id FOR UPDATE LOOP
    UPDATE public.repository_access_grants SET revoked_at = now() WHERE id = g.id;
    INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
      VALUES(g.user_id, 'grant_revoked', 'grant', g.id, p_delivery);
  END LOOP;
  IF iid IS NOT NULL THEN
    DELETE FROM public.github_discovered_repositories
      WHERE installation_id = iid AND (invalidate_installation OR repository_id = ANY(affected_repositories));
    UPDATE public.github_installations SET last_webhook_at = now(), status = CASE
      WHEN p_event = 'installation' AND p_action = 'deleted' THEN 'deleted'
      WHEN p_event = 'installation' AND p_action = 'suspend' THEN 'suspended' ELSE status END WHERE id = iid;
  END IF;
  RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.feature_one_github_webhook(uuid, text, text, text, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feature_one_github_webhook(uuid, text, text, text, text, text[], text) TO service_role;
NOTIFY pgrst, 'reload schema';
