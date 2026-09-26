-- Original requested metadata is distinct from what the provider could supply.
-- Expose only the owner's saved job options; never rewrite the immutable report.
CREATE OR REPLACE FUNCTION public.feature_one_report_view(p_actor uuid,p_report uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.readiness_reports; run public.analysis_runs; tax jsonb;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO run FROM public.analysis_runs WHERE id=r.run_id;
  SELECT manifest INTO tax FROM public.feature_one_taxonomy_versions WHERE taxonomy_id=run.taxonomy_id AND version=run.taxonomy_version;
  RETURN jsonb_build_object('report',r.payload,'aggregation',(SELECT payload FROM feature_one_private.analysis_aggregations WHERE run_id=r.run_id AND user_id=p_actor),
    'metadataOptions',coalesce((SELECT request->'includeMetadata' FROM public.analysis_jobs WHERE id=r.job_id AND user_id=p_actor),'{"commits":false,"pullRequests":false,"ci":false}'::jsonb),
    'repositories',feature_one_private.report_access(p_actor,r.run_id),
    'categories',(SELECT coalesce(jsonb_agg(jsonb_build_object('categoryId',v->'categoryId','label',v->'label')),'[]') FROM jsonb_array_elements(tax->'categories') v),
    'capabilities',(SELECT coalesce(jsonb_agg(jsonb_build_object('capabilityId',v->'capabilityId','taxonomyVersion',v->'taxonomyVersion',
      'groupId',v->'groupId','label',v->'label','description',v->'description')),'[]') FROM jsonb_array_elements(tax->'capabilities') v),
    'roleDefinitions',(SELECT coalesce(jsonb_agg(jsonb_build_object('roleId',t.role_id,'name',t.name,'requirements',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('requirementId',q.capability_id,'label',coalesce(q.definition->>'label',q.capability_id)) ORDER BY q.capability_id),'[]')
       FROM public.role_requirements q WHERE q.role_id=t.role_id AND q.role_version=t.version)) ORDER BY t.role_id),'[]')
      FROM public.analysis_run_roles rr JOIN public.role_templates t ON t.role_id=rr.role_id AND t.version=rr.role_version WHERE rr.run_id=r.run_id));
END $$;
REVOKE ALL ON FUNCTION public.feature_one_report_view(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feature_one_report_view(uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
