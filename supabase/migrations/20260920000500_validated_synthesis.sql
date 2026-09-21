-- Run 12. Source-free model ledger; source and rejected model text are never persisted.
CREATE TABLE feature_one_private.narrative_policies (
  id text PRIMARY KEY, definition jsonb NOT NULL
);
INSERT INTO feature_one_private.narrative_policies VALUES('bounded_narrative_1.0.0',
 '{"provider":"openai","model":"gpt-4.1-mini-2025-04-14","prompt":"bounded_narrative","version":"1.0.0","schema":"1.0.0","ranking":"proof_priority_1.0.0","pricing":"openai_2026_09_20","reservationUsd":0.05,"jobBudgetUsd":0.10,"globalDailyBudgetUsd":10,"maxCallsPerJob":2}'::jsonb);
CREATE TRIGGER immutable_narrative_policy BEFORE UPDATE OR DELETE ON feature_one_private.narrative_policies FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
ALTER TABLE public.model_runs
  ADD COLUMN narrative_policy text REFERENCES feature_one_private.narrative_policies(id),
  ADD COLUMN allowed_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN request_state text NOT NULL DEFAULT 'legacy' CHECK(request_state IN ('legacy','reserved','succeeded','failed','unknown')),
  ADD COLUMN validation_code text CHECK(validation_code IN ('valid','invalid_schema','unsupported_selection','provider_refusal','provider_incomplete','provider_malformed','response_limit','provider_rejected','provider_rate_limit','outcome_unknown','budget_exhausted','configuration_disabled')),
  ADD COLUMN reserved_cost numeric NOT NULL DEFAULT 0 CHECK(reserved_cost BETWEEN 0 AND 0.05),
  ADD COLUMN provider_status integer CHECK(provider_status BETWEEN 100 AND 599),
  ADD COLUMN pricing_version text,
  ADD COLUMN validated_report_hash feature_one_private.digest,
  ADD COLUMN finished_at timestamptz;
-- Anonymous financial reservations survive account/job deletion; they contain no source or account key.
CREATE TABLE feature_one_private.model_budget_charges (
  id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), amount numeric NOT NULL CHECK(amount BETWEEN 0 AND 0.05)
);
CREATE INDEX model_budget_window ON feature_one_private.model_budget_charges(created_at);
CREATE INDEX model_job_requests ON public.model_runs(job_id,created_at);
CREATE FUNCTION feature_one_private.model_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.request_state<>'reserved' OR NEW.request_state NOT IN ('succeeded','failed','unknown')
    OR (to_jsonb(NEW)-ARRAY['input_tokens','output_tokens','estimated_cost','latency_ms','provider_status','validation_status','validation_code','request_state','validated_report_hash','finished_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['input_tokens','output_tokens','estimated_cost','latency_ms','provider_status','validation_status','validation_code','request_state','validated_report_hash','finished_at']) THEN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER model_run_transition BEFORE UPDATE ON public.model_runs FOR EACH ROW EXECUTE FUNCTION feature_one_private.model_transition();

CREATE FUNCTION public.feature_one_job_narrative_input(p_job uuid,p_token uuid,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb; r public.analysis_runs; ids uuid[];
BEGIN
  PERFORM feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  SELECT payload INTO a FROM feature_one_private.analysis_aggregations WHERE run_id=p_run AND job_id=p_job;
  IF r.id IS NULL OR a IS NULL THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  SELECT array_agg(DISTINCT id) INTO ids FROM (
    SELECT (cl->>'baseEvidenceId')::uuid id FROM jsonb_array_elements(a->'capabilities') c,
      jsonb_array_elements(c#>'{trace,clusters}') cl WHERE cl->>'clusterId'=c#>>'{trace,selectedClusterId}'
    UNION SELECT (t->>'evidenceId')::uuid FROM jsonb_array_elements(a->'capabilities') c,
      jsonb_array_elements(c#>'{trace,clusters}') cl,jsonb_array_elements(cl->'corroboration') t WHERE cl->>'clusterId'=c#>>'{trace,selectedClusterId}'
  ) selected;
  RETURN jsonb_build_object('aggregation',a,'createdAt',to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'snapshots',(SELECT jsonb_agg(jsonb_build_object('contractVersion','1.0.0','snapshotId',s.id,'repositoryId',s.repository_id,
      'provider','github','commitSha',s.commit_sha,'repositoryVisibility',s.visibility,'snapshotIdentityVersion',s.identity_version,
      'extractionPolicyVersion',s.extraction_policy_version,'securityPolicyHash',s.security_policy_hash,
      'createdAt',to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'repositoryLabel','Repository') ORDER BY s.id)
      FROM public.repository_snapshots s JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=s.id WHERE rs.run_id=p_run),
    'coverage',(SELECT jsonb_agg(s.coverage ORDER BY s.id) FROM public.repository_snapshots s JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=s.id WHERE rs.run_id=p_run),
    'evidence',(SELECT coalesce(jsonb_agg(e.observation ORDER BY e.id),'[]') FROM public.evidence_items e WHERE e.id=ANY(ids)));
END $$;

CREATE FUNCTION public.feature_one_job_model_reserve(p_job uuid,p_token uuid,p_run uuid,p_hash text,p_refs uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; mid uuid:=gen_random_uuid(); spent numeric;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  IF NOT EXISTS(SELECT 1 FROM public.analysis_jobs WHERE id=p_job AND stage='synthesizing') THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF r.id IS NULL OR q.policy#>'{versions,synthesis}' IS DISTINCT FROM '{"kind":"model","prompt":{"id":"bounded_narrative","version":"1.0.0"},"model":{"provider":"openai","identifier":"gpt-4.1-mini","version":"gpt-4.1-mini-2025-04-14"}}'::jsonb
    OR q.policy#>'{versions,disclosurePolicy}' IS DISTINCT FROM '{"id":"candidate_private","version":"1.0.0"}'::jsonb
    OR p_hash !~ '^sha256:[a-f0-9]{64}$' OR p_hash IS NULL OR p_refs IS NULL OR cardinality(p_refs)>500
    OR cardinality(p_refs)<>(SELECT count(DISTINCT x) FROM unnest(p_refs) x)
    OR EXISTS(SELECT 1 FROM unnest(p_refs) x WHERE NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_support WHERE run_id=p_run AND evidence_id=x)) THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  IF EXISTS(SELECT 1 FROM public.model_runs WHERE job_id=p_job AND (request_state IN ('reserved','unknown','succeeded') OR validation_status='invalid')) THEN RAISE EXCEPTION 'MODEL_OUTCOME_UNKNOWN'; END IF;
  IF (SELECT count(*) FROM public.model_runs WHERE job_id=p_job)>=2 THEN RAISE EXCEPTION 'PROVIDER_FAILURE'; END IF;
  -- One global lock serializes check + reservation across workers. Limits include uncertain outcomes.
  PERFORM pg_advisory_xact_lock(12092026);
  SELECT coalesce(sum(amount),0) INTO spent FROM feature_one_private.model_budget_charges WHERE created_at>clock_timestamp()-interval '24 hours';
  IF spent+0.05>10 OR (SELECT coalesce(sum(reserved_cost),0)+0.05>0.10 FROM public.model_runs WHERE job_id=p_job) THEN RAISE EXCEPTION 'PROVIDER_FAILURE'; END IF;
  INSERT INTO feature_one_private.model_budget_charges(id,amount) VALUES(mid,0.05);
  INSERT INTO public.model_runs(id,attempt_id,job_id,user_id,purpose,provider,model,prompt_version,input_fingerprint,fingerprint_key_version,
    output_schema_version,validation_status,narrative_policy,allowed_evidence_ids,request_state,reserved_cost,pricing_version)
    VALUES(mid,q.current_attempt,p_job,r.user_id,'readiness_synthesis','openai','gpt-4.1-mini-2025-04-14','1.0.0',p_hash,'1.0.0','1.0.0','pending',
      'bounded_narrative_1.0.0',p_refs,'reserved',0.05,'openai_2026_09_20');
  RETURN mid;
END $$;

-- Numeric/membership guard complements the trusted worker's closed-choice semantic validator.
CREATE FUNCTION feature_one_private.require_narrative(p_job uuid,p_report jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a jsonb; c jsonb; actual jsonb; role jsonb; m public.model_runs;
BEGIN
  SELECT payload INTO a FROM feature_one_private.analysis_aggregations WHERE job_id=p_job AND run_id=(p_report->>'analysisRunId')::uuid;
  SELECT * INTO m FROM public.model_runs WHERE id=(p_report#>>'{narrative,modelRunId}')::uuid AND job_id=p_job;
  IF a IS NULL OR m.id IS NULL OR p_report->'versions' IS DISTINCT FROM a->'versions'
    OR p_report->>'ownerUserId' IS DISTINCT FROM m.user_id::text OR p_report->>'visibility' IS DISTINCT FROM 'owner_only'
    OR p_report#>>'{narrative,policy}' IS DISTINCT FROM 'bounded_narrative_1.0.0'
    OR p_report#>>'{narrative,rendering}' IS DISTINCT FROM 'validated_model_selection_deterministic_text'
    OR p_report#>>'{narrative,rankingPolicy}' IS DISTINCT FROM 'proof_priority_1.0.0'
    OR p_report#>>'{narrative,inputHash}' IS DISTINCT FROM m.input_fingerprint
    OR p_report#>>'{narrative,aggregationInputHash}' IS DISTINCT FROM a->>'inputHash'
    OR jsonb_array_length(p_report->'capabilityGroups') IS NULL THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_report->'capabilityGroups') g,jsonb_array_elements(g->'capabilities') cap)<>jsonb_array_length(a->'capabilities') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(a->'capabilities') LOOP
    SELECT cap INTO actual FROM jsonb_array_elements(p_report->'capabilityGroups') g,jsonb_array_elements(g->'capabilities') cap WHERE cap->>'capabilityId'=c->>'capabilityId';
    IF actual IS NULL OR actual->>'state' IS DISTINCT FROM c->>'state' OR (c->>'state'='assessed' AND
      (actual->'strength' IS DISTINCT FROM c->'strength' OR actual->'confidence' IS DISTINCT FROM c->'confidence')) OR
      (c->>'state'='not_observed' AND actual->'confidence' IS DISTINCT FROM c->'confidence') THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  END LOOP;
  FOR role IN SELECT value FROM jsonb_array_elements(a->'roles') LOOP
    SELECT v INTO actual FROM jsonb_array_elements(p_report->'roles') v WHERE v->'template'=role->'template';
    IF actual IS NULL OR actual->>'state' IS DISTINCT FROM role->>'state' OR (role->>'state'='assessed' AND
      (actual->'coverage' IS DISTINCT FROM role->'coverage' OR actual->'confidence' IS DISTINCT FROM role->'confidence')) THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_path_query(p_report,'strict $.** ? (exists (@.evidenceIds)).evidenceIds[*]') n WHERE NOT (n#>>'{}')::uuid=ANY(m.allowed_evidence_ids))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_report->'improvements') i WHERE i->'permittedLocations'<>'[]'::jsonb OR i->>'proofStatus' IS DISTINCT FROM 'proposed_not_observed')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_report->'evidence') e WHERE e ? 'location') THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
END $$;

CREATE FUNCTION public.feature_one_job_model_finish(p_job uuid,p_token uuid,p_model uuid,p_outcome jsonb,p_report jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.model_runs; q feature_one_private.analysis_execution; code text:=p_outcome->>'code'; cost numeric; digest text;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO m FROM public.model_runs WHERE id=p_model AND job_id=p_job AND attempt_id=q.current_attempt FOR UPDATE;
  IF m.id IS NULL OR m.request_state<>'reserved' OR code IS NULL OR (p_outcome-ARRAY['code','inputTokens','outputTokens','latencyMs','providerStatus'])<>'{}'::jsonb THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  IF (p_outcome->>'inputTokens')::integer NOT BETWEEN 0 AND 80000 OR (p_outcome->>'outputTokens')::integer NOT BETWEEN 0 AND 8192
    OR (p_outcome->>'latencyMs')::integer NOT BETWEEN 0 AND 60000 OR NOT p_outcome ? 'latencyMs' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF code='valid' THEN
    IF p_report IS NULL OR p_report#>>'{narrative,modelRunId}' IS DISTINCT FROM p_model::text OR p_outcome->>'inputTokens' IS NULL OR p_outcome->>'outputTokens' IS NULL THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
    PERFORM feature_one_private.require_narrative(p_job,p_report);
    digest:='sha256:'||encode(sha256(convert_to(p_report::text,'UTF8')),'hex');
  ELSIF p_report IS NOT NULL THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  cost:=CASE WHEN code IN ('provider_rate_limit','provider_rejected','configuration_disabled') THEN 0
    WHEN p_outcome->>'inputTokens' IS NOT NULL AND p_outcome->>'outputTokens' IS NOT NULL
      THEN ((p_outcome->>'inputTokens')::numeric*0.4+(p_outcome->>'outputTokens')::numeric*1.6)/1000000 ELSE m.reserved_cost END;
  IF cost>m.reserved_cost THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  UPDATE public.model_runs SET input_tokens=(p_outcome->>'inputTokens')::integer,output_tokens=(p_outcome->>'outputTokens')::integer,
    estimated_cost=cost,provider_status=(p_outcome->>'providerStatus')::integer,latency_ms=(p_outcome->>'latencyMs')::integer,validation_code=code,validated_report_hash=digest,finished_at=clock_timestamp(),
    validation_status=CASE WHEN code='valid' THEN 'valid' WHEN code IN ('outcome_unknown','provider_rate_limit','provider_rejected','configuration_disabled') THEN 'failed' ELSE 'invalid' END,
    request_state=CASE WHEN code='valid' THEN 'succeeded' WHEN code='outcome_unknown' THEN 'unknown' ELSE 'failed' END WHERE id=p_model;
  UPDATE feature_one_private.model_budget_charges SET amount=cost WHERE id=p_model;
END $$;

CREATE FUNCTION public.feature_one_job_narrative_validate(p_job uuid,p_token uuid,p_report jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM feature_one_private.analysis_fence(p_job,p_token);
  PERFORM feature_one_private.require_narrative(p_job,p_report);
  IF NOT EXISTS(SELECT 1 FROM public.model_runs WHERE job_id=p_job AND id=(p_report#>>'{narrative,modelRunId}')::uuid AND validation_status='valid'
    AND validated_report_hash='sha256:'||encode(sha256(convert_to(p_report::text,'UTF8')),'hex')) THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
END $$;

-- Run 11 support includes derived structural mappings and linked test corroboration.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.assessment_evidence'::regclass AND confrelid='public.capability_evidence'::regclass LOOP
    EXECUTE format('ALTER TABLE public.assessment_evidence DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
CREATE FUNCTION feature_one_private.assessment_support() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.capability_evidence WHERE evidence_id=NEW.evidence_id AND capability_id=NEW.capability_id AND taxonomy_id=NEW.taxonomy_id AND taxonomy_version=NEW.taxonomy_version)
    AND NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_support WHERE run_id=NEW.run_id AND evidence_id=NEW.evidence_id AND capability_id=NEW.capability_id AND taxonomy_id=NEW.taxonomy_id AND taxonomy_version=NEW.taxonomy_version) THEN RAISE EXCEPTION 'INVALID_MEMBERSHIP' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER assessment_support AFTER INSERT OR UPDATE ON public.assessment_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION feature_one_private.assessment_support();

-- Preserve Run 07 authorization, immutable observations and settlement in the same transaction.
CREATE OR REPLACE FUNCTION public.feature_one_finalize_report(p_actor uuid, p_report jsonb, p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.analysis_jobs; r public.analysis_runs; item jsonb; nested jsonb; cap jsonb; claim jsonb; sid uuid;
  eid uuid; rid uuid := (p_report->>'reportId')::uuid; s public.repository_snapshots; tid text; tv text;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id = (p_report->>'jobId')::uuid AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM feature_one_private.require_analysis_fence(j.id);
  SELECT * INTO r FROM public.analysis_runs WHERE id = (p_report->>'analysisRunId')::uuid AND job_id = j.id AND user_id = p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF j.status <> 'running' OR EXISTS (SELECT 1 FROM public.readiness_reports WHERE job_id = j.id) THEN RAISE EXCEPTION 'ALREADY_FINALIZED'; END IF;
  IF p_report->>'ownerUserId' IS DISTINCT FROM p_actor::text OR p_report->>'visibility' IS DISTINCT FROM 'owner_only'
      OR p_report->>'contractVersion' IS DISTINCT FROM '1.0.0' OR p_report->'versions' IS DISTINCT FROM r.versions THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  FOR item IN SELECT to_jsonb(g) FROM public.analysis_job_grants g WHERE job_id = j.id LOOP
    PERFORM feature_one_private.require_grant(p_actor, (item->>'grant_id')::uuid);
  END LOOP;
  IF r.versions#>>'{synthesis,prompt,id}'='bounded_narrative' THEN
    PERFORM public.feature_one_job_narrative_validate(j.id,current_setting('feature_one.worker_token',true)::uuid,p_report);
  ELSIF p_report ? 'narrative' THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  tid := r.taxonomy_id; tv := r.taxonomy_version;
  IF jsonb_array_length(p_report->'snapshots') <> (SELECT count(*) FROM public.analysis_run_snapshots WHERE run_id = r.id)
      OR jsonb_array_length(p_report->'coverage') <> jsonb_array_length(p_report->'snapshots')
      OR jsonb_array_length(p_report->'roles') <> 5 THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_report->'snapshots') LOOP
    sid := (item->>'snapshotId')::uuid;
    SELECT s0.* INTO s FROM public.repository_snapshots s0 JOIN public.analysis_run_snapshots rs ON rs.snapshot_id = s0.id WHERE rs.run_id = r.id AND s0.id = sid;
    IF NOT FOUND THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
    IF item->>'contractVersion' IS DISTINCT FROM '1.0.0' OR item->>'provider' IS DISTINCT FROM 'github'
        OR (item->>'repositoryId')::uuid IS DISTINCT FROM s.repository_id OR item->>'commitSha' IS DISTINCT FROM s.commit_sha
        OR item->>'repositoryVisibility' IS DISTINCT FROM s.visibility OR item->>'snapshotIdentityVersion' IS DISTINCT FROM s.identity_version
        OR item->>'extractionPolicyVersion' IS DISTINCT FROM s.extraction_policy_version OR (item->>'createdAt')::timestamptz IS DISTINCT FROM s.created_at
        OR NOT (p_report->'coverage' @> jsonb_build_array(s.coverage)) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'snapshotId') FROM jsonb_array_elements(p_report->'snapshots')) <> jsonb_array_length(p_report->'snapshots') THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_report->'roles') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.analysis_run_roles WHERE run_id = r.id AND role_id = item#>>'{template,roleId}' AND role_version = item#>>'{template,version}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
    FOR cap IN SELECT value FROM jsonb_array_elements(coalesce(item->'assessedRequirementIds', '[]') || coalesce(item->'unknownRequirementIds', '[]')) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.role_requirements WHERE role_id = item#>>'{template,roleId}' AND role_version = item#>>'{template,version}' AND capability_id = cap#>>'{}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(DISTINCT value#>>'{template,roleId}') FROM jsonb_array_elements(p_report->'roles')) <> 5 THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_report->'evidence') LOOP
    eid := (item->>'evidenceId')::uuid; sid := (item->>'snapshotId')::uuid;
    -- Exact persisted observations, plus an owner-safe location projection. No invented evidence.
    IF NOT EXISTS (SELECT 1 FROM public.evidence_items e WHERE e.id = eid AND e.snapshot_id = sid AND e.observation = item - 'location') THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
    INSERT INTO public.analysis_run_evidence(run_id, evidence_id, snapshot_id) VALUES (r.id, eid, sid);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_report->'capabilityGroups') LOOP
    FOR cap IN SELECT value FROM jsonb_array_elements(item->'capabilities') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.capability_definitions WHERE taxonomy_id = tid AND taxonomy_version = tv AND capability_id = cap->>'capabilityId' AND group_id = item->>'groupId') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
      INSERT INTO public.capability_assessments(run_id, taxonomy_id, taxonomy_version, capability_id, assessment)
        VALUES (r.id, tid, tv, cap->>'capabilityId', cap);
      FOR nested IN SELECT value FROM jsonb_array_elements(coalesce(cap->'evidenceIds', '[]')) LOOP
        INSERT INTO public.assessment_evidence(run_id, capability_id, taxonomy_id, taxonomy_version, evidence_id)
          VALUES (r.id, cap->>'capabilityId', tid, tv, (nested#>>'{}')::uuid);
      END LOOP;
      FOR nested IN SELECT value FROM jsonb_array_elements(coalesce(cap->'coverageSnapshotIds', '[]')) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots WHERE run_id = r.id AND snapshot_id = (nested#>>'{}')::uuid) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  -- A verified claim must have mapped support for each claimed capability. This checks
  -- relational support, not the semantic truth/quality of generated prose (Runs 11/12).
  FOR claim IN SELECT value FROM jsonb_path_query(p_report, 'strict $.** ? (@.verification == "verified")') value LOOP
    FOR cap IN SELECT value FROM jsonb_array_elements(claim->'capabilityIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.capability_evidence ce JOIN public.analysis_run_evidence re ON re.evidence_id = ce.evidence_id
          WHERE re.run_id = r.id AND ce.taxonomy_id = tid AND ce.taxonomy_version = tv AND ce.capability_id = cap#>>'{}'
            AND claim->'evidenceIds' ? ce.evidence_id::text)
        AND NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_support ags JOIN public.analysis_run_evidence re ON re.run_id=ags.run_id AND re.evidence_id=ags.evidence_id
          WHERE ags.run_id=r.id AND ags.capability_id=cap#>>'{}' AND ags.taxonomy_id=tid AND ags.taxonomy_version=tv AND claim->'evidenceIds' ? ags.evidence_id::text) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.readiness_reports(id, run_id, job_id, user_id, contract_version, visibility, payload)
    VALUES (rid, r.id, j.id, p_actor, '1.0.0', 'owner_only', p_report);
  INSERT INTO public.report_evidence_citations(report_id, run_id, evidence_id)
    SELECT DISTINCT rid, r.id, (value#>>'{}')::uuid FROM jsonb_path_query(p_report, 'strict $.** ? (exists (@.evidenceIds)).evidenceIds[*]') AS nodes(value);
  INSERT INTO public.report_capability_mentions(report_id, run_id, taxonomy_id, taxonomy_version, capability_id)
    SELECT DISTINCT rid, r.id, tid, tv, value#>>'{}' FROM (
      SELECT value FROM jsonb_path_query(p_report, 'strict $.** ? (exists (@.capabilityIds)).capabilityIds[*]') AS nodes(value)
      UNION SELECT value FROM jsonb_path_query(p_report, 'strict $.** ? (exists (@.capabilityId)).capabilityId') AS nodes(value)
    ) refs;
  FOR item IN SELECT value FROM jsonb_path_query(p_report, 'strict $.** ? (exists (@.permittedLocations)).permittedLocations[*]') AS nodes(value) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots WHERE run_id = r.id AND snapshot_id = (item->>'snapshotId')::uuid) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  END LOOP;
  UPDATE public.analysis_run_status SET status = 'completed', finished_at = clock_timestamp() WHERE run_id = r.id;
  UPDATE public.analysis_job_attempts SET status = 'completed', finished_at = clock_timestamp() WHERE job_id=j.id AND status='running';
  UPDATE public.analysis_jobs SET status = 'completed', stage = CASE WHEN EXISTS(SELECT 1 FROM feature_one_private.analysis_execution WHERE job_id=j.id) THEN 'completed' ELSE 'cleanup' END, finished_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = j.id;
  INSERT INTO public.audit_events(actor_id, job_id, action, object_type, object_id, request_id, safe_metadata)
    VALUES (p_actor, j.id, 'report_completed', 'report', rid, p_request_id, jsonb_build_object('evidence_count', jsonb_array_length(p_report->'evidence')));
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.feature_one_job_synthesis(p_job uuid,p_token uuid,p_hash text,p_draft jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; m feature_one_private.analysis_synthesis; rid uuid;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT id INTO rid FROM public.analysis_runs WHERE job_id=p_job;
  IF rid IS NULL THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  SELECT * INTO m FROM feature_one_private.analysis_synthesis WHERE job_id=p_job;
  IF FOUND THEN
    IF m.input_hash<>p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    IF m.draft IS NOT NULL THEN RETURN jsonb_build_object('state','ready','draft',m.draft); END IF;
    IF p_draft IS NULL THEN
      IF q.policy#>>'{versions,synthesis,prompt,id}'='bounded_narrative' AND NOT EXISTS(SELECT 1 FROM public.model_runs WHERE job_id=p_job AND (request_state IN ('reserved','unknown','succeeded') OR validation_status='invalid')) THEN
        RETURN jsonb_build_object('state','reserved');
      END IF;
      RETURN jsonb_build_object('state','uncertain');
    END IF;
  ELSE
    IF p_draft IS NOT NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    INSERT INTO feature_one_private.analysis_synthesis(job_id,input_hash) VALUES(p_job,p_hash);
    RETURN jsonb_build_object('state','reserved');
  END IF;
  IF p_draft->>'jobId' IS DISTINCT FROM p_job::text OR p_draft->>'analysisRunId' IS DISTINCT FROM rid::text
    OR p_draft->'versions' IS DISTINCT FROM q.policy->'versions' THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  IF q.policy#>>'{versions,synthesis,prompt,id}'='bounded_narrative' THEN
    PERFORM public.feature_one_job_narrative_validate(p_job,p_token,p_draft);
  END IF;
  UPDATE feature_one_private.analysis_synthesis SET draft=p_draft WHERE job_id=p_job;
  RETURN jsonb_build_object('state','ready','draft',p_draft);
END $$;

DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['narrative_policies','model_budget_charges'] LOOP
    EXECUTE format('ALTER TABLE feature_one_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON feature_one_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'feature_one_job_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA feature_one_private FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.model_runs IS 'Run 12 immutable terminal outcomes; no raw request/response/error body. Invalid content has zero retention. Owner export/deletion includes these source-free records.';

CREATE OR REPLACE FUNCTION public.feature_one_prune_retention() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.feature_one_prune_retention_before_selection();
  DELETE FROM feature_one_private.github_webhook_receipts WHERE received_at<now()-interval '90 days';
  DELETE FROM feature_one_private.repository_selection_requests WHERE created_at<now()-interval '90 days';
  DELETE FROM feature_one_private.model_budget_charges WHERE created_at<now()-interval '30 days';
END $$;
