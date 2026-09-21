-- Run 15. Feedback is separate from immutable findings. No email/model hooks.
-- Separate clock_timestamp() expressions can straddle a millisecond and PostgreSQL
-- need not evaluate SET targets in textual order. A terminal write includes its
-- finish time in updated_at; retain every existing transition/immutability guard.
CREATE OR REPLACE FUNCTION feature_one_private.job_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF to_jsonb(OLD)-ARRAY['status','stage','failure_code','updated_at','finished_at'] IS DISTINCT FROM to_jsonb(NEW)-ARRAY['status','stage','failure_code','updated_at','finished_at']
    OR OLD.status IN ('completed','failed','canceled','expired')
    OR (OLD.status='queued' AND NEW.status NOT IN ('queued','running','failed','canceled','expired'))
    OR (OLD.status='running' AND NEW.status NOT IN ('running','completed','failed','canceled','expired','queued'))
    OR (OLD.status='running' AND NEW.status='queued' AND NOT EXISTS(SELECT 1 FROM feature_one_private.analysis_execution WHERE job_id=OLD.id))
  THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF NEW.finished_at IS NOT NULL THEN NEW.updated_at:=greatest(NEW.updated_at,NEW.finished_at); END IF;
  RETURN NEW;
END $$;
CREATE TABLE feature_one_private.finding_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.readiness_reports(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('capability','claim','evidence','improvement')), finding_id text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('accurate','inaccurate','unclear','irrelevant')),
  comment text NOT NULL CHECK(length(comment)<=1000), revision int NOT NULL CHECK(revision>0),
  disposition text NOT NULL DEFAULT 'open' CHECK(disposition IN ('open','needs_reproduction','confirmed_issue','not_reproduced','resolved','duplicate')),
  review_revision int NOT NULL DEFAULT 0, review_note text, benchmark_case text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(report_id,kind,finding_id,user_id)
);
CREATE INDEX finding_feedback_queue ON feature_one_private.finding_feedback(id);
CREATE TABLE feature_one_private.finding_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), feedback_id uuid NOT NULL REFERENCES feature_one_private.finding_feedback(id) ON DELETE CASCADE,
  revision int NOT NULL, classification text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE feature_one_private.finding_feedback_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, key text NOT NULL, hash feature_one_private.digest NOT NULL,
  feedback_id uuid REFERENCES feature_one_private.finding_feedback(id) ON DELETE SET NULL, PRIMARY KEY(user_id,key)
);
CREATE TABLE feature_one_private.finding_reviewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, active boolean NOT NULL DEFAULT false
);
CREATE TABLE feature_one_private.finding_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), feedback_id uuid NOT NULL REFERENCES feature_one_private.finding_feedback(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, feedback_revision int NOT NULL, review_revision int NOT NULL,
  disposition text NOT NULL, note text NOT NULL, benchmark_case text, request_key text NOT NULL, request_hash feature_one_private.digest NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(reviewer_id,request_key)
);
CREATE FUNCTION feature_one_private.feedback_json(f feature_one_private.finding_feedback) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',f.id,'reportId',f.report_id,'finding',jsonb_build_object('kind',f.kind,'id',f.finding_id),
    'classification',f.classification,'comment',f.comment,'revision',f.revision,'updatedAt',to_char(f.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'disposition',f.disposition);
$$;
CREATE FUNCTION feature_one_private.require_finding(p_actor uuid,p_report uuid,p_kind text,p_finding text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.readiness_reports; found_finding boolean:=false;
BEGIN
  SELECT * INTO r FROM public.readiness_reports WHERE id=p_report AND user_id=p_actor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_kind='capability' THEN SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'capabilityGroups') g CROSS JOIN LATERAL jsonb_array_elements(g->'capabilities') c WHERE c->>'capabilityId'=p_finding) INTO found_finding;
  ELSIF p_kind='claim' THEN SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'claims') c WHERE c->>'claimId'=p_finding) INTO found_finding;
  ELSIF p_kind='improvement' THEN SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'improvements') c WHERE c->>'improvementId'=p_finding) INTO found_finding;
  ELSIF p_kind='evidence' THEN SELECT EXISTS(SELECT 1 FROM feature_one_private.report_evidence_membership(p_actor,r.run_id) m WHERE m.evidence_id::text=p_finding) INTO found_finding;
  END IF;
  IF NOT found_finding THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END $$;
CREATE FUNCTION public.feature_one_finding_feedback(p_actor uuid,p_report uuid,p_kind text,p_finding text,p_change jsonb DEFAULT NULL,p_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f feature_one_private.finding_feedback; prior feature_one_private.finding_feedback_requests;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('finding-feedback:'||p_actor::text,0));
  PERFORM feature_one_private.require_finding(p_actor,p_report,p_kind,p_finding);
  IF p_change IS NOT NULL THEN
    SELECT * INTO prior FROM feature_one_private.finding_feedback_requests WHERE user_id=p_actor AND key=p_change->>'idempotencyKey';
    IF FOUND THEN
      IF prior.hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
      SELECT * INTO f FROM feature_one_private.finding_feedback WHERE id=prior.feedback_id AND user_id=p_actor;
      IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
      RETURN feature_one_private.feedback_json(f);
    END IF;
  END IF;
  SELECT * INTO f FROM feature_one_private.finding_feedback WHERE report_id=p_report AND user_id=p_actor AND kind=p_kind AND finding_id=p_finding FOR UPDATE;
  IF p_change IS NULL THEN RETURN CASE WHEN f.id IS NULL THEN NULL ELSE feature_one_private.feedback_json(f) END; END IF;
  IF p_change-ARRAY['classification','comment','expectedRevision','idempotencyKey']<>'{}' OR p_change->>'classification' NOT IN ('accurate','inaccurate','unclear','irrelevant')
    OR jsonb_typeof(p_change->'comment') IS DISTINCT FROM 'string' OR length(p_change->>'comment')>1000
    OR coalesce(length(p_change->>'idempotencyKey'),0) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF (p_change->>'expectedRevision')::int IS DISTINCT FROM coalesce(f.revision,0) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  INSERT INTO feature_one_private.finding_feedback(user_id,report_id,kind,finding_id,classification,comment,revision)
    VALUES(p_actor,p_report,p_kind,p_finding,p_change->>'classification',p_change->>'comment',1)
    ON CONFLICT(report_id,kind,finding_id,user_id) DO UPDATE SET classification=EXCLUDED.classification,comment=EXCLUDED.comment,
      revision=finding_feedback.revision+1,disposition='open',review_note=NULL,benchmark_case=NULL,updated_at=clock_timestamp() RETURNING * INTO f;
  INSERT INTO feature_one_private.finding_feedback_events(feedback_id,revision,classification) VALUES(f.id,f.revision,f.classification);
  INSERT INTO feature_one_private.finding_feedback_requests VALUES(p_actor,p_change->>'idempotencyKey',p_hash,f.id);
  RETURN feature_one_private.feedback_json(f);
END $$;
CREATE FUNCTION feature_one_private.review_json(f feature_one_private.finding_feedback) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',f.id,'kind',f.kind,'classification',f.classification,'revision',f.revision,'reviewRevision',f.review_revision,
    'updatedAt',to_char(f.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'disposition',f.disposition,'note',f.review_note,'benchmarkCase',f.benchmark_case,
    'detector',CASE WHEN f.kind='evidence' THEN (SELECT e.observation->'detector' FROM public.evidence_items e WHERE e.id::text=f.finding_id) ELSE NULL END);
$$;
CREATE FUNCTION public.feature_one_finding_review(p_reviewer uuid,p_query jsonb DEFAULT '{}',p_feedback uuid DEFAULT NULL,p_change jsonb DEFAULT NULL,p_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f feature_one_private.finding_feedback; prior feature_one_private.finding_reviews; items jsonb; n int:=coalesce((p_query->>'limit')::int,20);
BEGIN
  PERFORM 1 FROM feature_one_private.finding_reviewers WHERE user_id=p_reviewer AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_feedback IS NULL THEN
    IF n NOT BETWEEN 1 AND 50 OR p_query-ARRAY['limit','afterId','disposition']<>'{}' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    SELECT coalesce(jsonb_agg(item ORDER BY id),'[]') INTO items FROM (SELECT queued.id,feature_one_private.review_json(queued) item FROM feature_one_private.finding_feedback queued
      WHERE (NOT p_query ? 'afterId' OR queued.id>(p_query->>'afterId')::uuid) AND (NOT p_query ? 'disposition' OR queued.disposition=p_query->>'disposition') ORDER BY queued.id LIMIT n+1) page;
    RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(items)>n THEN items-n ELSE items END,'nextId',CASE WHEN jsonb_array_length(items)>n THEN items#>>ARRAY[(n-1)::text,'id'] ELSE NULL END);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('finding-review:'||p_reviewer::text,0));
  SELECT * INTO prior FROM feature_one_private.finding_reviews WHERE reviewer_id=p_reviewer AND request_key=p_change->>'idempotencyKey';
  IF FOUND AND (prior.request_hash IS DISTINCT FROM p_hash OR prior.feedback_id<>p_feedback) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  SELECT * INTO f FROM feature_one_private.finding_feedback WHERE id=p_feedback FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF prior.id IS NOT NULL THEN RETURN feature_one_private.review_json(f); END IF;
  IF p_change-ARRAY['expectedRevision','expectedReviewRevision','disposition','note','benchmarkCase','idempotencyKey']<>'{}'
    OR coalesce(p_change->>'disposition','') NOT IN ('open','needs_reproduction','confirmed_issue','not_reproduced','resolved','duplicate')
    OR coalesce(p_change->>'note','') NOT IN ('needs_fixture','reproduced_synthetic','not_reproduced','coverage_limitation','wording_issue','duplicate','requires_authorization')
    OR p_change->>'benchmarkCase' IS NOT NULL AND p_change->>'benchmarkCase' NOT IN ('run15.fork','run15.template','run15.bulk','run15.identities','run15.unknown','run15.generated')
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF (p_change->>'expectedRevision')::int IS DISTINCT FROM f.revision OR (p_change->>'expectedReviewRevision')::int IS DISTINCT FROM f.review_revision THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  UPDATE feature_one_private.finding_feedback SET disposition=p_change->>'disposition',review_revision=review_revision+1,review_note=p_change->>'note',benchmark_case=p_change->>'benchmarkCase' WHERE id=f.id RETURNING * INTO f;
  INSERT INTO feature_one_private.finding_reviews(feedback_id,reviewer_id,feedback_revision,review_revision,disposition,note,benchmark_case,request_key,request_hash)
    VALUES(f.id,p_reviewer,f.revision,f.review_revision,f.disposition,f.review_note,f.benchmark_case,p_change->>'idempotencyKey',p_hash);
  RETURN feature_one_private.review_json(f);
END $$;
CREATE FUNCTION public.feature_one_feedback_prune() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n int; BEGIN DELETE FROM feature_one_private.finding_feedback WHERE updated_at<now()-interval '180 days'; GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;

CREATE TABLE feature_one_private.analysis_provenance (
  run_id uuid PRIMARY KEY, user_id uuid NOT NULL, job_id uuid NOT NULL, payload jsonb NOT NULL CHECK(octet_length(payload::text)<=65536),
  FOREIGN KEY(run_id,user_id,job_id) REFERENCES public.analysis_runs(id,user_id,job_id) ON DELETE CASCADE
);
CREATE TRIGGER immutable_analysis_provenance BEFORE UPDATE ON feature_one_private.analysis_provenance FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
INSERT INTO feature_one_private.aggregation_policies SELECT id,'1.1.0',definition||'{"version":"1.1.0","provenance":"context_only_v1"}'::jsonb FROM feature_one_private.aggregation_policies WHERE id='evidence_aggregation' AND version='1.0.0';

CREATE FUNCTION public.feature_one_job_provenance_context(p_job uuid,p_token uuid,p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; prior jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions#>>'{aggregationPolicy,version}'<>'1.1.0' THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  SELECT payload INTO prior FROM feature_one_private.analysis_provenance WHERE run_id=r.id;
  RETURN jsonb_build_object('prior',prior,'snapshots',(SELECT jsonb_agg(jsonb_build_object('snapshotId',s.id,'repositoryId',s.repository_id,'commitSha',s.commit_sha,
    'providerRepositoryId',repo.provider_repository_id,'visibility',s.visibility,'accountId',g.github_account_id,'installationId',g.installation_id,
    'totalFiles',(s.inventory_summary->>'totalFiles')::int,'exclusions',s.inventory_summary#>'{structural,exclusions}','generatedMarked',coalesce((s.coverage#>>'{implementation,generatedFiles}')::int,0),
    'history',(SELECT value FROM jsonb_array_elements(s.coverage#>'{structural,metadata}') WHERE value->>'source'='commits'),
    'commits',(SELECT coalesce(jsonb_agg(jsonb_build_object('match',e.observation#>>'{structural,provider,authorMatch}','relationship',e.observation#>>'{structural,provider,relationship}','parents',e.observation#>'{structural,counts,parents}')),'[]')
      FROM public.evidence_items e WHERE e.snapshot_id=s.id AND e.observation#>>'{structural,kind}'='commit')) ORDER BY s.id)
    FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id JOIN public.repositories repo ON repo.id=s.repository_id JOIN public.repository_access_grants g ON g.id=rs.grant_id WHERE rs.run_id=r.id));
END $$;
CREATE FUNCTION public.feature_one_job_provenance_store(p_job uuid,p_token uuid,p_run uuid,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.analysis_runs; item jsonb; prior jsonb; context jsonb; source jsonb; expected_history jsonb; expected_files jsonb; expected_signals jsonb;
  records int; connected int; others int; unlinked int; history_state text; only_root boolean;
BEGIN
  PERFORM feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions#>>'{aggregationPolicy,version}'<>'1.1.0' OR p_result->'policy' IS DISTINCT FROM '{"id":"provenance_context","version":"1.0.0"}'::jsonb
    OR jsonb_typeof(p_result->'snapshots') IS DISTINCT FROM 'array'
    OR p_result-ARRAY['policy','snapshots']<>'{}' OR jsonb_array_length(p_result->'snapshots')<>(SELECT count(*) FROM public.analysis_run_snapshots WHERE run_id=r.id)
    OR jsonb_array_length(p_result->'snapshots')<>(SELECT count(DISTINCT value->>'snapshotId') FROM jsonb_array_elements(p_result->'snapshots')) THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  context:=public.feature_one_job_provenance_context(p_job,p_token,p_run);
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'snapshots') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id WHERE rs.run_id=r.id AND s.id::text=item->>'snapshotId' AND s.repository_id::text=item->>'repositoryId' AND s.commit_sha=item->>'commitSha')
      OR item->'contribution' IS DISTINCT FROM '{"state":"unknown","confidence":null,"strengthModifier":null,"confidenceModifier":null,"basis":"context_only_uncalibrated"}'::jsonb THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
    IF item-ARRAY['snapshotId','repositoryId','commitSha','detector','observedAt','provider','history','files','signals','limitations','contribution']<>'{}'
      OR item->'detector' IS DISTINCT FROM '{"id":"provenance_context","version":"1.0.0"}'::jsonb
      OR coalesce(item->>'observedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'
      OR jsonb_typeof(item->'provider') IS DISTINCT FROM 'object'
      OR (item->'provider')-ARRAY['state','fork','templateOrigin','relationship']<>'{}'
      OR coalesce(item#>>'{provider,state}','') NOT IN ('available','unavailable')
      OR coalesce(item#>>'{provider,templateOrigin}','') NOT IN ('declared','unknown')
      OR item#>>'{provider,relationship}' IS DISTINCT FROM 'current_repository_context'
      OR coalesce(jsonb_typeof(item#>'{provider,fork}'),'') NOT IN ('boolean','null')
      OR item#>>'{provider,state}'='unavailable' AND (item#>'{provider,fork}' IS DISTINCT FROM 'null'::jsonb OR item#>>'{provider,templateOrigin}'<>'unknown')
      OR item->'limitations' IS DISTINCT FROM '["not_authorship","not_legal_ownership","not_ai_detection","not_skill","no_numeric_modifier","history_bounded","squash_or_import_possible","provider_context_current","file_classification_heuristic","identity_association_only"]'::jsonb
      THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
    PERFORM (item->>'observedAt')::timestamptz;
    SELECT value INTO source FROM jsonb_array_elements(context->'snapshots') WHERE value->>'snapshotId'=item->>'snapshotId';
    SELECT count(*)::int,count(*) FILTER(WHERE value->>'match'='connected_identity')::int,count(*) FILTER(WHERE value->>'match'='other_identity')::int,
      count(*) FILTER(WHERE value->>'match' IS NULL OR value->>'match'='unavailable')::int INTO records,connected,others,unlinked FROM jsonb_array_elements(source->'commits');
    history_state:=coalesce(source#>>'{history,state}','not_requested');
    only_root:=coalesce(history_state='available' AND source#>>'{history,records}'='1' AND records=1 AND source#>>'{commits,0,parents}'='0' AND source#>>'{commits,0,relationship}'='exact_commit',false);
    IF source#>>'{history,records}' IS NOT NULL AND (source#>>'{history,records}')::int<>records THEN history_state:='truncated'; END IF;
    expected_history:=jsonb_build_object('state',history_state,'records',records,'linkedToConnected',connected,'linkedToOthers',others,'unlinked',unlinked,'headIsOnlyRoot',only_root,'relationship','pinned_head_and_bounded_ancestors');
    expected_files:=jsonb_build_object('total',(source->>'totalFiles')::int,'generatedExcluded',coalesce((source#>>'{exclusions,generated}')::int,0),'generatedMarked',(source->>'generatedMarked')::int,'vendorExcluded',coalesce((source#>>'{exclusions,dependency}')::int,0));
    expected_signals:=to_jsonb(array_remove(ARRAY[
      CASE WHEN item#>>'{provider,fork}'='true' THEN 'provider_fork' END,
      CASE WHEN item#>>'{provider,templateOrigin}'='declared' THEN 'provider_template_origin' END,
      CASE WHEN (expected_files->>'generatedExcluded')::int>0 OR (expected_files->>'generatedMarked')::int>0 THEN 'generated_files' END,
      CASE WHEN (expected_files->>'vendorExcluded')::int>0 THEN 'vendor_files' END,
      CASE WHEN only_root AND (expected_files->>'total')::int>=100 THEN 'possible_bulk_initial_commit' END,
      CASE WHEN history_state='truncated' OR records<=1 THEN 'limited_history' END,
      CASE WHEN connected>0 AND others>0 THEN 'multiple_linked_identities' END,
      CASE WHEN connected>0 THEN 'connected_identity_association' END,
      CASE WHEN others>0 THEN 'other_identity_association' END,
      CASE WHEN unlinked>0 THEN 'unlinked_commit_author' END,
      CASE WHEN history_state NOT IN ('available','truncated') THEN 'history_unavailable' END],NULL));
    IF item->'history' IS DISTINCT FROM expected_history OR item->'files' IS DISTINCT FROM expected_files OR item->'signals' IS DISTINCT FROM expected_signals
      THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  END LOOP;
  SELECT payload INTO prior FROM feature_one_private.analysis_provenance WHERE run_id=r.id;
  IF FOUND THEN IF prior IS DISTINCT FROM p_result THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF; RETURN prior; END IF;
  INSERT INTO feature_one_private.analysis_provenance VALUES(r.id,r.user_id,p_job,p_result); RETURN p_result;
END $$;

-- The 1.0.0 arithmetic is retained; 1.1.0 adds separately frozen context only.
CREATE OR REPLACE FUNCTION public.feature_one_job_aggregation_input(p_job uuid,p_token uuid,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; catalog jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions IS DISTINCT FROM q.policy->'versions' OR NOT (r.versions->'aggregationPolicy' IN ('{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"1.1.0"}'::jsonb)) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
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
      FROM public.evidence_items e JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=e.snapshot_id WHERE rs.run_id=r.id)) || CASE WHEN r.versions#>>'{aggregationPolicy,version}'='1.1.0' THEN jsonb_build_object('provenance',(SELECT payload FROM feature_one_private.analysis_provenance WHERE run_id=r.id)) ELSE '{}'::jsonb END;
END $$;
CREATE OR REPLACE FUNCTION public.feature_one_job_aggregation_store(p_job uuid,p_token uuid,p_run uuid,p_result jsonb)
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
    OR NOT (p_result->'policy' IN ('{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"1.1.0"}'::jsonb)) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_policies WHERE id=p_result#>>'{policy,id}' AND version=p_result#>>'{policy,version}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  IF p_result#>>'{policy,version}'='1.1.0' THEN
    IF p_result->'provenance' IS NULL OR p_result->'provenance' IS DISTINCT FROM (SELECT payload FROM feature_one_private.analysis_provenance WHERE run_id=r.id) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  ELSIF p_result ? 'provenance' THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
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
    IF cap->'provenance' IS DISTINCT FROM jsonb_build_object('state','unknown','value',NULL,'policy',CASE WHEN p_result#>>'{policy,version}'='1.1.0' THEN 'context_only_v1' ELSE 'not_inferred_v1' END) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
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

CREATE FUNCTION public.feature_one_export_v8(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.feature_one_export_v7(p_actor)||jsonb_build_object(
    'findingFeedback',(SELECT coalesce(jsonb_agg(feature_one_private.feedback_json(f)),'[]') FROM feature_one_private.finding_feedback f WHERE user_id=p_actor),
    'findingFeedbackHistory',(SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM feature_one_private.finding_feedback_events e JOIN feature_one_private.finding_feedback f ON f.id=e.feedback_id WHERE f.user_id=p_actor),
    'findingReviews',(SELECT coalesce(jsonb_agg(to_jsonb(r)-ARRAY['reviewer_id','request_key','request_hash']),'[]') FROM feature_one_private.finding_reviews r JOIN feature_one_private.finding_feedback f ON f.id=r.feedback_id WHERE f.user_id=p_actor),
    'provenance',(SELECT coalesce(jsonb_agg(payload),'[]') FROM feature_one_private.analysis_provenance WHERE user_id=p_actor));
$$;
DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['finding_feedback','finding_feedback_events','finding_feedback_requests','finding_reviewers','finding_reviews','analysis_provenance'] LOOP
    EXECUTE format('ALTER TABLE feature_one_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON feature_one_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('feature_one_finding_feedback','feature_one_finding_review','feature_one_feedback_prune','feature_one_job_provenance_context','feature_one_job_provenance_store','feature_one_export_v8') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
  REVOKE ALL ON FUNCTION feature_one_private.feedback_json(feature_one_private.finding_feedback),feature_one_private.review_json(feature_one_private.finding_feedback),feature_one_private.require_finding(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
END $$;
NOTIFY pgrst,'reload schema';
