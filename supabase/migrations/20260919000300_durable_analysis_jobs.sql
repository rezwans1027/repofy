-- Run 07. Additive queue/settlement boundary; no production entitlement or price is enabled.
ALTER TABLE public.analysis_jobs DROP CONSTRAINT analysis_jobs_status_check;
ALTER TABLE public.analysis_jobs ADD CHECK(status IN ('queued','running','completed','failed','canceled','expired'));
ALTER TABLE public.analysis_jobs DROP CONSTRAINT analysis_jobs_stage_check;
ALTER TABLE public.analysis_jobs ADD CHECK(stage IN ('authorization','snapshot','security_filtering','inventory','extraction','metadata','aggregation','role_mapping','synthesis','validation','publication','cleanup',
  'queued','acquiring_access','downloading','inventorying','extracting','aggregating','synthesizing','validating','completed'));
ALTER TABLE public.analysis_jobs DROP CONSTRAINT analysis_jobs_check;
ALTER TABLE public.analysis_jobs ADD CHECK((status IN ('completed','failed','canceled','expired')) = (finished_at IS NOT NULL));
CREATE TABLE feature_one_private.analysis_execution (
  job_id uuid PRIMARY KEY REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  policy jsonb NOT NULL CHECK(policy->>'workflow'='durable-analysis-1.0.0' AND policy->>'failurePolicy'='fail_all_v1'),
  revisions jsonb NOT NULL, attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
  current_attempt uuid REFERENCES public.analysis_job_attempts(id) ON DELETE SET NULL,
  lease_token uuid, lease_until timestamptz, attempt_deadline timestamptz,
  deadline timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((lease_token IS NULL)=(lease_until IS NULL))
);
CREATE INDEX analysis_queue_due ON feature_one_private.analysis_execution(available_at,job_id);
CREATE TABLE feature_one_private.analysis_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, key text NOT NULL,
  request_hash feature_one_private.digest NOT NULL,
  job_id uuid REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  PRIMARY KEY(user_id,key)
);
-- Separate analysis wallet. Only disposable tests seed nonzero units. No advisor wallet access.
CREATE TABLE feature_one_private.analysis_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, units integer NOT NULL CHECK(units>=0)
);
CREATE TABLE feature_one_private.analysis_settlements (
  job_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy text NOT NULL CHECK(policy IN ('internal_free_v1','test_units_v1')),
  units integer NOT NULL CHECK(units BETWEEN 0 AND 1), state text NOT NULL CHECK(state IN ('reserved','settled','refunded')),
  CHECK((policy='internal_free_v1')=(units=0))
);
CREATE TABLE feature_one_private.analysis_ledger (
  job_id uuid NOT NULL REFERENCES feature_one_private.analysis_settlements(job_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('reserve','settle','refund')), units integer NOT NULL CHECK(units BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(job_id,kind)
);
CREATE TABLE feature_one_private.analysis_snapshot_outputs (
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL, snapshot_id uuid NOT NULL REFERENCES public.repository_snapshots(id),
  PRIMARY KEY(job_id,repository_id)
);
CREATE TABLE feature_one_private.analysis_synthesis (
  job_id uuid PRIMARY KEY REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  input_hash feature_one_private.digest NOT NULL, draft jsonb,
  CHECK(draft IS NULL OR (jsonb_typeof(draft)='object' AND octet_length(draft::text)<=2097152))
);
CREATE TRIGGER immutable_analysis_snapshot_output BEFORE UPDATE ON feature_one_private.analysis_snapshot_outputs FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();

CREATE OR REPLACE FUNCTION feature_one_private.job_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF to_jsonb(OLD)-ARRAY['status','stage','failure_code','updated_at','finished_at'] IS DISTINCT FROM to_jsonb(NEW)-ARRAY['status','stage','failure_code','updated_at','finished_at']
    OR OLD.status IN ('completed','failed','canceled','expired')
    OR (OLD.status='queued' AND NEW.status NOT IN ('queued','running','failed','canceled','expired'))
    OR (OLD.status='running' AND NEW.status NOT IN ('running','completed','failed','canceled','expired','queued'))
    OR (OLD.status='running' AND NEW.status='queued' AND NOT EXISTS(SELECT 1 FROM feature_one_private.analysis_execution WHERE job_id=OLD.id))
  THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION feature_one_private.analysis_access(p_job uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE j public.analysis_jobs; g public.repository_access_grants; item record; q feature_one_private.analysis_execution;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=p_job;
  FOR item IN SELECT * FROM public.analysis_job_grants WHERE job_id=p_job ORDER BY grant_id LOOP
    BEGIN g := feature_one_private.require_grant(j.user_id,item.grant_id);
    EXCEPTION WHEN raise_exception THEN RAISE EXCEPTION 'REPOSITORY_ACCESS_REVOKED'; END;
    IF q.revisions->>g.id::text IS DISTINCT FROM g.access_revision::text THEN RAISE EXCEPTION 'REPOSITORY_ACCESS_REVOKED'; END IF;
    IF NOT g.attestation_confirmed AND EXISTS(SELECT 1 FROM public.repositories r JOIN public.github_installations i ON i.id=g.installation_id
      WHERE r.id=g.repository_id AND (r.visibility='private' OR i.owner_type='Organization')) THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
  END LOOP;
END $$;
CREATE FUNCTION feature_one_private.analysis_fence(p_job uuid,p_token uuid) RETURNS feature_one_private.analysis_execution LANGUAGE plpgsql SET search_path='' AS $$
DECLARE j public.analysis_jobs; q feature_one_private.analysis_execution;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job FOR UPDATE;
  SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=p_job FOR UPDATE;
  IF j.id IS NULL OR j.status<>'running' OR q.lease_token IS DISTINCT FROM p_token OR p_token IS NULL
    OR q.lease_until<=clock_timestamp() OR q.attempt_deadline<=clock_timestamp() OR q.deadline<=clock_timestamp() THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  PERFORM feature_one_private.analysis_access(p_job);
  RETURN q;
END $$;
CREATE FUNCTION feature_one_private.require_analysis_fence(p_job uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM feature_one_private.analysis_execution WHERE job_id=p_job) THEN
    PERFORM feature_one_private.analysis_fence(p_job,nullif(current_setting('feature_one.worker_token',true),'')::uuid);
  END IF;
END $$;
CREATE FUNCTION feature_one_private.analysis_settle(p_job uuid,p_success boolean) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s feature_one_private.analysis_settlements;
BEGIN
  SELECT * INTO s FROM feature_one_private.analysis_settlements WHERE job_id=p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF s.state='refunded' AND p_success THEN RAISE EXCEPTION 'RETRY_NOT_ALLOWED'; END IF;
  IF s.state<>'reserved' THEN RETURN; END IF;
  IF NOT p_success AND s.units>0 THEN UPDATE feature_one_private.analysis_wallets SET units=units+s.units WHERE user_id=s.user_id; END IF;
  UPDATE feature_one_private.analysis_settlements SET state=CASE WHEN p_success THEN 'settled' ELSE 'refunded' END WHERE job_id=p_job;
  INSERT INTO feature_one_private.analysis_ledger(job_id,kind,units) VALUES(p_job,CASE WHEN p_success THEN 'settle' ELSE 'refund' END,s.units);
END $$;
-- Covers legacy cancel/delete paths too. FK cascade on account deletion removes wallet and ledger.
CREATE FUNCTION feature_one_private.analysis_terminal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN PERFORM feature_one_private.analysis_settle(OLD.id,false); RETURN OLD; END IF;
  IF NEW.status IN ('completed','failed','canceled','expired') THEN
    PERFORM feature_one_private.analysis_settle(NEW.id,NEW.status='completed');
    UPDATE feature_one_private.analysis_execution SET lease_token=NULL,lease_until=NULL WHERE job_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER analysis_terminal_settlement AFTER UPDATE ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION feature_one_private.analysis_terminal();
CREATE TRIGGER analysis_delete_settlement BEFORE DELETE ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION feature_one_private.analysis_terminal();

CREATE FUNCTION public.feature_one_job_start(p_actor uuid,p_request jsonb,p_hash text,p_policy jsonb,p_limit integer,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE jid uuid; prior feature_one_private.analysis_requests; ids uuid[]; revisions jsonb; n integer; v_units integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('analysis-owner:'||p_actor::text,0));
  SELECT * INTO prior FROM feature_one_private.analysis_requests WHERE user_id=p_actor AND key=p_request->>'idempotencyKey';
  IF FOUND THEN
    IF prior.request_hash<>p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    IF prior.job_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    RETURN prior.job_id;
  END IF;
  IF p_request->>'failurePolicy' IS DISTINCT FROM 'fail_all_v1' OR p_policy->>'workflow' IS DISTINCT FROM 'durable-analysis-1.0.0'
    OR p_policy->>'failurePolicy' IS DISTINCT FROM 'fail_all_v1' OR p_policy->>'billing' NOT IN ('internal_free_v1','test_units_v1')
    OR p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  n := jsonb_array_length(p_request->'repositoryIds');
  IF n NOT BETWEEN 1 AND p_limit OR n<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_request->'repositoryIds')) THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF (SELECT count(*) FROM public.analysis_jobs WHERE user_id=p_actor AND status IN ('queued','running'))>=2 THEN RAISE EXCEPTION 'ANALYSIS_ALREADY_RUNNING'; END IF;
  SELECT array_agg(g.id ORDER BY g.id),jsonb_object_agg(g.id::text,g.access_revision::text) INTO ids,revisions
    FROM feature_one_private.repository_selection_items s JOIN public.repository_access_grants g ON g.id=s.grant_id
    WHERE s.user_id=p_actor AND p_request->'repositoryIds' ? s.repository_id::text;
  IF cardinality(ids) IS DISTINCT FROM n THEN RAISE EXCEPTION 'REPOSITORY_ACCESS_REVOKED'; END IF;
  jid := public.feature_one_create_job(p_actor,p_request,p_hash,ids,p_request_id);
  INSERT INTO feature_one_private.analysis_execution(job_id,policy,revisions) VALUES(jid,p_policy,revisions);
  PERFORM feature_one_private.analysis_access(jid);
  v_units := CASE WHEN p_policy->>'billing'='test_units_v1' THEN 1 ELSE 0 END;
  IF v_units>0 THEN
    UPDATE feature_one_private.analysis_wallets SET units=units-1 WHERE user_id=p_actor AND units>0;
    IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  END IF;
  INSERT INTO feature_one_private.analysis_settlements(job_id,user_id,policy,units,state) VALUES(jid,p_actor,p_policy->>'billing',v_units,'reserved');
  INSERT INTO feature_one_private.analysis_ledger(job_id,kind,units) VALUES(jid,'reserve',v_units);
  INSERT INTO feature_one_private.analysis_requests VALUES(p_actor,p_request->>'idempotencyKey',p_hash,jid);
  UPDATE public.analysis_jobs SET stage='queued' WHERE id=jid;
  RETURN jid;
END $$;

CREATE FUNCTION public.feature_one_job_read(p_actor uuid,p_job uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs; a public.analysis_job_attempts; rid uuid; report uuid; result jsonb; attempt jsonb;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job AND user_id=p_actor;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.analysis_job_attempts WHERE job_id=p_job ORDER BY number DESC LIMIT 1;
  attempt := CASE WHEN a.id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('attemptId',a.id,'number',a.number,'startedAt',to_char(a.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) END;
  SELECT id INTO rid FROM public.analysis_runs WHERE job_id=p_job ORDER BY created_at LIMIT 1;
  result := jsonb_build_object('contractVersion','1.0.0','jobId',j.id,'status',j.status,'stage',j.stage,'createdAt',to_char(j.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(j.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'attempt',attempt);
  IF j.status IN ('queued','running') THEN result := result||jsonb_build_object('progress',jsonb_build_object('kind','indeterminate','stage',j.stage)); END IF;
  IF j.status='running' THEN result := result||jsonb_build_object('analysisRunId',rid); END IF;
  IF j.finished_at IS NOT NULL THEN result := result||jsonb_build_object('finishedAt',to_char(j.finished_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')); END IF;
  IF j.status='failed' THEN result := result||jsonb_build_object('failureCode',j.failure_code,'retryable',false); END IF;
  IF j.status='completed' THEN
    SELECT id,run_id INTO report,rid FROM public.readiness_reports WHERE job_id=p_job;
    result := result||jsonb_build_object('report',jsonb_build_object('reportId',report,'analysisRunId',rid));
  END IF;
  RETURN result;
END $$;
CREATE FUNCTION public.feature_one_job_list(p_actor uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(public.feature_one_job_read(p_actor,id) ORDER BY created_at DESC,id),'[]')
  FROM (SELECT id,created_at FROM public.analysis_jobs WHERE user_id=p_actor ORDER BY created_at DESC,id LIMIT 50) j;
$$;
CREATE FUNCTION public.feature_one_job_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs; q feature_one_private.analysis_execution; aid uuid; token uuid:=gen_random_uuid();
BEGIN
  SELECT j0.* INTO j FROM public.analysis_jobs j0 JOIN feature_one_private.analysis_execution e ON e.job_id=j0.id
    WHERE j0.status='queued' AND e.available_at<=clock_timestamp() AND e.deadline>clock_timestamp() AND e.attempt_count<3
    ORDER BY e.available_at,j0.id FOR UPDATE OF j0 SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=j.id FOR UPDATE;
  INSERT INTO public.analysis_job_attempts(job_id,user_id,number,status,started_at) VALUES(j.id,j.user_id,q.attempt_count+1,'running',clock_timestamp()) RETURNING id INTO aid;
  UPDATE feature_one_private.analysis_execution SET attempt_count=attempt_count+1,current_attempt=aid,lease_token=token,
    lease_until=clock_timestamp()+interval '60 seconds',attempt_deadline=clock_timestamp()+interval '15 minutes' WHERE job_id=j.id;
  UPDATE public.analysis_jobs SET status='running',stage='acquiring_access',failure_code=NULL,updated_at=clock_timestamp() WHERE id=j.id;
  RETURN jsonb_build_object('jobId',j.id,'actor',j.user_id,'token',token,'attemptId',aid,'request',j.request,'policy',q.policy);
END $$;
CREATE FUNCTION public.feature_one_job_heartbeat(p_job uuid,p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution;
BEGIN
  q := feature_one_private.analysis_fence(p_job,p_token);
  UPDATE feature_one_private.analysis_execution SET lease_until=least(clock_timestamp()+interval '60 seconds',q.attempt_deadline,q.deadline) WHERE job_id=p_job;
END $$;
CREATE FUNCTION public.feature_one_job_stage(p_job uuid,p_token uuid,p_stage text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM feature_one_private.analysis_fence(p_job,p_token);
  IF p_stage NOT IN ('acquiring_access','downloading','inventorying','extracting','aggregating','synthesizing','validating') THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  UPDATE public.analysis_jobs SET stage=p_stage,updated_at=clock_timestamp() WHERE id=p_job;
END $$;
CREATE FUNCTION feature_one_private.analysis_fail(p_job uuid,p_code text,p_retry boolean) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; again boolean; expired boolean; finished timestamptz;
BEGIN
  SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=p_job FOR UPDATE;
  finished := clock_timestamp();
  expired := q.deadline<=clock_timestamp();
  again := p_retry AND NOT expired AND q.attempt_count<3 AND p_code IN ('DATABASE_FAILURE','PROVIDER_FAILURE','WORKER_EXPIRED');
  UPDATE public.analysis_job_attempts SET status='failed',failure_code=p_code,finished_at=clock_timestamp() WHERE id=q.current_attempt AND status='running';
  IF NOT again THEN UPDATE public.analysis_run_status SET status='failed',finished_at=clock_timestamp() WHERE run_id IN (SELECT id FROM public.analysis_runs WHERE job_id=p_job) AND status='running'; END IF;
  UPDATE public.analysis_jobs SET status=CASE WHEN again THEN 'queued' WHEN expired THEN 'expired' ELSE 'failed' END,
    failure_code=p_code,updated_at=finished,finished_at=CASE WHEN again THEN NULL ELSE finished END WHERE id=p_job;
  UPDATE feature_one_private.analysis_execution SET lease_token=NULL,lease_until=NULL,available_at=clock_timestamp()+make_interval(secs=>5*power(2,greatest(q.attempt_count-1,0))::integer) WHERE job_id=p_job;
END $$;
CREATE FUNCTION public.feature_one_job_fail(p_job uuid,p_token uuid,p_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs; q feature_one_private.analysis_execution;
BEGIN
  -- Fencing without access validation lets a current worker terminate/refund revoked work.
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job FOR UPDATE;
  SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=p_job FOR UPDATE;
  IF j.status IS DISTINCT FROM 'running' OR p_token IS NULL OR q.lease_token IS DISTINCT FROM p_token OR q.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  IF p_code NOT IN ('DATABASE_FAILURE','PROVIDER_FAILURE','WORKER_EXPIRED','REPOSITORY_ACCESS_REVOKED','CONSENT_REQUIRED','FEATURE_NOT_IMPLEMENTED','MODEL_OUTCOME_UNKNOWN','ANALYSIS_VALIDATION_FAILED','REPOSITORY_TOO_LARGE','UNSUPPORTED_ARCHIVE','SECRET_SCAN_BLOCKED_CONTENT') THEN p_code:='ANALYSIS_VALIDATION_FAILED'; END IF;
  PERFORM feature_one_private.analysis_fail(p_job,p_code,true);
END $$;
CREATE FUNCTION public.feature_one_job_retry(p_actor uuid,p_job uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF j.status<>'queued' OR j.failure_code IS NULL OR j.failure_code NOT IN ('DATABASE_FAILURE','PROVIDER_FAILURE','WORKER_EXPIRED') THEN RAISE EXCEPTION 'RETRY_NOT_ALLOWED'; END IF;
  PERFORM feature_one_private.analysis_access(p_job);
  UPDATE feature_one_private.analysis_execution SET available_at=clock_timestamp() WHERE job_id=p_job AND attempt_count<3 AND deadline>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'RETRY_NOT_ALLOWED'; END IF;
END $$;
CREATE FUNCTION public.feature_one_job_maintain() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs; q feature_one_private.analysis_execution; n integer:=0; code text;
BEGIN
  FOR j IN SELECT j0.* FROM public.analysis_jobs j0 JOIN feature_one_private.analysis_execution e ON e.job_id=j0.id
    WHERE j0.status IN ('queued','running') AND (e.deadline<=clock_timestamp() OR (j0.status='running' AND (e.lease_until<=clock_timestamp() OR e.attempt_deadline<=clock_timestamp()))
      OR EXISTS(SELECT 1 FROM public.analysis_job_grants jg JOIN public.repository_access_grants g ON g.id=jg.grant_id
        JOIN public.github_accounts a ON a.id=g.github_account_id JOIN public.github_installations i ON i.id=g.installation_id
        WHERE jg.job_id=j0.id AND (g.revoked_at IS NOT NULL OR a.revoked_at IS NOT NULL OR i.status<>'active' OR e.revisions->>g.id::text IS DISTINCT FROM g.access_revision::text)))
    ORDER BY e.deadline,j0.id FOR UPDATE OF j0 SKIP LOCKED LIMIT 100 LOOP
    SELECT * INTO q FROM feature_one_private.analysis_execution WHERE job_id=j.id FOR UPDATE;
    code:=NULL;
    BEGIN PERFORM feature_one_private.analysis_access(j.id); EXCEPTION WHEN raise_exception THEN code:='REPOSITORY_ACCESS_REVOKED'; END;
    IF code IS NULL AND q.deadline<=clock_timestamp() THEN code:='ANALYSIS_EXPIRED'; END IF;
    IF code IS NULL AND j.status='running' AND (q.lease_until<=clock_timestamp() OR q.attempt_deadline<=clock_timestamp()) THEN code:='WORKER_EXPIRED'; END IF;
    IF code IS NOT NULL THEN PERFORM feature_one_private.analysis_fail(j.id,code,code='WORKER_EXPIRED'); n:=n+1; END IF;
  END LOOP;
  FOR j IN SELECT j0.* FROM public.analysis_jobs j0 JOIN feature_one_private.analysis_settlements s ON s.job_id=j0.id
    WHERE j0.status IN ('completed','failed','canceled','expired') AND s.state='reserved' FOR UPDATE OF j0 SKIP LOCKED LIMIT 100 LOOP
    PERFORM feature_one_private.analysis_settle(j.id,j.status='completed'); n:=n+1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.feature_one_ingestion_access(p_actor uuid,p_job uuid,p_repository uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants; gid uuid; j public.analysis_jobs;
BEGIN
  PERFORM feature_one_private.require_analysis_fence(p_job);
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND OR j.status NOT IN ('queued','running') THEN RAISE EXCEPTION 'CANCELED'; END IF;
  SELECT grant_id INTO gid FROM public.analysis_job_grants WHERE job_id=p_job AND user_id=p_actor AND repository_id=p_repository;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  g := feature_one_private.require_grant(p_actor,gid);
  IF NOT g.attestation_confirmed AND EXISTS(SELECT 1 FROM public.repositories r JOIN public.github_installations i ON i.id=g.installation_id
      WHERE r.id=p_repository AND (r.visibility='private' OR i.owner_type='Organization')) THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  RETURN jsonb_build_object('accountId',g.github_account_id,'installationId',g.installation_id,'grantId',g.id,'accessRevision',g.access_revision,
    'providerRepositoryId',r.provider_repository_id,'repositoryVisibility',r.visibility) FROM public.repositories r WHERE r.id=p_repository;
END $$;

CREATE OR REPLACE FUNCTION public.feature_one_create_run(p_actor uuid, p_job uuid, p_versions jsonb, p_snapshot_ids uuid[], p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.analysis_jobs; sid uuid; s public.repository_snapshots; gid uuid; aid uuid; rid uuid; rubric jsonb; set_hash text; managed boolean;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id = p_job AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  managed := EXISTS(SELECT 1 FROM feature_one_private.analysis_execution WHERE job_id=p_job);
  PERFORM feature_one_private.require_analysis_fence(p_job);
  IF managed THEN
    IF p_versions IS DISTINCT FROM (SELECT policy->'versions' FROM feature_one_private.analysis_execution WHERE job_id=p_job) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
    SELECT id,attempt_id INTO rid,aid FROM public.analysis_runs WHERE job_id=p_job;
    IF FOUND THEN RETURN jsonb_build_object('runId',rid,'attemptId',aid); END IF;
    IF EXISTS(SELECT 1 FROM public.analysis_job_grants g LEFT JOIN feature_one_private.analysis_snapshot_outputs o ON o.job_id=g.job_id AND o.repository_id=g.repository_id
      WHERE g.job_id=p_job AND (o.snapshot_id IS NULL OR NOT o.snapshot_id=ANY(p_snapshot_ids))) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  ELSIF j.status <> 'queued' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF cardinality(p_snapshot_ids) NOT BETWEEN 1 AND 10
      OR cardinality(p_snapshot_ids) <> (SELECT count(*) FROM public.analysis_job_grants WHERE job_id = p_job)
      OR p_versions->>'contract' IS DISTINCT FROM '1.0.0' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOREACH sid IN ARRAY p_snapshot_ids LOOP
    SELECT s0.* INTO s FROM public.repository_snapshots s0 JOIN public.snapshot_receipts receipt ON receipt.snapshot_id = s0.id
      JOIN public.analysis_job_grants jg ON jg.grant_id = receipt.grant_id AND jg.repository_id = s0.repository_id
      WHERE s0.id = sid AND receipt.user_id = p_actor AND jg.job_id = p_job LIMIT 1;
    IF NOT FOUND OR s.sealed_at IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    SELECT grant_id INTO gid FROM public.analysis_job_grants WHERE job_id = p_job AND repository_id = s.repository_id;
    PERFORM feature_one_private.require_grant(p_actor, gid);
    IF s.security_policy_hash IS DISTINCT FROM coalesce(p_versions->>'ingestionPolicyHash','legacy')
        OR s.identity_version IS DISTINCT FROM p_versions->>'snapshotIdentity'
        OR s.extractor_id IS DISTINCT FROM p_versions#>>'{extractorBundle,id}' OR s.extractor_version IS DISTINCT FROM p_versions#>>'{extractorBundle,version}'
        OR s.detector_bundle_id IS DISTINCT FROM p_versions#>>'{detectorBundle,id}' OR s.detector_bundle_version IS DISTINCT FROM p_versions#>>'{detectorBundle,version}'
        OR s.coverage_version IS DISTINCT FROM p_versions->>'coverageManifest' THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  END LOOP;
  SELECT 'sha256:' || encode(sha256(convert_to(string_agg(x::text, ',' ORDER BY x), 'UTF8')), 'hex') INTO set_hash FROM unnest(p_snapshot_ids) x;
  IF managed THEN SELECT current_attempt INTO aid FROM feature_one_private.analysis_execution WHERE job_id=p_job;
  ELSE INSERT INTO public.analysis_job_attempts(job_id,user_id,number,status) VALUES(p_job,p_actor,1,'running') RETURNING id INTO aid; END IF;
  INSERT INTO public.analysis_runs(job_id, user_id, attempt_id, versions, taxonomy_id, taxonomy_version, snapshot_set_hash)
    VALUES (p_job, p_actor, aid, p_versions, p_versions#>>'{taxonomy,id}', p_versions#>>'{taxonomy,version}', set_hash) RETURNING id INTO rid;
  INSERT INTO public.analysis_run_status(run_id, status) VALUES (rid, 'running');
  INSERT INTO public.analysis_run_snapshots(run_id, user_id, job_id, snapshot_id, repository_id, grant_id)
    SELECT rid, p_actor, p_job, s0.id, s0.repository_id, jg.grant_id FROM public.repository_snapshots s0
      JOIN public.analysis_job_grants jg ON jg.job_id = p_job AND jg.repository_id = s0.repository_id WHERE s0.id = ANY(p_snapshot_ids);
  IF (SELECT count(*) FROM public.analysis_run_snapshots WHERE run_id = rid) <> cardinality(p_snapshot_ids) THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR rubric IN SELECT value FROM jsonb_array_elements(p_versions->'roleRubrics') LOOP
    INSERT INTO public.analysis_run_roles(run_id, role_id, role_version, taxonomy_id, taxonomy_version)
      VALUES (rid, rubric->>'roleId', rubric->>'version', p_versions#>>'{taxonomy,id}', p_versions#>>'{taxonomy,version}');
    IF (SELECT abs(sum(weight) - 1) < 0.000001 FROM public.role_requirements WHERE role_id = rubric->>'roleId' AND role_version = rubric->>'version') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'VERSION_MISMATCH';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.analysis_run_roles WHERE run_id = rid) <> 5 THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  UPDATE public.analysis_jobs SET status = 'running', stage = 'aggregation', updated_at = now() WHERE id = p_job;
  INSERT INTO public.audit_events(actor_id, job_id, action, object_type, object_id, request_id)
    VALUES (p_actor, p_job, 'run_created', 'run', rid, p_request_id);
  RETURN jsonb_build_object('runId', rid, 'attemptId', aid);
END $$;

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
            AND claim->'evidenceIds' ? ce.evidence_id::text) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
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

-- All source RPCs run in a transaction with the parent token. No dynamic SQL dispatch.
CREATE FUNCTION public.feature_one_job_ingestion(p_job uuid,p_token uuid,p_operation text,p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; q feature_one_private.analysis_execution; actual_job uuid; result jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT user_id INTO actor FROM public.analysis_jobs WHERE id=p_job;
  IF p_args->>'p_actor' IS DISTINCT FROM actor::text THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  IF p_operation IN ('access','read','pin') THEN actual_job:=(p_args->>'p_job')::uuid;
  ELSIF p_operation='begin' THEN SELECT job_id INTO actual_job FROM feature_one_private.ingestion_pins WHERE id=(p_args->>'p_pin')::uuid;
  ELSE SELECT p.job_id INTO actual_job FROM feature_one_private.ingestion_attempts a JOIN feature_one_private.ingestion_pins p ON p.id=a.pin_id WHERE a.id=(p_args->>'p_attempt')::uuid; END IF;
  IF actual_job IS DISTINCT FROM p_job THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  PERFORM set_config('feature_one.worker_token',p_token::text,true);
  CASE p_operation
    WHEN 'access' THEN result:=public.feature_one_ingestion_access(actor,p_job,(p_args->>'p_repository')::uuid);
    WHEN 'read' THEN result:=public.feature_one_ingestion_read(actor,p_job,(p_args->>'p_repository')::uuid);
    WHEN 'pin' THEN
      IF p_args#>'{p_pin,policy}' IS DISTINCT FROM q.policy->'security' OR p_args#>>'{p_pin,policyHash}' IS DISTINCT FROM q.policy#>>'{versions,ingestionPolicyHash}' THEN RAISE EXCEPTION 'POLICY_MISMATCH'; END IF;
      result:=public.feature_one_ingestion_pin(actor,p_job,(p_args->>'p_repository')::uuid,p_args->'p_pin');
    WHEN 'begin' THEN result:=to_jsonb(public.feature_one_ingestion_begin(actor,(p_args->>'p_pin')::uuid,(p_args->>'p_attempt')::uuid));
    WHEN 'checkpoint' THEN PERFORM public.feature_one_ingestion_checkpoint(actor,(p_args->>'p_attempt')::uuid,(p_args->>'p_token')::uuid);
    WHEN 'ready' THEN PERFORM public.feature_one_ingestion_ready(actor,(p_args->>'p_attempt')::uuid,(p_args->>'p_token')::uuid,p_args->'p_summary',p_args->'p_files');
    ELSE RAISE EXCEPTION 'INVALID_REQUEST';
  END CASE;
  PERFORM set_config('feature_one.worker_token','',true);
  RETURN result;
END $$;
CREATE FUNCTION public.feature_one_job_snapshot(p_job uuid,p_token uuid,p_repository uuid,p_bundle jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; actor uuid; gid uuid; sid uuid; pin feature_one_private.ingestion_pins;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT snapshot_id INTO sid FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=p_job AND repository_id=p_repository;
  IF FOUND THEN RETURN sid; END IF;
  IF p_bundle IS NULL THEN RETURN NULL; END IF;
  SELECT user_id,grant_id INTO actor,gid FROM public.analysis_job_grants WHERE job_id=p_job AND repository_id=p_repository;
  SELECT * INTO pin FROM feature_one_private.ingestion_pins WHERE job_id=p_job AND repository_id=p_repository;
  IF actor IS NULL OR pin.id IS NULL OR p_bundle#>>'{snapshot,repositoryId}' IS DISTINCT FROM p_repository::text
    OR p_bundle#>>'{snapshot,commitSha}' IS DISTINCT FROM pin.commit_sha
    OR p_bundle#>>'{snapshot,providerRepositoryId}' IS DISTINCT FROM pin.provider_repository_id
    OR p_bundle#>>'{snapshot,repositoryVisibility}' IS DISTINCT FROM pin.visibility OR p_bundle->'versions' IS DISTINCT FROM q.policy->'versions'
    OR p_bundle#>>'{snapshot,securityPolicyHash}' IS DISTINCT FROM pin.policy_hash
    OR p_bundle#>'{inventorySummary,metadata}' IS DISTINCT FROM (SELECT request->'includeMetadata' FROM public.analysis_jobs WHERE id=p_job) THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  sid:=public.feature_one_store_snapshot(actor,gid,p_bundle);
  -- Older canonical artifacts cannot satisfy different requested metadata options.
  IF (SELECT inventory_summary->'metadata' FROM public.repository_snapshots WHERE id=sid) IS DISTINCT FROM p_bundle#>'{inventorySummary,metadata}' THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  INSERT INTO feature_one_private.analysis_snapshot_outputs VALUES(p_job,p_repository,sid);
  RETURN sid;
END $$;
CREATE FUNCTION public.feature_one_job_run(p_job uuid,p_token uuid,p_snapshots uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; actor uuid; result jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT user_id INTO actor FROM public.analysis_jobs WHERE id=p_job;
  PERFORM set_config('feature_one.worker_token',p_token::text,true);
  result:=public.feature_one_create_run(actor,p_job,q.policy->'versions',p_snapshots,gen_random_uuid());
  PERFORM set_config('feature_one.worker_token','',true);
  RETURN result;
END $$;
CREATE FUNCTION public.feature_one_job_synthesis(p_job uuid,p_token uuid,p_hash text,p_draft jsonb DEFAULT NULL)
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
    IF p_draft IS NULL THEN RETURN jsonb_build_object('state','uncertain'); END IF;
  ELSE
    IF p_draft IS NOT NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    INSERT INTO feature_one_private.analysis_synthesis(job_id,input_hash) VALUES(p_job,p_hash);
    RETURN jsonb_build_object('state','reserved');
  END IF;
  IF p_draft->>'jobId' IS DISTINCT FROM p_job::text OR p_draft->>'analysisRunId' IS DISTINCT FROM rid::text
    OR p_draft->'versions' IS DISTINCT FROM q.policy->'versions' THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  UPDATE feature_one_private.analysis_synthesis SET draft=p_draft WHERE job_id=p_job;
  RETURN jsonb_build_object('state','ready','draft',p_draft);
END $$;
CREATE FUNCTION public.feature_one_job_complete(p_job uuid,p_token uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.analysis_jobs; q feature_one_private.analysis_execution; draft jsonb; rid uuid;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id=p_job FOR UPDATE;
  -- A lost acknowledgement can be resolved by an owner read. An expired token never writes.
  q:=feature_one_private.analysis_fence(p_job,p_token);
  IF j.stage<>'validating' THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  SELECT m.draft INTO draft FROM feature_one_private.analysis_synthesis m WHERE job_id=p_job;
  IF draft IS NULL THEN RAISE EXCEPTION 'ANALYSIS_VALIDATION_FAILED'; END IF;
  PERFORM set_config('feature_one.worker_token',p_token::text,true);
  rid:=public.feature_one_finalize_report(j.user_id,draft,gen_random_uuid());
  PERFORM set_config('feature_one.worker_token','',true);
  RETURN rid;
END $$;

-- Narrow RPC grants; private tables/functions never exposed to service/browser clients.
DO $$ DECLARE f record; t text; BEGIN
  FOREACH t IN ARRAY ARRAY['analysis_execution','analysis_requests','analysis_wallets','analysis_settlements','analysis_ledger','analysis_snapshot_outputs','analysis_synthesis'] LOOP
    EXECUTE format('ALTER TABLE feature_one_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON feature_one_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'feature_one_job_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA feature_one_private FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.analysis_job_attempts IS 'One execution per durable worker claim. Immutable runs retain their originating attempt while later attempts resume the same pinned inputs.';

-- Keep reusable snapshot membership coherent with retention and explicit deletion.
CREATE OR REPLACE FUNCTION feature_one_private.prune_canonical() RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  DELETE FROM public.repository_snapshots s WHERE NOT EXISTS(SELECT 1 FROM public.snapshot_receipts WHERE snapshot_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.analysis_run_snapshots WHERE snapshot_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM feature_one_private.analysis_snapshot_outputs WHERE snapshot_id=s.id);
  DELETE FROM public.repositories r WHERE NOT EXISTS(SELECT 1 FROM public.repository_access_grants WHERE repository_id=r.id)
    AND NOT EXISTS(SELECT 1 FROM public.repository_snapshots WHERE repository_id=r.id)
    AND NOT EXISTS(SELECT 1 FROM public.github_discovered_repositories WHERE repository_id=r.id);
  DELETE FROM public.github_installations i WHERE NOT EXISTS(SELECT 1 FROM public.repository_access_grants WHERE installation_id=i.id)
    AND NOT EXISTS(SELECT 1 FROM public.github_installation_connections WHERE installation_id=i.id);
  DELETE FROM feature_one_private.github_connection_states WHERE expires_at<=now();
  DELETE FROM feature_one_private.github_user_credentials WHERE expires_at<=now();
END $$;
CREATE OR REPLACE FUNCTION public.feature_one_delete_analysis(p_actor uuid,p_job uuid,p_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshots uuid[];
BEGIN
  PERFORM 1 FROM public.analysis_jobs WHERE id=p_job AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT array_agg(snapshot_id) INTO snapshots FROM (
    SELECT snapshot_id FROM public.analysis_run_snapshots WHERE job_id=p_job
    UNION SELECT snapshot_id FROM feature_one_private.analysis_snapshot_outputs WHERE job_id=p_job) s;
  DELETE FROM public.analysis_jobs WHERE id=p_job AND user_id=p_actor;
  DELETE FROM public.snapshot_receipts receipt WHERE user_id=p_actor AND snapshot_id=ANY(snapshots)
    AND NOT EXISTS(SELECT 1 FROM public.analysis_run_snapshots rs WHERE rs.user_id=p_actor AND rs.snapshot_id=receipt.snapshot_id AND rs.grant_id=receipt.grant_id)
    AND NOT EXISTS(SELECT 1 FROM feature_one_private.analysis_snapshot_outputs o JOIN public.analysis_jobs j ON j.id=o.job_id WHERE j.user_id=p_actor AND o.snapshot_id=receipt.snapshot_id);
  PERFORM feature_one_private.prune_canonical();
  INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id) VALUES(p_actor,'analysis_deleted','job',p_job,p_request_id);
END $$;
CREATE FUNCTION public.feature_one_export_v5(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.feature_one_export_v4(p_actor)||jsonb_build_object(
    'analysisExecutions',(SELECT coalesce(jsonb_agg(jsonb_build_object('jobId',e.job_id,'policy',e.policy,'attemptCount',e.attempt_count,'deadline',e.deadline,'availableAt',e.available_at)),'[]')
      FROM feature_one_private.analysis_execution e JOIN public.analysis_jobs j ON j.id=e.job_id WHERE j.user_id=p_actor),
    'analysisSettlements',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM feature_one_private.analysis_settlements s WHERE s.user_id=p_actor),
    'analysisLedger',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM feature_one_private.analysis_ledger l JOIN feature_one_private.analysis_settlements s ON s.job_id=l.job_id WHERE s.user_id=p_actor),
    'analysisDrafts',(SELECT coalesce(jsonb_agg(jsonb_build_object('jobId',m.job_id,'draft',m.draft)),'[]') FROM feature_one_private.analysis_synthesis m JOIN public.analysis_jobs j ON j.id=m.job_id WHERE j.user_id=p_actor));
$$;
REVOKE ALL ON FUNCTION public.feature_one_export_v5(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feature_one_export_v5(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
