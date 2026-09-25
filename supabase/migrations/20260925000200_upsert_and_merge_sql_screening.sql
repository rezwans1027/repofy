-- Register UPSERT and optional-INTO MERGE screening as security policy 1.1.4.
-- Preserve every existing pin; corrected runs cannot reuse older policy hashes.
CREATE OR REPLACE FUNCTION public.feature_one_ingestion_pin(p_actor uuid,p_job uuid,p_repository uuid,p_pin jsonb)
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
    OR coalesce(policy->>'version','') NOT IN ('1.0.0','1.1.0','1.1.1','1.1.2','1.1.3','1.1.4') OR policy->>'scanner' IS DISTINCT FROM 'repofy-static-secrets-1.0.0'
    OR policy->>'exclusions' IS DISTINCT FROM 'repofy-exclusions-' || (policy->>'version') OR policy->>'ignore' IS DISTINCT FROM 'ignore-7.0.9-subset-1.0.0'
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

NOTIFY pgrst, 'reload schema';
