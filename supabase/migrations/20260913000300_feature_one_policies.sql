CREATE FUNCTION feature_one_private.immutable_row() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END $$;
CREATE FUNCTION feature_one_private.seal_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL OR to_jsonb(OLD) - 'sealed_at' IS DISTINCT FROM to_jsonb(NEW) - 'sealed_at' THEN
    RAISE EXCEPTION 'IMMUTABLE_CONTENT';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_snapshot BEFORE UPDATE ON public.repository_snapshots FOR EACH ROW EXECUTE FUNCTION feature_one_private.seal_snapshot();
CREATE FUNCTION feature_one_private.snapshot_child() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE sid uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END IF;
  IF TG_OP = 'DELETE' THEN sid := OLD.snapshot_id; ELSE sid := NEW.snapshot_id; END IF;
  IF EXISTS (SELECT 1 FROM public.repository_snapshots WHERE id = sid AND sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_inventory BEFORE INSERT OR UPDATE OR DELETE ON public.file_inventory FOR EACH ROW EXECUTE FUNCTION feature_one_private.snapshot_child();
CREATE TRIGGER immutable_evidence BEFORE INSERT OR UPDATE OR DELETE ON public.evidence_items FOR EACH ROW EXECUTE FUNCTION feature_one_private.snapshot_child();
CREATE FUNCTION feature_one_private.run_child() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE rid uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END IF;
  IF TG_OP = 'DELETE' THEN rid := OLD.run_id; ELSE rid := NEW.run_id; END IF;
  IF EXISTS (SELECT 1 FROM public.analysis_runs WHERE id = rid) AND EXISTS (SELECT 1 FROM public.analysis_run_status WHERE run_id = rid AND status <> 'running') THEN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION feature_one_private.job_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF to_jsonb(OLD) - ARRAY['status', 'stage', 'failure_code', 'updated_at', 'finished_at'] IS DISTINCT FROM
      to_jsonb(NEW) - ARRAY['status', 'stage', 'failure_code', 'updated_at', 'finished_at']
      OR OLD.status IN ('completed', 'failed', 'canceled')
      OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'running', 'failed', 'canceled'))
      OR (OLD.status = 'running' AND NEW.status NOT IN ('running', 'completed', 'failed', 'canceled')) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER analysis_job_transition BEFORE UPDATE ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION feature_one_private.job_transition();
CREATE FUNCTION feature_one_private.execution_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'running' OR to_jsonb(OLD) - ARRAY['status', 'finished_at', 'failure_code'] IS DISTINCT FROM
      to_jsonb(NEW) - ARRAY['status', 'finished_at', 'failure_code'] THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attempt_transition BEFORE UPDATE ON public.analysis_job_attempts FOR EACH ROW EXECUTE FUNCTION feature_one_private.execution_transition();
CREATE TRIGGER run_transition BEFORE UPDATE ON public.analysis_run_status FOR EACH ROW EXECUTE FUNCTION feature_one_private.execution_transition();
CREATE FUNCTION feature_one_private.grant_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF to_jsonb(OLD) - ARRAY['revoked_at', 'verified_at'] IS DISTINCT FROM to_jsonb(NEW) - ARRAY['revoked_at', 'verified_at']
      OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN RAISE EXCEPTION 'IMMUTABLE_IDENTITY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_grant_identity BEFORE UPDATE ON public.repository_access_grants FOR EACH ROW EXECUTE FUNCTION feature_one_private.grant_identity();
CREATE FUNCTION feature_one_private.account_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.provider_user_id) IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.provider_user_id) THEN RAISE EXCEPTION 'IMMUTABLE_IDENTITY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_account_identity BEFORE UPDATE ON public.github_accounts FOR EACH ROW EXECUTE FUNCTION feature_one_private.account_identity();

CREATE FUNCTION public.feature_one_owns_run(p_run uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.analysis_runs WHERE id = p_run AND user_id = (SELECT auth.uid()));
$$;

DO $$
DECLARE t text; fn record;
BEGIN
  FOREACH t IN ARRAY ARRAY['github_accounts', 'github_installations', 'repositories', 'repository_access_grants',
    'repository_snapshots', 'snapshot_receipts', 'analysis_jobs', 'analysis_job_grants', 'analysis_job_attempts',
    'analysis_runs', 'analysis_run_status', 'analysis_run_snapshots', 'file_inventory', 'evidence_items',
    'capability_definitions', 'capability_evidence', 'role_templates', 'role_requirements', 'analysis_run_roles',
    'analysis_run_evidence', 'capability_assessments', 'assessment_evidence', 'readiness_reports',
    'report_evidence_citations', 'report_capability_mentions', 'audit_events', 'model_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Supabase default table grants must not turn BYPASSRLS into unrestricted writes.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['github_accounts', 'repository_access_grants', 'analysis_jobs', 'analysis_job_grants',
    'analysis_job_attempts', 'analysis_runs', 'analysis_run_snapshots', 'readiness_reports'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['analysis_run_status', 'analysis_run_roles', 'analysis_run_evidence', 'capability_assessments',
    'assessment_evidence', 'report_evidence_citations', 'report_capability_mentions'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (public.feature_one_owns_run(run_id))', t);
  END LOOP;
  GRANT SELECT ON public.audit_events TO authenticated;
  CREATE POLICY owner_read ON public.audit_events FOR SELECT TO authenticated USING (actor_id = (SELECT auth.uid()));
  FOREACH t IN ARRAY ARRAY['analysis_runs', 'readiness_reports', 'capability_definitions', 'role_templates', 'role_requirements', 'capability_evidence', 'snapshot_receipts', 'analysis_job_grants'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_content BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['analysis_run_snapshots', 'analysis_run_roles', 'analysis_run_evidence', 'capability_assessments', 'assessment_evidence', 'report_evidence_citations', 'report_capability_mentions'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_membership BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION feature_one_private.run_child()', t);
  END LOOP;
  -- Nothing in this schema, including trigger helpers, may inherit PUBLIC execute.
  FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'feature_one_private' OR (n.nspname = 'public' AND left(p.proname, 12) = 'feature_one_') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn.signature);
  END LOOP;
  FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 12) = 'feature_one_' LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.feature_one_owns_run(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
