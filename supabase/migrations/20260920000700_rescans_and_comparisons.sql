-- Run 14: preferences and lineage are separate from immutable reports.
CREATE TABLE feature_one_private.report_preferences (
  report_id uuid PRIMARY KEY REFERENCES public.readiness_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role jsonb, updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE feature_one_private.report_rescans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key text NOT NULL, request_hash feature_one_private.digest NOT NULL,
  baseline_report_id uuid REFERENCES public.readiness_reports(id) ON DELETE SET NULL,
  job_id uuid UNIQUE REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK(outcome IN ('unchanged','queued')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(user_id,request_key)
);
CREATE INDEX report_rescans_baseline ON feature_one_private.report_rescans(baseline_report_id,created_at DESC,id DESC);

CREATE FUNCTION public.feature_one_focus(p_actor uuid,p_report uuid,p_change jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; preference jsonb;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_change IS NOT NULL THEN
    IF p_change-ARRAY['role']<>'{}' OR NOT p_change ? 'role' OR (p_change->'role'<>'null'::jsonb AND
      ((p_change->'role')-ARRAY['roleId','version']<>'{}' OR NOT EXISTS(SELECT 1 FROM public.analysis_run_roles WHERE run_id=r.run_id AND role_id=p_change#>>'{role,roleId}' AND role_version=p_change#>>'{role,version}')))
      THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    INSERT INTO feature_one_private.report_preferences VALUES(p_report,p_actor,p_change->'role',clock_timestamp())
      ON CONFLICT(report_id) DO UPDATE SET role=EXCLUDED.role,updated_at=EXCLUDED.updated_at;
  END IF;
  SELECT role INTO preference FROM feature_one_private.report_preferences WHERE report_id=p_report AND user_id=p_actor;
  RETURN coalesce(preference,'null'::jsonb);
END $$;

CREATE FUNCTION public.feature_one_rescan_context(p_actor uuid,p_baseline uuid,p_request jsonb,p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; prior feature_one_private.report_rescans; access_rows jsonb; checked_grant public.repository_access_grants;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_baseline AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO prior FROM feature_one_private.report_rescans WHERE user_id=p_actor AND request_key=p_request->>'idempotencyKey';
  IF FOUND THEN
    IF prior.request_hash IS DISTINCT FROM p_hash OR prior.baseline_report_id IS DISTINCT FROM p_baseline THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    IF prior.outcome='queued' AND prior.job_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    RETURN jsonb_build_object('state',prior.outcome,'jobId',prior.job_id,'reportId',p_baseline);
  END IF;
  IF jsonb_array_length(p_request->'repositoryIds') NOT BETWEEN 1 AND 10 OR
    jsonb_array_length(p_request->'repositoryIds')<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_request->'repositoryIds'))
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  SELECT jsonb_agg(jsonb_build_object('repositoryId',s.repository_id,'grantId',g.id,'accountId',g.github_account_id,
    'installationId',g.installation_id,'accessRevision',g.access_revision,'providerRepositoryId',repo.provider_repository_id,'repositoryVisibility',repo.visibility)
    ORDER BY s.repository_id) INTO access_rows
    FROM feature_one_private.repository_selection_items s JOIN public.repository_access_grants g ON g.id=s.grant_id
    JOIN public.repositories repo ON repo.id=s.repository_id WHERE s.user_id=p_actor AND p_request->'repositoryIds' ? s.repository_id::text;
  IF coalesce(jsonb_array_length(access_rows),0)<>jsonb_array_length(p_request->'repositoryIds') THEN RAISE EXCEPTION 'REPOSITORY_ACCESS_REVOKED'; END IF;
  FOR checked_grant IN SELECT * FROM public.repository_access_grants WHERE id IN (SELECT (value->>'grantId')::uuid FROM jsonb_array_elements(access_rows)) LOOP
    PERFORM feature_one_private.require_grant(p_actor,checked_grant.id);
    IF NOT checked_grant.attestation_confirmed AND EXISTS(SELECT 1 FROM public.repositories repo JOIN public.github_installations i ON i.id=checked_grant.installation_id
      WHERE repo.id=checked_grant.repository_id AND (repo.visibility='private' OR i.owner_type='Organization')) THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
  END LOOP;
  RETURN jsonb_build_object('state','prepare','access',access_rows);
END $$;

CREATE FUNCTION public.feature_one_rescan_start(p_actor uuid,p_baseline uuid,p_request jsonb,p_hash text,p_policy jsonb,p_limit int,p_resolutions jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; r public.readiness_reports; item jsonb; current_access jsonb; jid uuid; unchanged boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('analysis-owner:'||p_actor::text,0));
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_baseline AND user_id=p_actor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  context:=public.feature_one_rescan_context(p_actor,p_baseline,p_request,p_hash);
  IF context->>'state'<>'prepare' THEN RETURN context; END IF;
  IF p_policy->>'billing' IS DISTINCT FROM 'internal_free_v1' OR p_limit NOT BETWEEN 1 AND 10 OR jsonb_array_length(p_request->'repositoryIds')>p_limit
    OR jsonb_array_length(p_resolutions)<>jsonb_array_length(p_request->'repositoryIds')
    OR jsonb_array_length(p_resolutions)<>(SELECT count(DISTINCT value->>'repositoryId') FROM jsonb_array_elements(p_resolutions))
    OR EXISTS(SELECT 1 FROM feature_one_private.analysis_requests WHERE user_id=p_actor AND key=p_request->>'idempotencyKey') THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_resolutions) LOOP
    SELECT value INTO current_access FROM jsonb_array_elements(context->'access') WHERE value->>'repositoryId'=item->>'repositoryId';
    IF current_access IS NULL OR NOT item @> current_access OR coalesce(item->>'commitSha','') !~ '^[a-f0-9]{40}$'
      OR (item->>'resolvedAt')::timestamptz<clock_timestamp()-interval '5 minutes' OR (item->>'resolvedAt')::timestamptz>clock_timestamp()+interval '1 minute'
      THEN RAISE EXCEPTION 'REPOSITORY_ACCESS_REVOKED'; END IF;
  END LOOP;
  -- Metadata can change independently of a commit; never call that request unchanged.
  SELECT q.policy=p_policy AND j.request->'includeMetadata'=p_request->'includeMetadata' AND NOT j.request ? 'targetRoleTemplate'
    AND p_request->'includeMetadata'='{"commits":false,"pullRequests":false,"ci":false}'::jsonb
    AND jsonb_array_length(r.payload->'snapshots')=jsonb_array_length(p_resolutions)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_resolutions) pin WHERE NOT EXISTS(
      SELECT 1 FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id
      WHERE rs.run_id=r.run_id AND rs.repository_id::text=pin->>'repositoryId' AND rs.grant_id::text=pin->>'grantId'
        AND s.commit_sha=pin->>'commitSha' AND s.visibility=pin->>'repositoryVisibility'))
    INTO unchanged FROM feature_one_private.analysis_execution q JOIN public.analysis_jobs j ON j.id=q.job_id WHERE j.id=r.job_id;
  IF NOT coalesce(unchanged,false) THEN
    jid:=public.feature_one_job_start(p_actor,p_request,p_hash,p_policy,p_limit,p_request_id);
    -- The authorized preflight SHA set is pinned atomically with admission. A branch
    -- moving while queued cannot silently change this request's immutable inputs.
    FOR item IN SELECT value FROM jsonb_array_elements(p_resolutions) LOOP
      INSERT INTO feature_one_private.ingestion_pins(id,user_id,job_id,repository_id,grant_id,access_revision,provider_repository_id,visibility,
        branch_encrypted,commit_sha,resolved_at,policy,policy_hash)
      VALUES((item->>'pinId')::uuid,p_actor,jid,(item->>'repositoryId')::uuid,(item->>'grantId')::uuid,(item->>'accessRevision')::uuid,
        item->>'providerRepositoryId',item->>'repositoryVisibility',item->>'branchEncrypted',item->>'commitSha',(item->>'resolvedAt')::timestamptz,
        p_policy->'security',p_policy#>>'{versions,ingestionPolicyHash}');
    END LOOP;
  END IF;
  INSERT INTO feature_one_private.report_rescans(user_id,request_key,request_hash,baseline_report_id,job_id,outcome)
    VALUES(p_actor,p_request->>'idempotencyKey',p_hash,p_baseline,jid,CASE WHEN coalesce(unchanged,false) THEN 'unchanged' ELSE 'queued' END);
  INSERT INTO public.audit_events(actor_id,job_id,action,object_type,object_id,request_id) VALUES(p_actor,jid,'rescan_started','report',p_baseline,p_request_id);
  IF coalesce(unchanged,false) THEN
    INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id) VALUES(p_actor,'rescan_completed','report',p_baseline,p_request_id);
  END IF;
  RETURN jsonb_build_object('state',CASE WHEN coalesce(unchanged,false) THEN 'unchanged' ELSE 'queued' END,'jobId',jid,'reportId',p_baseline);
END $$;

CREATE FUNCTION public.feature_one_job_reuse_snapshot(p_job uuid,p_token uuid,p_repository uuid,p_apply boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; pin feature_one_private.ingestion_pins; sid uuid; actor uuid;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT user_id INTO actor FROM public.analysis_jobs WHERE id=p_job;
  SELECT * INTO pin FROM feature_one_private.ingestion_pins WHERE job_id=p_job AND repository_id=p_repository;
  IF pin.id IS NULL THEN RETURN NULL; END IF;
  SELECT s.id INTO sid FROM feature_one_private.report_rescans lineage
    JOIN public.readiness_reports baseline ON baseline.id=lineage.baseline_report_id AND baseline.user_id=actor
    JOIN public.analysis_run_snapshots rs ON rs.run_id=baseline.run_id AND rs.repository_id=p_repository AND rs.grant_id=pin.grant_id
    JOIN public.repository_snapshots s ON s.id=rs.snapshot_id
    WHERE lineage.job_id=p_job AND s.sealed_at IS NOT NULL AND s.commit_sha=pin.commit_sha AND s.visibility=pin.visibility
      AND s.security_policy_hash=pin.policy_hash AND s.identity_version=q.policy#>>'{versions,snapshotIdentity}'
      AND s.extractor_id=q.policy#>>'{versions,extractorBundle,id}' AND s.extractor_version=q.policy#>>'{versions,extractorBundle,version}'
      AND s.detector_bundle_id=q.policy#>>'{versions,detectorBundle,id}' AND s.detector_bundle_version=q.policy#>>'{versions,detectorBundle,version}'
      AND s.coverage_version=q.policy#>>'{versions,coverageManifest}'
      AND s.inventory_summary->'metadata'='{"commits":false,"pullRequests":false,"ci":false}'::jsonb
      AND (SELECT request->'includeMetadata' FROM public.analysis_jobs WHERE id=p_job)='{"commits":false,"pullRequests":false,"ci":false}'::jsonb
      AND EXISTS(SELECT 1 FROM feature_one_private.repository_selection_items WHERE user_id=actor AND grant_id=pin.grant_id);
  IF sid IS NOT NULL AND p_apply THEN
    PERFORM feature_one_private.require_grant(actor,pin.grant_id);
    INSERT INTO feature_one_private.analysis_snapshot_outputs VALUES(p_job,p_repository,sid) ON CONFLICT DO NOTHING;
    SELECT snapshot_id INTO sid FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=p_job AND repository_id=p_repository;
  END IF;
  RETURN sid;
END $$;

CREATE FUNCTION public.feature_one_rescan_history(p_actor uuid,p_report uuid,p_query jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; n int:=coalesce((p_query->>'limit')::int,20); cursor_row feature_one_private.report_rescans; rows jsonb; parent_row feature_one_private.report_rescans; parent jsonb;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF n NOT BETWEEN 1 AND 50 OR p_query-ARRAY['limit','afterId']<>'{}' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF p_query ? 'afterId' THEN
    SELECT * INTO cursor_row FROM feature_one_private.report_rescans WHERE id=(p_query->>'afterId')::uuid AND baseline_report_id=p_report AND user_id=p_actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  SELECT * INTO parent_row FROM feature_one_private.report_rescans WHERE job_id=r.job_id AND user_id=p_actor;
  parent:=CASE WHEN NOT FOUND THEN '{"state":"none"}'::jsonb WHEN parent_row.baseline_report_id IS NULL THEN '{"state":"unavailable"}'::jsonb
    ELSE jsonb_build_object('state','available','reportId',parent_row.baseline_report_id) END;
  SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id DESC),'[]') INTO rows FROM (
    SELECT l.id,l.created_at,jsonb_build_object('id',l.id,'createdAt',to_char(l.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'jobId',l.job_id,
      'reportId',CASE WHEN l.outcome='unchanged' THEN p_report ELSE report.id END,
      'state',CASE WHEN l.outcome='unchanged' THEN 'unchanged' ELSE coalesce(j.status,'deleted') END) item
    FROM feature_one_private.report_rescans l LEFT JOIN public.analysis_jobs j ON j.id=l.job_id
      LEFT JOIN public.readiness_reports report ON report.job_id=l.job_id
    WHERE l.user_id=p_actor AND l.baseline_report_id=p_report AND (cursor_row.id IS NULL OR (l.created_at,l.id)<(cursor_row.created_at,cursor_row.id))
    ORDER BY l.created_at DESC,l.id DESC LIMIT n+1) page;
  RETURN jsonb_build_object('parent',parent,'items',CASE WHEN jsonb_array_length(rows)>n THEN rows-n ELSE rows END,
    'nextId',CASE WHEN jsonb_array_length(rows)>n THEN rows#>>ARRAY[(n-1)::text,'id'] ELSE NULL END);
END $$;

-- Fingerprints are internal, keyed and repository scoped. Only equality outcomes
-- and report-member evidence IDs leave the comparison service, never these values.
CREATE FUNCTION feature_one_private.comparison_facts(p_actor uuid,p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;
BEGIN
  IF (SELECT count(*) FROM feature_one_private.report_evidence_membership(p_actor,p_run))>20000 THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('observation',e.observation,'contentKey',
    CASE WHEN e.content_fingerprint IS NULL THEN NULL ELSE e.content_fingerprint_key_version||':'||e.content_fingerprint END,
    'pathKey',CASE WHEN ar->>'access'='active' THEN f.fingerprint_key_version||':'||f.fingerprint ELSE NULL END) ORDER BY e.id),'[]') INTO facts
    FROM feature_one_private.report_evidence_membership(p_actor,p_run) membership JOIN public.evidence_items e ON e.id=membership.evidence_id
    LEFT JOIN public.file_inventory f ON f.snapshot_id=e.snapshot_id AND f.locator_id=e.file_locator_id
    JOIN LATERAL (SELECT value ar FROM jsonb_array_elements(feature_one_private.report_access(p_actor,p_run)) WHERE value->>'snapshotId'=e.snapshot_id::text) access ON true;
  RETURN facts;
END $$;
CREATE FUNCTION public.feature_one_comparison_input(p_actor uuid,p_baseline uuid,p_target uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.readiness_reports; b public.readiness_reports;
BEGIN
  SELECT * INTO a FROM public.readiness_reports WHERE id=p_baseline AND user_id=p_actor FOR KEY SHARE;
  SELECT * INTO b FROM public.readiness_reports WHERE id=p_target AND user_id=p_actor FOR KEY SHARE;
  IF a.id IS NULL OR b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE actor_id=p_actor AND job_id=b.job_id AND action='comparison_viewed' AND created_at>now()-interval '1 minute') THEN
    INSERT INTO public.audit_events(actor_id,job_id,action,object_type,object_id,request_id) VALUES(p_actor,b.job_id,'comparison_viewed','report',b.id,gen_random_uuid());
  END IF;
  RETURN jsonb_build_object('baseline',public.feature_one_report_view(p_actor,a.id),'target',public.feature_one_report_view(p_actor,b.id),
    'baselineFacts',feature_one_private.comparison_facts(p_actor,a.run_id),'targetFacts',feature_one_private.comparison_facts(p_actor,b.run_id),
    'baselineInventory',(SELECT jsonb_agg(jsonb_build_object('snapshotId',s.id,'exclusions',s.inventory_summary#>'{structural,exclusions}')) FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id WHERE rs.run_id=a.run_id),
    'targetInventory',(SELECT jsonb_agg(jsonb_build_object('snapshotId',s.id,'exclusions',s.inventory_summary#>'{structural,exclusions}')) FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id WHERE rs.run_id=b.run_id));
END $$;

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK(action IN (
  'grant_verified','grant_revoked','analysis_created','run_created','report_completed','analysis_canceled','analysis_deleted',
  'github_linked','github_unlinked','repository_selected','repository_deselected','report_viewed','evidence_opened','improvement_opened',
  'rescan_started','rescan_completed','comparison_viewed'));
CREATE FUNCTION feature_one_private.rescan_completed() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM feature_one_private.report_rescans WHERE job_id=NEW.job_id AND user_id=NEW.user_id) THEN
    INSERT INTO public.audit_events(actor_id,job_id,action,object_type,object_id,request_id) VALUES(NEW.user_id,NEW.job_id,'rescan_completed','report',NEW.id,gen_random_uuid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rescan_completed AFTER INSERT ON public.readiness_reports FOR EACH ROW EXECUTE FUNCTION feature_one_private.rescan_completed();
CREATE FUNCTION public.feature_one_export_v7(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.feature_one_export_v6(p_actor)||jsonb_build_object(
    'reportPreferences',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM feature_one_private.report_preferences p WHERE user_id=p_actor),
    'reportRescans',(SELECT coalesce(jsonb_agg(to_jsonb(r)-ARRAY['request_key','request_hash']),'[]') FROM feature_one_private.report_rescans r WHERE user_id=p_actor));
$$;
DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['report_preferences','report_rescans'] LOOP
    EXECUTE format('ALTER TABLE feature_one_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON feature_one_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND
    (proname IN ('feature_one_focus','feature_one_job_reuse_snapshot','feature_one_comparison_input','feature_one_export_v7') OR proname LIKE 'feature_one_rescan_%') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
  REVOKE ALL ON FUNCTION feature_one_private.comparison_facts(uuid,uuid),feature_one_private.rescan_completed() FROM PUBLIC,anon,authenticated,service_role;
END $$;
NOTIFY pgrst,'reload schema';
