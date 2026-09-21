-- Run 06: worker-only, owner-scoped pins and short-lived ingestion leases.
-- Raw archives/source/matches/URLs/tokens never enter these tables.
CREATE TABLE feature_one_private.ingestion_pins (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL, repository_id uuid NOT NULL, grant_id uuid NOT NULL, access_revision uuid NOT NULL,
  provider_repository_id feature_one_private.provider_id NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private','public')),
  branch_encrypted feature_one_private.ciphertext NOT NULL,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  resolved_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  policy jsonb NOT NULL, policy_hash feature_one_private.digest NOT NULL,
  FOREIGN KEY (job_id,user_id,repository_id,grant_id) REFERENCES public.analysis_job_grants(job_id,user_id,repository_id,grant_id) ON DELETE CASCADE,
  UNIQUE(job_id,repository_id), UNIQUE(id,user_id)
);
CREATE TRIGGER immutable_ingestion_pin BEFORE UPDATE ON feature_one_private.ingestion_pins FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
CREATE TABLE feature_one_private.ingestion_attempts (
  id uuid PRIMARY KEY, pin_id uuid NOT NULL, user_id uuid NOT NULL,
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','ready','disposed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deadline timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 minutes',
  lease_until timestamptz NOT NULL DEFAULT clock_timestamp() + interval '60 seconds',
  disposed_at timestamptz, summary jsonb,
  FOREIGN KEY(pin_id,user_id) REFERENCES feature_one_private.ingestion_pins(id,user_id) ON DELETE CASCADE,
  CHECK(deadline <= created_at + interval '30 minutes 1 second'),
  CHECK((state = 'disposed') = (disposed_at IS NOT NULL))
);
CREATE INDEX ingestion_expired ON feature_one_private.ingestion_attempts(lease_until) WHERE state <> 'disposed';
CREATE TABLE feature_one_private.ingestion_files (
  attempt_id uuid NOT NULL REFERENCES feature_one_private.ingestion_attempts(id) ON DELETE CASCADE,
  locator_id uuid NOT NULL, locator_encrypted feature_one_private.ciphertext NOT NULL,
  fingerprint feature_one_private.digest NOT NULL, fingerprint_key_version feature_one_private.version NOT NULL,
  content_hash feature_one_private.digest NOT NULL, content_hash_key_version feature_one_private.version NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 0 AND 1048576),
  lines integer NOT NULL CHECK(lines BETWEEN 0 AND 250000),
  PRIMARY KEY(attempt_id,locator_id), UNIQUE(attempt_id,fingerprint)
);
ALTER TABLE feature_one_private.ingestion_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_one_private.ingestion_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_one_private.ingestion_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON feature_one_private.ingestion_pins, feature_one_private.ingestion_attempts, feature_one_private.ingestion_files FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.feature_one_ingestion_access(p_actor uuid,p_job uuid,p_repository uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants; gid uuid; j public.analysis_jobs;
BEGIN
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
CREATE FUNCTION feature_one_private.ingestion_pin_json(p feature_one_private.ingestion_pins)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('pinId',p.id,'jobId',p.job_id,'repositoryId',p.repository_id,'grantId',p.grant_id,'accessRevision',p.access_revision,
    'accountId',g.github_account_id,'installationId',g.installation_id,'providerRepositoryId',p.provider_repository_id,'repositoryVisibility',p.visibility,
    'branchEncrypted',p.branch_encrypted,'commitSha',p.commit_sha,'resolvedAt',p.resolved_at,'policy',p.policy,'policyHash',p.policy_hash)
  FROM public.repository_access_grants g WHERE g.id=p.grant_id;
$$;
CREATE FUNCTION public.feature_one_ingestion_read(p_actor uuid,p_job uuid,p_repository uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a jsonb; p feature_one_private.ingestion_pins;
BEGIN
  a := public.feature_one_ingestion_access(p_actor,p_job,p_repository);
  SELECT * INTO p FROM feature_one_private.ingestion_pins WHERE job_id=p_job AND repository_id=p_repository AND user_id=p_actor;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p.grant_id::text IS DISTINCT FROM a->>'grantId' OR p.access_revision::text IS DISTINCT FROM a->>'accessRevision'
    OR p.visibility IS DISTINCT FROM a->>'repositoryVisibility' THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  RETURN feature_one_private.ingestion_pin_json(p);
END $$;
CREATE FUNCTION public.feature_one_ingestion_pin(p_actor uuid,p_job uuid,p_repository uuid,p_pin jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a jsonb; current_pin jsonb; policy jsonb := p_pin->'policy'; limits jsonb := p_pin#>'{policy,limits}';
BEGIN
  a := public.feature_one_ingestion_access(p_actor,p_job,p_repository);
  current_pin := public.feature_one_ingestion_read(p_actor,p_job,p_repository);
  IF current_pin IS NOT NULL THEN
    IF current_pin->>'policyHash' IS DISTINCT FROM p_pin->>'policyHash' OR current_pin->'policy' IS DISTINCT FROM policy THEN RAISE EXCEPTION 'POLICY_MISMATCH'; END IF;
    RETURN current_pin;
  END IF;
  IF p_pin->>'jobId' IS DISTINCT FROM p_job::text OR p_pin->>'repositoryId' IS DISTINCT FROM p_repository::text
    OR NOT p_pin @> a OR (p_pin->>'resolvedAt')::timestamptz > clock_timestamp() + interval '1 minute'
    OR (p_pin->>'resolvedAt')::timestamptz < clock_timestamp() - interval '5 minutes' THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  IF policy - ARRAY['version','scanner','exclusions','ignore','parser','coverage','limits'] <> '{}'::jsonb
    OR policy->>'version' IS DISTINCT FROM '1.0.0' OR policy->>'scanner' IS DISTINCT FROM 'repofy-static-secrets-1.0.0'
    OR policy->>'exclusions' IS DISTINCT FROM 'repofy-exclusions-1.0.0' OR policy->>'ignore' IS DISTINCT FROM 'ignore-7.0.9-subset-1.0.0'
    OR policy->>'parser' IS DISTINCT FROM 'tar-7.5.22-guards-1.0.0' OR policy->>'coverage' IS DISTINCT FROM 'utf8-static-1.0.0'
    OR limits - ARRAY['compressedBytes','decompressedBytes','archiveEntries','eligibleFiles','fileBytes','contextBytes','totalLines','pathBytes','pathDepth','prepareTimeoutMs'] <> '{}'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(limits)) <> 10
    OR coalesce(limits->>'compressedBytes','') !~ '^[0-9]+$' OR (limits->>'compressedBytes')::bigint NOT BETWEEN 1024 AND 104857600
    OR coalesce(limits->>'decompressedBytes','') !~ '^[0-9]+$' OR (limits->>'decompressedBytes')::bigint NOT BETWEEN 1024 AND 536870912
    OR coalesce(limits->>'archiveEntries','') !~ '^[0-9]+$' OR (limits->>'archiveEntries')::bigint NOT BETWEEN 1 AND 50000
    OR coalesce(limits->>'eligibleFiles','') !~ '^[0-9]+$' OR (limits->>'eligibleFiles')::bigint NOT BETWEEN 1 AND 10000
    OR coalesce(limits->>'fileBytes','') !~ '^[0-9]+$' OR (limits->>'fileBytes')::bigint NOT BETWEEN 1 AND 1048576
    OR coalesce(limits->>'contextBytes','') !~ '^[0-9]+$' OR (limits->>'contextBytes')::bigint NOT BETWEEN 1 AND 33554432
    OR coalesce(limits->>'totalLines','') !~ '^[0-9]+$' OR (limits->>'totalLines')::bigint NOT BETWEEN 1 AND 250000
    OR coalesce(limits->>'pathBytes','') !~ '^[0-9]+$' OR (limits->>'pathBytes')::bigint NOT BETWEEN 16 AND 1024
    OR coalesce(limits->>'pathDepth','') !~ '^[0-9]+$' OR (limits->>'pathDepth')::bigint NOT BETWEEN 2 AND 32
    OR coalesce(limits->>'prepareTimeoutMs','') !~ '^[0-9]+$' OR (limits->>'prepareTimeoutMs')::bigint NOT BETWEEN 50 AND 120000 THEN RAISE EXCEPTION 'POLICY_MISMATCH'; END IF;
  INSERT INTO feature_one_private.ingestion_pins(id,user_id,job_id,repository_id,grant_id,access_revision,provider_repository_id,visibility,branch_encrypted,commit_sha,resolved_at,policy,policy_hash)
    VALUES((p_pin->>'pinId')::uuid,p_actor,p_job,p_repository,(a->>'grantId')::uuid,(a->>'accessRevision')::uuid,
      a->>'providerRepositoryId',a->>'repositoryVisibility',p_pin->>'branchEncrypted',p_pin->>'commitSha',(p_pin->>'resolvedAt')::timestamptz,policy,p_pin->>'policyHash');
  RETURN public.feature_one_ingestion_read(p_actor,p_job,p_repository);
END $$;
CREATE FUNCTION public.feature_one_ingestion_begin(p_actor uuid,p_pin uuid,p_attempt uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p feature_one_private.ingestion_pins; token uuid;
BEGIN
  SELECT * INTO p FROM feature_one_private.ingestion_pins WHERE id=p_pin AND user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  PERFORM public.feature_one_ingestion_read(p_actor,p.job_id,p.repository_id);
  INSERT INTO feature_one_private.ingestion_attempts(id,pin_id,user_id) VALUES(p_attempt,p_pin,p_actor) RETURNING lease_token INTO token;
  RETURN token;
END $$;
CREATE FUNCTION public.feature_one_ingestion_checkpoint(p_actor uuid,p_attempt uuid,p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a feature_one_private.ingestion_attempts; p feature_one_private.ingestion_pins;
BEGIN
  -- Lock order is job -> grant -> attempt, matching cancellation and finalization.
  SELECT p0.* INTO p FROM feature_one_private.ingestion_pins p0 JOIN feature_one_private.ingestion_attempts a0 ON a0.pin_id=p0.id WHERE a0.id=p_attempt AND a0.user_id=p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  PERFORM public.feature_one_ingestion_read(p_actor,p.job_id,p.repository_id);
  SELECT * INTO a FROM feature_one_private.ingestion_attempts WHERE id=p_attempt AND user_id=p_actor FOR UPDATE;
  IF a.lease_token IS DISTINCT FROM p_token OR a.state NOT IN ('active','ready') OR a.lease_until <= clock_timestamp() OR a.deadline <= clock_timestamp() THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  UPDATE feature_one_private.ingestion_attempts SET lease_until=least(deadline,clock_timestamp()+interval '60 seconds') WHERE id=p_attempt;
END $$;
CREATE FUNCTION public.feature_one_ingestion_ready(p_actor uuid,p_attempt uuid,p_token uuid,p_summary jsonb,p_files jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; count_files integer := jsonb_array_length(p_files); exclusions bigint; n bigint; lim jsonb;
BEGIN
  PERFORM public.feature_one_ingestion_checkpoint(p_actor,p_attempt,p_token);
  IF (SELECT state FROM feature_one_private.ingestion_attempts WHERE id=p_attempt) <> 'active' THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  SELECT p.policy->'limits' INTO lim FROM feature_one_private.ingestion_pins p JOIN feature_one_private.ingestion_attempts a ON a.pin_id=p.id WHERE a.id=p_attempt;
  IF p_summary - ARRAY['archiveEntries','totalFiles','eligibleFiles','textBytes','totalLines','decompressedBytes','excluded','scope','semanticAnalysis'] <> '{}'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(p_summary)) <> 9
    OR (SELECT count(*) FROM jsonb_object_keys(p_summary->'excluded')) <> 9
    OR EXISTS(SELECT 1 FROM jsonb_each_text(p_summary->'excluded') e WHERE e.value !~ '^[0-9]+$' OR length(e.value)>5 OR e.value::bigint>50000)
    OR EXISTS(SELECT 1 FROM jsonb_each_text(p_summary-ARRAY['excluded','scope','semanticAnalysis']) e WHERE e.value !~ '^[0-9]+$' OR length(e.value)>9)
    OR p_summary->>'semanticAnalysis' IS DISTINCT FROM 'not_performed'
    OR p_summary->>'scope' NOT IN ('all_text','filtered')
    OR (p_summary->'excluded') - ARRAY['sensitive_path','dependency','generated','binary','oversized','unsupported_encoding','user_ignored','policy_file','secret_or_sensitive_data'] <> '{}'::jsonb
    OR count_files > (lim->>'eligibleFiles')::integer OR count_files IS DISTINCT FROM (p_summary->>'eligibleFiles')::integer
    OR (p_summary->>'textBytes')::bigint > (lim->>'contextBytes')::bigint OR (p_summary->>'totalLines')::bigint > (lim->>'totalLines')::bigint
    OR (p_summary->>'archiveEntries')::bigint > (lim->>'archiveEntries')::bigint OR (p_summary->>'decompressedBytes')::bigint > (lim->>'decompressedBytes')::bigint
    OR (p_summary->>'totalFiles')::bigint > (p_summary->>'archiveEntries')::bigint
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  SELECT sum(value::bigint) INTO exclusions FROM jsonb_each_text(p_summary->'excluded');
  IF exclusions + count_files IS DISTINCT FROM (p_summary->>'totalFiles')::bigint THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF (p_summary->>'scope'='all_text') IS DISTINCT FROM (exclusions=0) THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_files) LOOP
    IF (item->>'sizeBytes')::integer > (lim->>'fileBytes')::integer THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
    INSERT INTO feature_one_private.ingestion_files(attempt_id,locator_id,locator_encrypted,fingerprint,fingerprint_key_version,content_hash,content_hash_key_version,size_bytes,lines)
      VALUES(p_attempt,(item->>'locatorId')::uuid,item->>'locatorEncrypted',item->>'fingerprint',item->>'fingerprintKeyVersion',
        item->>'contentHash',item->>'contentHashKeyVersion',(item->>'sizeBytes')::integer,(item->>'lines')::integer);
  END LOOP;
  SELECT coalesce(sum(lines),0) INTO n FROM feature_one_private.ingestion_files WHERE attempt_id=p_attempt;
  IF n IS DISTINCT FROM (p_summary->>'totalLines')::bigint THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  UPDATE feature_one_private.ingestion_attempts SET state='ready',summary=p_summary WHERE id=p_attempt;
END $$;
CREATE FUNCTION public.feature_one_ingestion_dispose(p_actor uuid,p_attempt uuid,p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE feature_one_private.ingestion_attempts SET state='disposed',disposed_at=coalesce(disposed_at,clock_timestamp()),lease_until=clock_timestamp()
    WHERE id=p_attempt AND user_id=p_actor AND lease_token=p_token;
$$;
CREATE FUNCTION public.feature_one_ingestion_claim_expired(p_attempt uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a feature_one_private.ingestion_attempts;
BEGIN
  SELECT * INTO a FROM feature_one_private.ingestion_attempts WHERE id=p_attempt FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF; -- Deleted job/account: remove local orphan independently.
  IF a.state='disposed' OR a.lease_until <= clock_timestamp() OR a.deadline <= clock_timestamp() THEN
    UPDATE feature_one_private.ingestion_attempts SET state='disposed',disposed_at=coalesce(disposed_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=clock_timestamp() WHERE id=p_attempt;
    RETURN true;
  END IF;
  RETURN false;
END $$;

CREATE FUNCTION public.feature_one_export_v4(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.feature_one_export_v3(p_actor) || jsonb_build_object(
  'ingestionSnapshots',(SELECT coalesce(jsonb_agg(to_jsonb(p)-'branch_encrypted'),'[]') FROM feature_one_private.ingestion_pins p WHERE user_id=p_actor),
  'ingestionAttempts',(SELECT coalesce(jsonb_agg(to_jsonb(a)-'lease_token'),'[]') FROM feature_one_private.ingestion_attempts a WHERE user_id=p_actor),
  'ingestionFiles',(SELECT coalesce(jsonb_agg(to_jsonb(f)-ARRAY['locator_encrypted','fingerprint','fingerprint_key_version','content_hash','content_hash_key_version']),'[]')
    FROM feature_one_private.ingestion_files f JOIN feature_one_private.ingestion_attempts a ON a.id=f.attempt_id WHERE a.user_id=p_actor));
$$;

-- Safe policy identity is also part of canonical downstream observation reuse.
ALTER TABLE public.repository_snapshots ADD COLUMN security_policy_hash text NOT NULL DEFAULT 'legacy'
  CHECK(security_policy_hash='legacy' OR security_policy_hash ~ '^sha256:[0-9a-f]{64}$');
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='public.repository_snapshots'::regclass AND contype='u' AND cardinality(conkey)>2 LOOP
    EXECUTE format('ALTER TABLE public.repository_snapshots DROP CONSTRAINT %I',item.conname);
  END LOOP;
END $$;
ALTER TABLE public.repository_snapshots ADD CONSTRAINT snapshot_security_identity UNIQUE(repository_id,commit_sha,visibility,identity_version,extraction_policy_version,
  extractor_id,extractor_version,detector_bundle_id,detector_bundle_version,coverage_version,security_policy_hash);

-- Store/run function revisions and ACLs follow below; historical migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION public.feature_one_store_snapshot(p_actor uuid, p_grant uuid, p_bundle jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants; s jsonb := p_bundle->'snapshot'; v jsonb := p_bundle->'versions';
  sid uuid; item jsonb; obs jsonb; cap text; existing public.repository_snapshots;
BEGIN
  g := feature_one_private.require_grant(p_actor, p_grant);
  IF (s->>'repositoryId')::uuid IS DISTINCT FROM g.repository_id OR NOT EXISTS (
      SELECT 1 FROM public.repositories WHERE id = g.repository_id AND provider_repository_id = s->>'providerRepositoryId' AND visibility = s->>'repositoryVisibility') THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF coalesce(s->>'securityPolicyHash','legacy') IS DISTINCT FROM coalesce(v->>'ingestionPolicyHash','legacy')
      OR s->>'snapshotIdentityVersion' IS DISTINCT FROM v->>'snapshotIdentity'
      OR p_bundle#>>'{coverage,snapshotId}' IS DISTINCT FROM s->>'snapshotId'
      OR p_bundle#>>'{inventorySummary,snapshotId}' IS DISTINCT FROM s->>'snapshotId'
      OR p_bundle#>>'{coverage,manifestVersion}' IS DISTINCT FROM v->>'coverageManifest'
      OR p_bundle#>'{coverage,detectorBundle}' IS DISTINCT FROM v->'detectorBundle'
      OR p_bundle#>'{inventorySummary,extractorBundle}' IS DISTINCT FROM v->'extractorBundle' THEN
    RAISE EXCEPTION 'VERSION_MISMATCH';
  END IF;
  INSERT INTO public.repository_snapshots(id, repository_id, commit_sha, visibility, branch_encrypted,
      identity_version, extraction_policy_version, extractor_id, extractor_version, detector_bundle_id,
      detector_bundle_version, coverage_version, security_policy_hash, inventory_summary, coverage, created_at)
    VALUES ((s->>'snapshotId')::uuid, g.repository_id, s->>'commitSha', s->>'repositoryVisibility', p_bundle->>'branchEncrypted',
      s->>'snapshotIdentityVersion', s->>'extractionPolicyVersion', v#>>'{extractorBundle,id}', v#>>'{extractorBundle,version}',
      v#>>'{detectorBundle,id}', v#>>'{detectorBundle,version}', v->>'coverageManifest', coalesce(s->>'securityPolicyHash','legacy'),
      p_bundle->'inventorySummary', p_bundle->'coverage', (s->>'createdAt')::timestamptz)
    ON CONFLICT (repository_id, commit_sha, visibility, identity_version, extraction_policy_version,
      extractor_id, extractor_version, detector_bundle_id, detector_bundle_version, coverage_version, security_policy_hash) DO NOTHING
    RETURNING id INTO sid;
  IF sid IS NULL THEN
    SELECT * INTO STRICT existing FROM public.repository_snapshots WHERE repository_id = g.repository_id AND commit_sha = s->>'commitSha'
      AND visibility = s->>'repositoryVisibility' AND identity_version = s->>'snapshotIdentityVersion' AND extraction_policy_version = s->>'extractionPolicyVersion'
      AND extractor_id = v#>>'{extractorBundle,id}' AND extractor_version = v#>>'{extractorBundle,version}'
      AND detector_bundle_id = v#>>'{detectorBundle,id}' AND detector_bundle_version = v#>>'{detectorBundle,version}' AND coverage_version = v->>'coverageManifest' AND security_policy_hash = coalesce(s->>'securityPolicyHash','legacy')
      FOR UPDATE;
    IF existing.sealed_at IS NULL THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    sid := existing.id;
    -- Return the canonical ID; never overwrite its observations with a caller's rescan.
  ELSE
    FOR item IN SELECT value FROM jsonb_array_elements(p_bundle->'files') LOOP
      INSERT INTO public.file_inventory(snapshot_id, locator_id, locator_encrypted, fingerprint, fingerprint_key_version,
          language, size_bytes, classification, eligible, analyzed, exclusion_reason)
        VALUES (sid, (item->>'locatorId')::uuid, item->>'locatorEncrypted', item->>'fingerprint', item->>'fingerprintKeyVersion',
          item->>'language', (item->>'sizeBytes')::bigint, item->>'classification', (item->>'eligible')::boolean, (item->>'analyzed')::boolean, item->>'exclusionReason');
    END LOOP;
    IF (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid) <> (p_bundle#>>'{inventorySummary,totalFiles}')::integer
        OR (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid AND eligible) <> (p_bundle#>>'{inventorySummary,eligibleFiles}')::integer
        OR (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid AND analyzed) <> (p_bundle#>>'{inventorySummary,analyzedFiles}')::integer THEN
      RAISE EXCEPTION 'INCOMPLETE_ANALYSIS';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_bundle->'evidence') LOOP
      obs := item->'observation';
      IF (obs->>'snapshotId')::uuid IS DISTINCT FROM sid OR (obs->>'repositoryId')::uuid IS DISTINCT FROM g.repository_id
          OR obs->>'commitSha' IS DISTINCT FROM s->>'commitSha' OR obs->>'repositoryVisibility' IS DISTINCT FROM s->>'repositoryVisibility'
          OR obs->>'visibility' IS DISTINCT FROM 'owner_only' OR obs ?| ARRAY['locator', 'path', 'source', 'rawSource', 'location', 'fingerprint'] THEN
        RAISE EXCEPTION 'FOREIGN_EVIDENCE';
      END IF;
      INSERT INTO public.evidence_items(id, snapshot_id, locator_kind, file_locator_id, locator_id, locator_encrypted, fingerprint, fingerprint_key_version, detector_id, detector_version, observation)
        VALUES ((obs->>'evidenceId')::uuid, sid, item->>'locatorKind', (item->>'fileLocatorId')::uuid, (item->>'locatorId')::uuid, item->>'locatorEncrypted',
          item->>'fingerprint', item->>'fingerprintKeyVersion', obs#>>'{detector,id}', obs#>>'{detector,version}', obs);
    END LOOP;
    UPDATE public.repository_snapshots SET sealed_at = now() WHERE id = sid;
  END IF;
  -- Each authorized ingestion/reuse records a user-specific receipt. Knowing an ID is insufficient.
  INSERT INTO public.snapshot_receipts(user_id, snapshot_id, repository_id, grant_id)
    VALUES (p_actor, sid, g.repository_id, p_grant) ON CONFLICT DO NOTHING;
  INSERT INTO public.capability_evidence(evidence_id, taxonomy_id, taxonomy_version, capability_id)
    SELECT e.id, v#>>'{taxonomy,id}', v#>>'{taxonomy,version}', c.value
    FROM public.evidence_items e CROSS JOIN LATERAL jsonb_array_elements_text(e.observation->'capabilityIds') c
    WHERE e.snapshot_id = sid ON CONFLICT DO NOTHING;
  RETURN sid;
END $$;


CREATE OR REPLACE FUNCTION public.feature_one_create_run(p_actor uuid, p_job uuid, p_versions jsonb, p_snapshot_ids uuid[], p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.analysis_jobs; sid uuid; s public.repository_snapshots; gid uuid; aid uuid; rid uuid; rubric jsonb; set_hash text;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id = p_job AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF j.status <> 'queued' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
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
  INSERT INTO public.analysis_job_attempts(job_id, user_id, number, status) VALUES (p_job, p_actor, 1, 'running') RETURNING id INTO aid;
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


CREATE FUNCTION feature_one_private.ingestion_report_policy() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.payload->'snapshots') LOOP
    IF coalesce(item->>'securityPolicyHash','legacy') IS DISTINCT FROM coalesce(NEW.payload#>>'{versions,ingestionPolicyHash}','legacy')
      OR NOT EXISTS(SELECT 1 FROM public.repository_snapshots s JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=s.id
        WHERE rs.run_id=NEW.run_id AND s.id=(item->>'snapshotId')::uuid AND s.security_policy_hash=coalesce(item->>'securityPolicyHash','legacy'))
      THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER check_ingestion_report_policy BEFORE INSERT ON public.readiness_reports FOR EACH ROW EXECUTE FUNCTION feature_one_private.ingestion_report_policy();

DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT p.oid::regprocedure AS signature,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='feature_one_private' AND p.proname LIKE 'ingestion_%')
      OR (n.nspname='public' AND (p.proname LIKE 'feature_one_ingestion_%' OR p.proname='feature_one_export_v4')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',item.signature);
    IF item.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',item.signature); END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
