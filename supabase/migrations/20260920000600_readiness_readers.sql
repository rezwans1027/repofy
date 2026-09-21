-- Run 13: source-free owner readers. Content stays immutable; access is evaluated now.
CREATE FUNCTION feature_one_private.report_access(p_actor uuid,p_run uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('snapshotId',s.snapshot_id,'repositoryId',s.repository_id,
    'visibility',CASE WHEN r.visibility='private' OR snap.visibility='private' OR g.revoked_at IS NOT NULL OR a.revoked_at IS NOT NULL OR i.status<>'active' THEN 'private' ELSE 'public' END,
    'access',CASE WHEN g.revoked_at IS NULL AND a.revoked_at IS NULL AND i.status='active' AND EXISTS(
      SELECT 1 FROM feature_one_private.repository_selection_items sel WHERE sel.user_id=p_actor AND sel.grant_id=g.id)
      THEN 'active' ELSE 'revoked' END) ORDER BY s.snapshot_id),'[]')
  FROM public.analysis_run_snapshots s JOIN public.repositories r ON r.id=s.repository_id
    JOIN public.repository_snapshots snap ON snap.id=s.snapshot_id
    JOIN public.repository_access_grants g ON g.id=s.grant_id
    JOIN public.github_accounts a ON a.id=g.github_account_id JOIN public.github_installations i ON i.id=g.installation_id
  WHERE s.run_id=p_run AND s.user_id=p_actor;
$$;

-- Published report evidence is a bounded set of representative citations. The
-- explorer must also include observations from every exact snapshot in the run,
-- including duplicate support and observations with no accepted capability map.
CREATE FUNCTION feature_one_private.report_evidence_membership(p_actor uuid,p_run uuid)
RETURNS TABLE(evidence_id uuid,snapshot_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT e.id,e.snapshot_id FROM public.analysis_run_snapshots s
    JOIN public.evidence_items e ON e.snapshot_id=s.snapshot_id
  WHERE s.run_id=p_run AND s.user_id=p_actor;
$$;

CREATE FUNCTION public.feature_one_report_history(p_actor uuid,p_query jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n int:=coalesce((p_query->>'limit')::int,20); cursor_row public.readiness_reports; rows jsonb;
BEGIN
  IF n NOT BETWEEN 1 AND 50 OR p_query-ARRAY['limit','afterReportId']<>'{}' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF p_query ? 'afterReportId' THEN
    SELECT * INTO cursor_row FROM public.readiness_reports WHERE id=(p_query->>'afterReportId')::uuid AND user_id=p_actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id DESC),'[]') INTO rows FROM (
    SELECT id,created_at,jsonb_build_object('reportId',id,'jobId',job_id,'runId',run_id,'createdAt',payload->'createdAt',
      'repositoryCount',jsonb_array_length(payload->'snapshots')) item FROM public.readiness_reports
    WHERE user_id=p_actor AND (cursor_row.id IS NULL OR (created_at,id)<(cursor_row.created_at,cursor_row.id))
    ORDER BY created_at DESC,id DESC LIMIT n+1) q;
  RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(rows)>n THEN rows-n ELSE rows END,
    'nextReportId',CASE WHEN jsonb_array_length(rows)>n THEN rows#>>ARRAY[(n-1)::text,'reportId'] ELSE NULL END);
END $$;

CREATE FUNCTION public.feature_one_report_view(p_actor uuid,p_report uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; run public.analysis_runs; tax jsonb;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO run FROM public.analysis_runs WHERE id=r.run_id;
  SELECT manifest INTO tax FROM public.feature_one_taxonomy_versions WHERE taxonomy_id=run.taxonomy_id AND version=run.taxonomy_version;
  RETURN jsonb_build_object('report',r.payload,'aggregation',(SELECT payload FROM feature_one_private.analysis_aggregations WHERE run_id=r.run_id AND user_id=p_actor),
    'repositories',feature_one_private.report_access(p_actor,r.run_id),
    'categories',(SELECT coalesce(jsonb_agg(jsonb_build_object('categoryId',v->'categoryId','label',v->'label')),'[]') FROM jsonb_array_elements(tax->'categories') v),
    'capabilities',(SELECT coalesce(jsonb_agg(jsonb_build_object('capabilityId',v->'capabilityId','taxonomyVersion',v->'taxonomyVersion',
      'groupId',v->'groupId','label',v->'label','description',v->'description')),'[]') FROM jsonb_array_elements(tax->'capabilities') v),
    'roleDefinitions',(SELECT coalesce(jsonb_agg(jsonb_build_object('roleId',t.role_id,'name',t.name,'requirements',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('requirementId',q.capability_id,'label',coalesce(q.definition->>'label',q.capability_id)) ORDER BY q.capability_id),'[]')
       FROM public.role_requirements q WHERE q.role_id=t.role_id AND q.role_version=t.version)) ORDER BY t.role_id),'[]')
      FROM public.analysis_run_roles rr JOIN public.role_templates t ON t.role_id=rr.role_id AND t.version=rr.role_version WHERE rr.run_id=r.run_id));
END $$;

CREATE FUNCTION public.feature_one_report_evidence(p_actor uuid,p_report uuid,p_query jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; a jsonb; access_rows jsonb; rows jsonb; n int:=coalesce((p_query->>'limit')::int,50);
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT payload INTO a FROM feature_one_private.analysis_aggregations WHERE run_id=r.run_id AND user_id=p_actor;
  IF n NOT BETWEEN 1 AND 100 OR p_query-ARRAY['limit','repositoryId','categoryId','roleId','requirementId','capabilityId','evidenceId','afterEvidenceId']<>'{}'
    OR (p_query ? 'requirementId' AND NOT p_query ? 'roleId') THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF p_query ? 'repositoryId' AND NOT EXISTS(SELECT 1 FROM public.analysis_run_snapshots WHERE run_id=r.run_id AND repository_id=(p_query->>'repositoryId')::uuid)
    OR p_query ? 'evidenceId' AND NOT EXISTS(SELECT 1 FROM feature_one_private.report_evidence_membership(p_actor,r.run_id) WHERE evidence_id=(p_query->>'evidenceId')::uuid)
    OR p_query ? 'afterEvidenceId' AND NOT EXISTS(SELECT 1 FROM feature_one_private.report_evidence_membership(p_actor,r.run_id) WHERE evidence_id=(p_query->>'afterEvidenceId')::uuid)
    THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  access_rows:=feature_one_private.report_access(p_actor,r.run_id);
  WITH matches AS (
    SELECT e.id,e.observation FROM feature_one_private.report_evidence_membership(p_actor,r.run_id) re JOIN public.evidence_items e ON e.id=re.evidence_id
    WHERE (NOT p_query ? 'evidenceId' OR e.id=(p_query->>'evidenceId')::uuid)
      AND (NOT p_query ? 'afterEvidenceId' OR e.id>(p_query->>'afterEvidenceId')::uuid)
      AND (NOT p_query ? 'repositoryId' OR e.observation->>'repositoryId'=p_query->>'repositoryId')
      AND (NOT (p_query ?| ARRAY['categoryId','capabilityId','roleId']) OR EXISTS(
        SELECT 1 FROM feature_one_private.aggregation_support s WHERE s.run_id=r.run_id AND s.evidence_id=e.id
          AND (NOT p_query ? 'categoryId' OR s.category_id=p_query->>'categoryId')
          AND (NOT p_query ? 'capabilityId' OR s.capability_id=p_query->>'capabilityId')
          AND (NOT p_query ? 'roleId' OR EXISTS(SELECT 1 FROM jsonb_array_elements(a->'roles') role_result,jsonb_array_elements(role_result->'requirements') req
            WHERE role_result#>>'{template,roleId}'=p_query->>'roleId' AND (NOT p_query ? 'requirementId' OR req->>'requirementId'=p_query->>'requirementId')
              AND req->'capabilityIds' ? s.capability_id))))
    ORDER BY e.id LIMIT n+1
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('evidence',(m.observation-'location')||jsonb_build_object('repositoryVisibility',access_row->'visibility'),
    'access',access_row->'access','support',(SELECT coalesce(jsonb_agg(s),'[]') FROM jsonb_array_elements(a->'capabilities') c,
      jsonb_array_elements(c->'support') s WHERE s->>'evidenceId'=m.id::text)) ORDER BY m.id),'[]') INTO rows
    FROM matches m JOIN LATERAL (SELECT value access_row FROM jsonb_array_elements(access_rows) WHERE value->>'snapshotId'=m.observation->>'snapshotId') ar ON true;
  RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(rows)>n THEN rows-n ELSE rows END,
    'nextEvidenceId',CASE WHEN jsonb_array_length(rows)>n THEN rows#>>ARRAY[(n-1)::text,'evidence','evidenceId'] ELSE NULL END);
END $$;

-- This encrypted internal response is never sent to a browser. Both pre/post provider
-- checks use this RPC so deletion, reselection or revocation fences location disclosure.
CREATE FUNCTION public.feature_one_report_locator(p_actor uuid,p_report uuid,p_evidence uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row record;
BEGIN
  SELECT e.*,s.repository_id,s.grant_id,g.access_revision,g.github_account_id,g.installation_id,r.visibility current_visibility,
    r.provider_repository_id INTO row FROM public.readiness_reports report
    JOIN LATERAL feature_one_private.report_evidence_membership(p_actor,report.run_id) re ON true
    JOIN public.evidence_items e ON e.id=re.evidence_id
    JOIN public.analysis_run_snapshots s ON s.run_id=report.run_id AND s.snapshot_id=e.snapshot_id
    JOIN public.repository_access_grants g ON g.id=s.grant_id JOIN public.repositories r ON r.id=s.repository_id
    WHERE report.id=p_report AND report.user_id=p_actor AND e.id=p_evidence;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM feature_one_private.require_grant(p_actor,row.grant_id);
  IF NOT EXISTS(SELECT 1 FROM feature_one_private.repository_selection_items WHERE user_id=p_actor AND grant_id=row.grant_id) THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  RETURN jsonb_build_object('evidenceId',row.id,'snapshotId',row.snapshot_id,'repositoryId',row.repository_id,
    'commitSha',row.observation->'commitSha','visibility',CASE WHEN row.current_visibility='private' OR row.observation->>'repositoryVisibility'='private' THEN 'private' ELSE 'public' END,
    'grantId',row.grant_id,'accessRevision',row.access_revision,'accountId',row.github_account_id,'installationId',row.installation_id,
    'providerRepositoryId',row.provider_repository_id,'locatorId',row.locator_id,'locatorEncrypted',row.locator_encrypted);
END $$;

CREATE FUNCTION public.feature_one_report_delete(p_actor uuid,p_report uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job uuid;
BEGIN
  SELECT job_id INTO job FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  -- Deletion must also work when an old report cannot be parsed by today's UI.
  PERFORM public.feature_one_delete_analysis(p_actor,job,p_request_id);
  RETURN jsonb_build_object('deleted',true);
END $$;

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK(action IN (
  'grant_verified','grant_revoked','analysis_created','run_created','report_completed','analysis_canceled','analysis_deleted',
  'github_linked','github_unlinked','repository_selected','repository_deselected','report_viewed','evidence_opened','improvement_opened'));
CREATE FUNCTION public.feature_one_report_event(p_actor uuid,p_report uuid,p_event jsonb,p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; event_action text:=p_event->>'event';
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF event_action NOT IN ('report_viewed','evidence_opened','improvement_opened') OR event_action IS NULL OR p_event-ARRAY['event','objectId']<>'{}' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF event_action='evidence_opened' AND NOT EXISTS(SELECT 1 FROM feature_one_private.report_evidence_membership(p_actor,r.run_id) WHERE evidence_id=(p_event->>'objectId')::uuid)
    OR event_action='improvement_opened' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'improvements') v WHERE v->>'improvementId'=p_event->>'objectId')
    THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  -- No text, names, paths, browser URLs, or user-supplied metadata. Coalesce repeat opens.
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE actor_id=p_actor AND job_id=r.job_id AND audit_events.action=event_action AND created_at>now()-interval '1 minute') THEN
    INSERT INTO public.audit_events(actor_id,job_id,action,object_type,object_id,request_id)
      VALUES(p_actor,r.job_id,event_action,'report',r.id,p_request_id);
  END IF;
END $$;
DO $$ DECLARE f record; BEGIN
  REVOKE ALL ON FUNCTION feature_one_private.report_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
  REVOKE ALL ON FUNCTION feature_one_private.report_evidence_membership(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'feature_one_report_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
