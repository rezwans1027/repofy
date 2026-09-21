-- Run 11: immutable deterministic outputs, source-free inputs and fenced writes.
CREATE TABLE feature_one_private.aggregation_policies (
  id text NOT NULL, version feature_one_private.version NOT NULL, definition jsonb NOT NULL,
  PRIMARY KEY(id,version)
);
INSERT INTO feature_one_private.aggregation_policies VALUES('evidence_aggregation','1.0.0',
 '{"id":"evidence_aggregation","version":"1.0.0","presenceCeiling":0.39,"corroborationBonuses":[0.1,0.05,0.025,0.0125],"enabledCorroboratingFamilies":["test"],"confidenceSupportBonus":0.05,"confidenceReliability":"minimum_used_observations","decimals":6,"maxEvidence":20000,"maxBytes":33554432,"crossRepository":"maximum_cluster_no_repository_bonus","satisfaction":"minimum_strength_if_all_minima_pass_else_zero","provenance":"not_inferred_v1"}');
CREATE TRIGGER immutable_aggregation_policy BEFORE UPDATE OR DELETE ON feature_one_private.aggregation_policies FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
CREATE TABLE feature_one_private.analysis_aggregations (
  run_id uuid PRIMARY KEY, user_id uuid NOT NULL, job_id uuid NOT NULL,
  policy_id text NOT NULL, policy_version feature_one_private.version NOT NULL,
  input_hash feature_one_private.digest NOT NULL, payload jsonb NOT NULL,
  FOREIGN KEY(run_id,user_id,job_id) REFERENCES public.analysis_runs(id,user_id,job_id) ON DELETE CASCADE,
  FOREIGN KEY(policy_id,policy_version) REFERENCES feature_one_private.aggregation_policies(id,version),
  CHECK(octet_length(payload::text)<=33554432)
);
CREATE TRIGGER immutable_analysis_aggregation BEFORE UPDATE ON feature_one_private.analysis_aggregations FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
CREATE TABLE feature_one_private.aggregation_support (
  run_id uuid NOT NULL REFERENCES feature_one_private.analysis_aggregations(run_id) ON DELETE CASCADE,
  capability_id text NOT NULL, taxonomy_id text NOT NULL, taxonomy_version feature_one_private.version NOT NULL,
  category_id text NOT NULL, evidence_id uuid NOT NULL, snapshot_id uuid NOT NULL, repository_id uuid NOT NULL,
  basis text NOT NULL CHECK(basis IN ('presence','implementation','corroboration')),
  PRIMARY KEY(run_id,capability_id,evidence_id,basis),
  FOREIGN KEY(run_id,snapshot_id) REFERENCES public.analysis_run_snapshots(run_id,snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY(evidence_id,snapshot_id) REFERENCES public.evidence_items(id,snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY(snapshot_id,repository_id) REFERENCES public.repository_snapshots(id,repository_id) ON DELETE CASCADE,
  FOREIGN KEY(run_id,taxonomy_id,taxonomy_version) REFERENCES public.analysis_runs(id,taxonomy_id,taxonomy_version) ON DELETE CASCADE,
  FOREIGN KEY(taxonomy_id,taxonomy_version,capability_id) REFERENCES public.capability_definitions(taxonomy_id,taxonomy_version,capability_id)
);
CREATE INDEX aggregation_support_page ON feature_one_private.aggregation_support(run_id,evidence_id);
CREATE TRIGGER immutable_aggregation_support BEFORE UPDATE ON feature_one_private.aggregation_support FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();

CREATE FUNCTION public.feature_one_job_aggregation_input(p_job uuid,p_token uuid,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; catalog jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions IS DISTINCT FROM q.policy->'versions' OR r.versions->'aggregationPolicy' IS DISTINCT FROM '{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  SELECT manifest INTO catalog FROM public.feature_one_rubric_releases
    WHERE manifest#>>'{taxonomy,id}'=r.taxonomy_id AND manifest#>>'{taxonomy,version}'=r.taxonomy_version
      AND NOT EXISTS(SELECT 1 FROM public.analysis_run_roles ar WHERE ar.run_id=r.id AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(manifest->'rubrics') rr WHERE rr->>'roleId'=ar.role_id AND rr->>'version'=ar.role_version))
    ORDER BY release_id LIMIT 1;
  IF catalog IS NULL THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  RETURN jsonb_build_object('runId',r.id,'jobId',r.job_id,'ownerUserId',r.user_id,'versions',r.versions,'catalog',catalog,
    'snapshots',(SELECT jsonb_agg(jsonb_build_object('snapshotId',s.id,'repositoryId',s.repository_id,'commitSha',s.commit_sha,
      'repositoryVisibility',s.visibility,'coverage',s.coverage,'files',(SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'fileId',f.locator_id,'lines',coalesce((f.structure->>'lines')::bigint,0),'analyzed',f.analyzed,'classification',f.classification,
        'outcome',f.structure->'coverage')) ORDER BY f.locator_id),'[]') FROM public.file_inventory f WHERE f.snapshot_id=s.id)) ORDER BY s.id)
      FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id WHERE rs.run_id=r.id),
    'evidence',(SELECT coalesce(jsonb_agg(jsonb_build_object('observation',e.observation,'fileId',e.file_locator_id,'contentFingerprint',e.content_fingerprint) ORDER BY e.id),'[]')
      FROM public.evidence_items e JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=e.snapshot_id WHERE rs.run_id=r.id));
END $$;

-- Independent enforcement of Run 03 ALL/minimum rules at the write boundary.
CREATE FUNCTION feature_one_private.aggregation_requirement(p_requirement jsonb,p_capabilities jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE cid text; cap jsonb; selected jsonb; unknowns jsonb:='[]'; failures jsonb:='[]'; why jsonb;
  strength numeric:=1; confidence numeric:=1; fraction numeric:=1; impl int; corroboration int; effective numeric;
  req_label int; cap_label int; state text; satisfaction numeric;
BEGIN
  FOR cid IN SELECT value FROM jsonb_array_elements_text(p_requirement->'capabilityIds') LOOP
    SELECT value INTO cap FROM jsonb_array_elements(p_capabilities) WHERE value->>'capabilityId'=cid;
    IF cap IS NULL THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    fraction:=least(fraction,(SELECT round(avg((s->>'fraction')::numeric),6) FROM jsonb_array_elements(cap#>'{trace,coverage}') s));
    IF cap->>'state'='unknown' THEN unknowns:=unknowns||jsonb_build_array(jsonb_build_object('capabilityId',cid,'reasons',jsonb_build_array('not_assessable'))); CONTINUE; END IF;
    confidence:=least(confidence,(cap->>'confidence')::numeric); why:='[]';
    IF cap->>'state'='not_observed' THEN strength:=0; why:='["not_observed"]';
    ELSE
      SELECT value INTO selected FROM jsonb_array_elements(cap#>'{trace,clusters}') WHERE value->>'clusterId'=cap#>>'{trace,selectedClusterId}';
      SELECT count(DISTINCT s->>'clusterId') INTO impl FROM jsonb_array_elements(cap->'support') s
        WHERE s->>'basis'='implementation' AND s->>'clusterId'=selected->>'clusterId';
      SELECT count(DISTINCT s->>'clusterId') INTO corroboration FROM jsonb_array_elements(cap->'support') s
        WHERE s->>'basis'='corroboration' AND p_requirement#>'{evidencePolicy,corroboratingFamilies}' ? (s->>'sourceType')
          AND EXISTS(SELECT 1 FROM jsonb_array_elements(selected->'corroboration') b WHERE b->>'evidenceId'=s->>'evidenceId')
          AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cap->'support') i WHERE i->>'basis'='implementation' AND i->>'clusterId'=s->>'clusterId');
      effective:=CASE WHEN impl>0 THEN (cap->>'strength')::numeric ELSE least((cap->>'strength')::numeric,.39) END;
      strength:=least(strength,effective);
      IF effective<(p_requirement->>'minimumEvidence')::numeric THEN why:=why||'"insufficient_strength"'::jsonb; END IF;
      req_label:=CASE p_requirement#>>'{evidencePolicy,minimumConfidence}' WHEN 'high' THEN 2 WHEN 'moderate' THEN 1 ELSE 0 END;
      cap_label:=CASE cap->>'confidenceLabel' WHEN 'high' THEN 2 WHEN 'moderate' THEN 1 ELSE 0 END;
      IF cap_label<req_label THEN why:=why||'"insufficient_confidence"'::jsonb; END IF;
      IF impl<(p_requirement#>>'{evidencePolicy,minimumImplementationClusters}')::int THEN why:=why||'"implementation_required"'::jsonb; END IF;
      IF corroboration<(p_requirement#>>'{evidencePolicy,minimumCorroboratingClusters}')::int THEN why:=why||'"independent_corroboration_required"'::jsonb; END IF;
    END IF;
    IF jsonb_array_length(why)>0 THEN failures:=failures||jsonb_build_array(jsonb_build_object('capabilityId',cid,'reasons',why)); END IF;
  END LOOP;
  IF jsonb_array_length(unknowns)>0 THEN state:='unknown'; strength:=NULL; confidence:=NULL; failures:=unknowns;
  ELSIF jsonb_array_length(failures)>0 THEN state:='unmet'; ELSE state:='satisfied'; END IF;
  satisfaction:=CASE WHEN state='satisfied' THEN strength ELSE 0 END;
  RETURN jsonb_build_object('state',state,'strength',strength,'confidence',confidence,'satisfaction',satisfaction,
    'weightedContribution',round((p_requirement->>'weight')::numeric*satisfaction,6),'assessableFraction',fraction,'failures',failures);
END $$;
REVOKE ALL ON FUNCTION feature_one_private.aggregation_requirement(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.feature_one_job_aggregation_store(p_job uuid,p_token uuid,p_run uuid,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; prior jsonb; cap jsonb; s jsonb; cl jsonb; bonus jsonb;
  role_result jsonb; req jsonb; cov jsonb; e public.evidence_items; base public.evidence_items; snap public.repository_snapshots;
  expected numeric; total numeric; num numeric; ids jsonb; rubric jsonb; calculated jsonb; unknown_weight numeric; assessed_fraction numeric; role_confidence numeric; ceiling numeric; reliability numeric; fraction numeric; support_bonus numeric; label text; allowed jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_result->>'runId' IS DISTINCT FROM r.id::text OR p_result->>'jobId' IS DISTINCT FROM p_job::text
    OR p_result->>'ownerUserId' IS DISTINCT FROM r.user_id::text OR p_result->>'visibility' IS DISTINCT FROM 'owner_only'
    OR p_result->>'contractVersion' IS DISTINCT FROM '1.0.0' OR p_result->'versions' IS DISTINCT FROM r.versions
    OR p_result->'policy' IS DISTINCT FROM r.versions->'aggregationPolicy'
    OR p_result->'policy' IS DISTINCT FROM '{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_policies WHERE id=p_result#>>'{policy,id}' AND version=p_result#>>'{policy,version}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  SELECT coalesce(jsonb_agg(snapshot_id::text ORDER BY snapshot_id),'[]') INTO ids FROM public.analysis_run_snapshots WHERE run_id=r.id;
  IF p_result->'snapshotIds' IS DISTINCT FROM ids THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  SELECT payload INTO prior FROM feature_one_private.analysis_aggregations WHERE run_id=r.id;
  IF FOUND THEN
    IF prior IS DISTINCT FROM p_result THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN prior;
  END IF;
  IF jsonb_typeof(p_result->'capabilities') IS DISTINCT FROM 'array' OR jsonb_typeof(p_result->'roles') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_result->'capabilities')<>(SELECT count(*) FROM public.capability_definitions WHERE taxonomy_id=r.taxonomy_id AND taxonomy_version=r.taxonomy_version)
    OR (SELECT count(DISTINCT c->>'capabilityId') FROM jsonb_array_elements(p_result->'capabilities') c)<>jsonb_array_length(p_result->'capabilities')
    OR jsonb_array_length(p_result->'roles')<>5 OR (SELECT count(DISTINCT c#>>'{template,roleId}') FROM jsonb_array_elements(p_result->'roles') c)<>5 THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  INSERT INTO feature_one_private.analysis_aggregations VALUES(r.id,r.user_id,p_job,p_result#>>'{policy,id}',p_result#>>'{policy,version}',p_result->>'inputHash',p_result);
  FOR cap IN SELECT value FROM jsonb_array_elements(p_result->'capabilities') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.capability_definitions WHERE taxonomy_id=r.taxonomy_id AND taxonomy_version=r.taxonomy_version AND capability_id=cap->>'capabilityId' AND group_id=cap->>'categoryId') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
    IF (SELECT jsonb_agg(c->>'snapshotId' ORDER BY c->>'snapshotId') FROM jsonb_array_elements(cap#>'{trace,coverage}') c) IS DISTINCT FROM ids THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
    FOR cov IN SELECT value FROM jsonb_array_elements(cap#>'{trace,coverage}') LOOP
      SELECT * INTO snap FROM public.repository_snapshots WHERE id=(cov->>'snapshotId')::uuid;
      SELECT value INTO s FROM jsonb_array_elements(coalesce(snap.coverage#>'{assessment,capabilities}','[]')) WHERE value->>'capabilityId'=cap->>'capabilityId';
      IF cov->>'repositoryId' IS DISTINCT FROM snap.repository_id::text OR cov->>'state' IS DISTINCT FROM coalesce(s->>'state','not_assessable')
        OR (cov->>'analyzedFiles')::numeric IS DISTINCT FROM coalesce((s->>'analyzedFiles')::numeric,0)
        OR (cov->>'eligibleFiles')::numeric IS DISTINCT FROM coalesce((s->>'eligibleFiles')::numeric,0)
        OR (cov->>'excludedFiles')::numeric IS DISTINCT FROM coalesce((snap.coverage#>>'{assessment,counts,excludedFiles}')::numeric,0)
        OR (cov->>'confidenceCeiling')::numeric IS DISTINCT FROM coalesce((s->>'confidenceCeiling')::numeric,0)
        OR (cov->>'metadataAssessed')::boolean IS DISTINCT FROM coalesce((s->>'metadataAssessed')::boolean,false) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      expected:=CASE WHEN s IS NULL OR s->>'state'='not_assessable' THEN 0
        WHEN (cov->>'eligibleFiles')::numeric+(cov->>'excludedFiles')::numeric>0 THEN round((cov->>'analyzedFiles')::numeric/((cov->>'eligibleFiles')::numeric+(cov->>'excludedFiles')::numeric),6)
        WHEN (cov->>'metadataAssessed')::boolean THEN 1 ELSE 0 END;
      IF (cov->>'fraction')::numeric IS DISTINCT FROM expected THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END LOOP;
    IF cap->>'state'='unknown' THEN
      IF cap->'strength' IS DISTINCT FROM 'null'::jsonb OR cap->'confidence' IS DISTINCT FROM 'null'::jsonb OR cap->'evidenceIds' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    ELSIF cap->>'state'='not_observed' THEN
      IF (cap->>'strength')::numeric IS DISTINCT FROM 0 OR cap->'evidenceIds' IS DISTINCT FROM '[]'::jsonb OR NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(cap#>'{trace,coverage}') c WHERE c->>'state'<>'not_assessable') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    ELSIF cap->>'state'='assessed' THEN
      IF jsonb_array_length(cap->'evidenceIds')=0 OR jsonb_array_length(cap#>'{trace,clusters}')=0 THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    ELSE RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(cap->'support') LOOP
      SELECT e0.* INTO e FROM public.evidence_items e0 JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=e0.snapshot_id WHERE rs.run_id=r.id AND e0.id=(s->>'evidenceId')::uuid;
      IF NOT FOUND OR e.snapshot_id::text IS DISTINCT FROM s->>'snapshotId' OR e.observation->>'repositoryId' IS DISTINCT FROM s->>'repositoryId'
        OR e.observation->'detector' IS DISTINCT FROM s->'detector' OR e.observation->>'sourceType' IS DISTINCT FROM s->>'sourceType'
        OR coalesce(e.observation#>>'{implementation,claimBoundary}',e.observation#>>'{structural,claimBoundary}') IS DISTINCT FROM s->>'boundary'
        OR NOT (cap->'evidenceIds' ? e.id::text) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      IF s->>'basis'='implementation' AND (NOT(e.observation->'capabilityIds' ? (cap->>'capabilityId')) OR e.observation->'implementation' IS NULL
        OR e.observation#>>'{implementation,testBoundary}'='mocked_or_intercepted') THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
      IF s->>'basis'='presence' AND NOT coalesce((
        (e.observation->'implementation' IS NOT NULL AND e.observation#>>'{implementation,testBoundary}'='mocked_or_intercepted' AND e.observation->'capabilityIds' ? (cap->>'capabilityId'))
        OR (e.observation#>>'{structural,kind}'='structure' AND cap->>'capabilityId'='language_presence')
        OR (e.observation#>>'{structural,kind}' IN ('dependency','configuration') AND cap->>'capabilityId'='framework_presence' AND jsonb_array_length(e.observation#>'{structural,technologies}')>0)
        OR (e.observation#>>'{structural,kind}'='schema' AND cap->>'capabilityId'='data_modeling')
        OR (e.observation#>>'{structural,kind}'='workflow' AND cap->>'capabilityId'='delivery_automation')
        OR (e.observation#>>'{structural,kind}'='container' AND cap->>'capabilityId'='delivery_reproducibility')
        OR (e.observation#>>'{structural,kind}'='documentation' AND (cap->>'capabilityId'='documentation_operability' OR
          cap->>'capabilityId'='documentation_decisions' AND (e.observation#>>'{structural,counts,architectureHeadings}')::int>0))
        OR (e.observation#>>'{structural,kind}' IN ('commit','pull_request') AND cap->>'capabilityId'='provenance_history')
      ),false) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
      IF s->>'basis'='corroboration' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cap#>'{trace,clusters}') cc,
        jsonb_array_elements(cc->'corroboration') b WHERE b->>'evidenceId'=e.id::text) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
      INSERT INTO feature_one_private.aggregation_support VALUES(r.id,cap->>'capabilityId',r.taxonomy_id,r.taxonomy_version,cap->>'categoryId',e.id,e.snapshot_id,(s->>'repositoryId')::uuid,s->>'basis') ON CONFLICT DO NOTHING;
    END LOOP;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(cap->'evidenceIds') eid WHERE NOT EXISTS(
      SELECT 1 FROM feature_one_private.aggregation_support a WHERE a.run_id=r.id AND a.capability_id=cap->>'capabilityId' AND a.evidence_id::text=eid)) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
    FOR cl IN SELECT value FROM jsonb_array_elements(cap#>'{trace,clusters}') LOOP
      SELECT * INTO base FROM public.evidence_items WHERE id=(cl->>'baseEvidenceId')::uuid;
      IF NOT (cl->'evidenceIds' ? base.id::text) OR base.observation->>'repositoryId' IS DISTINCT FROM cl->>'repositoryId'
        OR NOT ((cap->'evidenceIds') @> (cl->'evidenceIds')) OR (cl->>'baseStrength')::numeric IS DISTINCT FROM (base.observation->>'strength')::numeric THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(cl->'evidenceIds') member_id LEFT JOIN public.evidence_items member ON member.id::text=member_id
        WHERE member.id IS NULL OR member.observation->>'repositoryId' IS DISTINCT FROM cl->>'repositoryId'
          OR (member.observation->>'strength')::numeric>(cl->>'baseStrength')::numeric) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      expected:=CASE WHEN base.observation->'implementation' IS NULL OR base.observation#>>'{implementation,testBoundary}'='mocked_or_intercepted' THEN .39 ELSE 1 END;
      IF (cl->>'presenceCeiling')::numeric IS DISTINCT FROM expected OR jsonb_array_length(cl->'corroboration')>1 THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      total:=0;
      FOR bonus IN SELECT value FROM jsonb_array_elements(cl->'corroboration') LOOP
        SELECT * INTO e FROM public.evidence_items WHERE id=(bonus->>'evidenceId')::uuid;
        IF expected<>1 OR bonus->>'sourceType' IS DISTINCT FROM 'test' OR (bonus->>'rank')::int IS DISTINCT FROM 1 OR (bonus->>'bonus')::numeric IS DISTINCT FROM .1
          OR NOT(cap->'evidenceIds' ? e.id::text) OR e.snapshot_id IS DISTINCT FROM base.snapshot_id OR e.file_locator_id IS NOT DISTINCT FROM base.file_locator_id
          OR e.observation#>>'{implementation,testBoundary}' IS DISTINCT FROM 'local_implementation' OR NOT EXISTS(
            SELECT 1 FROM jsonb_array_elements(e.observation#>'{implementation,relations}') rel JOIN public.evidence_items member ON member.id=base.id
            WHERE rel->>'fileId'=member.file_locator_id::text AND rel->>'conceptId'=member.observation#>>'{implementation,conceptId}'
              AND rel->>'symbolId'=member.observation#>>'{implementation,symbolId}' AND rel->>'independence'='separate_test'
              AND rel->>'relationship'='asserted_call' AND (rel#>>'{lines,start}')::int<=(member.observation#>>'{implementation,span,lines,start}')::int AND (rel#>>'{lines,end}')::int>=(member.observation#>>'{implementation,span,lines,end}')::int) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
        total:=total+.1;
      END LOOP;
      IF (cl->>'strength')::numeric IS DISTINCT FROM round(least(expected,(cl->>'baseStrength')::numeric+total),6) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END LOOP;
    IF cap->>'state'='assessed' THEN
      SELECT value INTO cl FROM jsonb_array_elements(cap#>'{trace,clusters}') WHERE value->>'clusterId'=cap#>>'{trace,selectedClusterId}';
      IF cl IS NULL OR (cap->>'strength')::numeric IS DISTINCT FROM (cl->>'strength')::numeric OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(cap#>'{trace,clusters}') c WHERE (c->>'strength')::numeric>(cl->>'strength')::numeric) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END IF;
    IF cap->'provenance' IS DISTINCT FROM '{"state":"unknown","value":null,"policy":"not_inferred_v1"}'::jsonb THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    allowed:='[]';
    IF cap->>'state'='assessed' THEN
      SELECT * INTO base FROM public.evidence_items WHERE id=(cl->>'baseEvidenceId')::uuid;
      IF base.observation->'implementation' IS NOT NULL AND base.observation#>>'{implementation,kind}'<>'asserted_call' THEN allowed:=allowed||'"repository_behavior"'::jsonb; END IF;
      IF base.observation#>>'{structural,claimBoundary}'='configuration_presence' THEN allowed:=allowed||'"configuration_observation"'::jsonb; END IF;
      IF cap->>'capabilityId' IN ('language_presence','framework_presence') THEN allowed:=allowed||'"technology_presence"'::jsonb; END IF;
      IF cap->>'capabilityId'='provenance_history' AND base.observation#>'{structural,provider}' IS NOT NULL THEN allowed:=allowed||'"contribution_indicator"'::jsonb; END IF;
    END IF;
    IF NOT (allowed @> (cap->'allowedClaimScopes')) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
    IF cap->>'state'<>'unknown' THEN
      SELECT min((c->>'fraction')::numeric),max((c->>'confidenceCeiling')::numeric) INTO fraction,ceiling FROM jsonb_array_elements(cap#>'{trace,coverage}') c;
      reliability:=ceiling; support_bonus:=0;
      IF cap->>'state'='assessed' THEN
        reliability:=least((base.observation->>'confidence')::numeric,coalesce((SELECT min((used.observation->>'confidence')::numeric) FROM jsonb_array_elements(cl->'corroboration') b JOIN public.evidence_items used ON used.id=(b->>'evidenceId')::uuid),1));
        SELECT (c->>'confidenceCeiling')::numeric INTO ceiling FROM jsonb_array_elements(cap#>'{trace,coverage}') c WHERE c->>'snapshotId'=base.snapshot_id::text;
        IF jsonb_array_length(cl->'corroboration')>0 THEN support_bonus:=.05; END IF;
      END IF;
      calculated:=jsonb_build_object('reliability',reliability,'coverageFraction',fraction,'coverageFactor',round(.5+.5*fraction,6),
        'independentSupportBonus',support_bonus,'ceiling',ceiling,'provenanceMultiplier',NULL);
      IF cap#>'{trace,confidence}' IS DISTINCT FROM calculated THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      expected:=round(least(ceiling,reliability*round(.5+.5*fraction,6)+support_bonus),6);
      label:=CASE WHEN expected>=.5 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cap#>'{trace,coverage}') c WHERE c->>'state'<>'assessable' OR (c->>'fraction')::numeric<>1) THEN 'moderate' ELSE 'low' END;
      IF (cap->>'confidence')::numeric IS DISTINCT FROM expected OR cap->>'confidenceLabel' IS DISTINCT FROM label THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END IF;
    label:=CASE WHEN cap->>'state'='unknown' THEN 'unknown' WHEN (cap->>'strength')::numeric<.2 THEN 'not_observed'
      WHEN (cap->>'strength')::numeric<.4 THEN 'limited' WHEN (cap->>'strength')::numeric<.65 THEN 'moderate'
      WHEN (cap->>'strength')::numeric<.85 THEN 'strong' ELSE 'very_strong' END;
    IF cap->>'strengthBand' IS DISTINCT FROM label THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  FOR role_result IN SELECT value FROM jsonb_array_elements(p_result->'roles') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.analysis_run_roles WHERE run_id=r.id AND role_id=role_result#>>'{template,roleId}' AND role_version=role_result#>>'{template,version}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
    SELECT rr INTO rubric FROM public.feature_one_rubric_releases cr, jsonb_array_elements(cr.manifest->'rubrics') rr
      WHERE rr->>'roleId'=role_result#>>'{template,roleId}' AND rr->>'version'=role_result#>>'{template,version}' LIMIT 1;
    IF jsonb_array_length(role_result->'requirements')<>jsonb_array_length(rubric->'requirements') OR
      (SELECT count(DISTINCT value->>'requirementId') FROM jsonb_array_elements(role_result->'requirements'))<>jsonb_array_length(rubric->'requirements') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    total:=0; num:=0;
    FOR req IN SELECT value FROM jsonb_array_elements(role_result->'requirements') LOOP
      SELECT value INTO s FROM jsonb_array_elements(rubric->'requirements') WHERE value->>'requirementId'=req->>'requirementId';
      IF s IS NULL OR s->'weight' IS DISTINCT FROM req->'weight' OR s->'required' IS DISTINCT FROM req->'required'
        OR s->'minimumEvidence' IS DISTINCT FROM req->'minimumEvidence' OR s#>'{evidencePolicy,minimumConfidence}' IS DISTINCT FROM req->'minimumConfidence'
        OR NOT ((s->'capabilityIds') @> (req->'capabilityIds') AND (s->'capabilityIds') <@ (req->'capabilityIds')) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
      calculated:=feature_one_private.aggregation_requirement(s,p_result->'capabilities');
      IF NOT (req @> calculated) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      total:=total+(req->>'weight')::numeric; num:=num+(req->>'weightedContribution')::numeric;
    END LOOP;
    SELECT round(sum(CASE WHEN value->>'state'='unknown' THEN (value->>'weight')::numeric ELSE 0 END)/total,6),
      round(sum((value->>'weight')::numeric*(value->>'assessableFraction')::numeric)/total,6),
      round(sum((value->>'weight')::numeric*coalesce((value->>'confidence')::numeric,0))/total,6)
      INTO unknown_weight,assessed_fraction,role_confidence FROM jsonb_array_elements(role_result->'requirements');
    IF (role_result->>'unknownWeight')::numeric IS DISTINCT FROM unknown_weight OR (role_result->>'assessableFraction')::numeric IS DISTINCT FROM assessed_fraction
      OR (unknown_weight=1 AND (role_result->>'state' IS DISTINCT FROM 'unknown' OR role_result->'confidence' IS DISTINCT FROM 'null'::jsonb))
      OR (unknown_weight<>1 AND (role_result->>'state' IS DISTINCT FROM 'assessed' OR (role_result->>'confidence')::numeric IS DISTINCT FROM role_confidence)) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    IF (role_result->>'denominator')::numeric IS DISTINCT FROM round(total,6) OR (role_result->>'numerator')::numeric IS DISTINCT FROM round(num,6)
      OR (role_result->>'state'='assessed' AND (role_result->>'coverage')::numeric IS DISTINCT FROM round(num/total,6))
      OR (role_result->>'state'='unknown' AND role_result->'coverage' IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  RETURN p_result;
END $$;

CREATE FUNCTION public.feature_one_job_aggregation_read(p_actor uuid,p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT payload FROM feature_one_private.analysis_aggregations WHERE run_id=p_run AND user_id=p_actor;
$$;
CREATE FUNCTION public.feature_one_job_aggregation_evidence(p_actor uuid,p_run uuid,p_query jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a feature_one_private.analysis_aggregations; n int:=coalesce((p_query->>'limit')::int,50); results jsonb;
BEGIN
  SELECT * INTO a FROM feature_one_private.analysis_aggregations WHERE run_id=p_run AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF n NOT BETWEEN 1 AND 100 OR (p_query ? 'requirementId' AND NOT p_query ? 'roleId') THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  WITH matches AS (
    SELECT s.evidence_id,jsonb_agg(DISTINCT s.capability_id ORDER BY s.capability_id) caps FROM feature_one_private.aggregation_support s
    WHERE s.run_id=p_run AND (NOT p_query ? 'repositoryId' OR s.repository_id=(p_query->>'repositoryId')::uuid)
      AND (NOT p_query ? 'categoryId' OR s.category_id=p_query->>'categoryId')
      AND (NOT p_query ? 'afterEvidenceId' OR s.evidence_id>(p_query->>'afterEvidenceId')::uuid)
      AND (NOT p_query ? 'roleId' OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.payload->'roles') role_result,
        jsonb_array_elements(role_result->'requirements') req WHERE role_result#>>'{template,roleId}'=p_query->>'roleId'
          AND (NOT p_query ? 'requirementId' OR req->>'requirementId'=p_query->>'requirementId') AND req->'capabilityIds' ? s.capability_id))
    GROUP BY s.evidence_id ORDER BY s.evidence_id LIMIT n+1
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('evidence',e.observation,'capabilityIds',m.caps,'repositoryId',e.observation->'repositoryId') ORDER BY e.id),'[]') INTO results
    FROM matches m JOIN public.evidence_items e ON e.id=m.evidence_id;
  RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(results)>n THEN results-n ELSE results END,
    'nextEvidenceId',CASE WHEN jsonb_array_length(results)>n THEN results#>>ARRAY[(n-1)::text,'evidence','evidenceId'] ELSE NULL END);
END $$;
CREATE FUNCTION public.feature_one_export_v6(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.feature_one_export_v5(p_actor)||jsonb_build_object('aggregations',
    (SELECT coalesce(jsonb_agg(payload ORDER BY run_id),'[]') FROM feature_one_private.analysis_aggregations WHERE user_id=p_actor));
$$;
DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['aggregation_policies','analysis_aggregations','aggregation_support'] LOOP
    EXECUTE format('ALTER TABLE feature_one_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON feature_one_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND (proname LIKE 'feature_one_job_aggregation_%' OR proname='feature_one_export_v6') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
