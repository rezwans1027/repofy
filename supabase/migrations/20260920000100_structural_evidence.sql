-- Run 08: safe aggregate exclusions, structural file facts and metadata-sensitive artifact identity.
-- Older sealed artifacts and their public contracts retain legacy defaults.
ALTER TABLE public.repository_snapshots ADD COLUMN artifact_key text NOT NULL DEFAULT 'legacy'
  CHECK(artifact_key='legacy' OR artifact_key ~ '^sha256:[0-9a-f]{64}$');
ALTER TABLE public.repository_snapshots DROP CONSTRAINT snapshot_security_identity;
ALTER TABLE public.repository_snapshots ADD CONSTRAINT snapshot_structural_identity UNIQUE(repository_id,commit_sha,visibility,identity_version,extraction_policy_version,
  extractor_id,extractor_version,detector_bundle_id,detector_bundle_version,coverage_version,security_policy_hash,artifact_key);
ALTER TABLE public.file_inventory ADD COLUMN structure jsonb CHECK(structure IS NULL OR jsonb_typeof(structure)='object');
ALTER TABLE public.evidence_items ADD COLUMN content_fingerprint feature_one_private.digest;
ALTER TABLE public.evidence_items ADD COLUMN content_fingerprint_key_version feature_one_private.version;
ALTER TABLE public.evidence_items ADD CONSTRAINT evidence_content_fingerprint_pair CHECK((content_fingerprint IS NULL)=(content_fingerprint_key_version IS NULL));
CREATE INDEX evidence_source_snapshot ON public.evidence_items(snapshot_id,(observation->>'sourceType'));
CREATE INDEX file_inventory_language_state ON public.file_inventory(snapshot_id,language,analyzed);

CREATE OR REPLACE FUNCTION public.feature_one_store_snapshot(p_actor uuid, p_grant uuid, p_bundle jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants; s jsonb := p_bundle->'snapshot'; v jsonb := p_bundle->'versions';
  sid uuid; item jsonb; obs jsonb; cap text; existing public.repository_snapshots; excluded_count integer := 0;
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
  IF p_bundle#>'{inventorySummary,structural}' IS NOT NULL THEN
    IF p_bundle->>'artifactKey' IS NULL OR jsonb_typeof(p_bundle#>'{inventorySummary,structural,exclusions}') IS DISTINCT FROM 'object'
      OR p_bundle#>'{coverage,structural}' IS NULL THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    IF (p_bundle#>'{inventorySummary,structural,exclusions}') - ARRAY['sensitive_path','dependency','generated','binary','oversized','unsupported_encoding','user_ignored','policy_file','secret_or_sensitive_data'] <> '{}'::jsonb
      OR (SELECT count(*) FROM jsonb_object_keys(p_bundle#>'{inventorySummary,structural,exclusions}')) <> 9
      OR EXISTS(SELECT 1 FROM jsonb_each_text(p_bundle#>'{inventorySummary,structural,exclusions}') WHERE value !~ '^[0-9]{1,5}$' OR value::integer > 50000)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    SELECT coalesce(sum(value::integer),0) INTO excluded_count FROM jsonb_each_text(p_bundle#>'{inventorySummary,structural,exclusions}');
    IF excluded_count < 0 OR excluded_count <> (p_bundle#>>'{inventorySummary,excludedFiles}')::integer
      OR (p_bundle#>>'{inventorySummary,totalFiles}')::integer <> excluded_count + (p_bundle#>>'{inventorySummary,eligibleFiles}')::integer
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_bundle->'files') f WHERE NOT (f->>'eligible')::boolean)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END IF;
  INSERT INTO public.repository_snapshots(id, repository_id, commit_sha, visibility, branch_encrypted,
      identity_version, extraction_policy_version, extractor_id, extractor_version, detector_bundle_id,
      detector_bundle_version, coverage_version, security_policy_hash, artifact_key, inventory_summary, coverage, created_at)
    VALUES ((s->>'snapshotId')::uuid, g.repository_id, s->>'commitSha', s->>'repositoryVisibility', p_bundle->>'branchEncrypted',
      s->>'snapshotIdentityVersion', s->>'extractionPolicyVersion', v#>>'{extractorBundle,id}', v#>>'{extractorBundle,version}',
      v#>>'{detectorBundle,id}', v#>>'{detectorBundle,version}', v->>'coverageManifest', coalesce(s->>'securityPolicyHash','legacy'),
      coalesce(p_bundle->>'artifactKey','legacy'), p_bundle->'inventorySummary', p_bundle->'coverage', (s->>'createdAt')::timestamptz)
    ON CONFLICT (repository_id, commit_sha, visibility, identity_version, extraction_policy_version,
      extractor_id, extractor_version, detector_bundle_id, detector_bundle_version, coverage_version, security_policy_hash, artifact_key) DO NOTHING
    RETURNING id INTO sid;
  IF sid IS NULL THEN
    SELECT * INTO STRICT existing FROM public.repository_snapshots WHERE repository_id = g.repository_id AND commit_sha = s->>'commitSha'
      AND visibility = s->>'repositoryVisibility' AND identity_version = s->>'snapshotIdentityVersion' AND extraction_policy_version = s->>'extractionPolicyVersion'
      AND extractor_id = v#>>'{extractorBundle,id}' AND extractor_version = v#>>'{extractorBundle,version}'
      AND detector_bundle_id = v#>>'{detectorBundle,id}' AND detector_bundle_version = v#>>'{detectorBundle,version}' AND coverage_version = v->>'coverageManifest' AND security_policy_hash = coalesce(s->>'securityPolicyHash','legacy') AND artifact_key = coalesce(p_bundle->>'artifactKey','legacy')
      FOR UPDATE;
    IF existing.sealed_at IS NULL THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    sid := existing.id;
    -- Return the canonical ID; never overwrite its observations with a caller's rescan.
  ELSE
    FOR item IN SELECT value FROM jsonb_array_elements(p_bundle->'files') LOOP
      INSERT INTO public.file_inventory(snapshot_id, locator_id, locator_encrypted, fingerprint, fingerprint_key_version,
          language, size_bytes, classification, eligible, analyzed, exclusion_reason, structure)
        VALUES (sid, (item->>'locatorId')::uuid, item->>'locatorEncrypted', item->>'fingerprint', item->>'fingerprintKeyVersion',
          item->>'language', (item->>'sizeBytes')::bigint, item->>'classification', (item->>'eligible')::boolean, (item->>'analyzed')::boolean, item->>'exclusionReason', item->'structure');
    END LOOP;
    IF (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid) <> (p_bundle#>>'{inventorySummary,totalFiles}')::integer - excluded_count
        OR (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid AND eligible) <> (p_bundle#>>'{inventorySummary,eligibleFiles}')::integer
        OR (SELECT count(*) FROM public.file_inventory WHERE snapshot_id = sid AND analyzed) <> (p_bundle#>>'{inventorySummary,analyzedFiles}')::integer THEN
      RAISE EXCEPTION 'INCOMPLETE_ANALYSIS';
    END IF;
    IF EXISTS(SELECT 1 FROM public.file_inventory f WHERE f.snapshot_id=sid AND f.structure->>'projectLocatorId' IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.file_inventory p WHERE p.snapshot_id=sid AND p.locator_id=(f.structure->>'projectLocatorId')::uuid))
      THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_bundle->'evidence') LOOP
      obs := item->'observation';
      IF (obs->>'snapshotId')::uuid IS DISTINCT FROM sid OR (obs->>'repositoryId')::uuid IS DISTINCT FROM g.repository_id
          OR obs->>'commitSha' IS DISTINCT FROM s->>'commitSha' OR obs->>'repositoryVisibility' IS DISTINCT FROM s->>'repositoryVisibility'
          OR obs->>'visibility' IS DISTINCT FROM 'owner_only' OR obs ?| ARRAY['locator', 'path', 'source', 'rawSource', 'location', 'fingerprint'] THEN
        RAISE EXCEPTION 'FOREIGN_EVIDENCE';
      END IF;
      IF obs#>'{structural,provider}' IS NOT NULL AND (item->>'locatorKind' IS DISTINCT FROM 'provider_metadata'
        OR (obs#>>'{structural,provider,relationship}' = 'exact_commit' AND obs#>>'{structural,provider,subjectSha}' IS DISTINCT FROM s->>'commitSha'))
        THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(obs#>'{structural,associatedFileIds}','[]'::jsonb)) ref
        WHERE NOT EXISTS(SELECT 1 FROM public.file_inventory f WHERE f.snapshot_id=sid AND f.locator_id=ref.value::uuid AND f.eligible))
        THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
      INSERT INTO public.evidence_items(id, snapshot_id, locator_kind, file_locator_id, locator_id, locator_encrypted, fingerprint, fingerprint_key_version, detector_id, detector_version, observation, content_fingerprint, content_fingerprint_key_version)
        VALUES ((obs->>'evidenceId')::uuid, sid, item->>'locatorKind', (item->>'fileLocatorId')::uuid, (item->>'locatorId')::uuid, item->>'locatorEncrypted',
          item->>'fingerprint', item->>'fingerprintKeyVersion', obs#>>'{detector,id}', obs#>>'{detector,version}', obs, item#>>'{contentFingerprint,digest}', item#>>'{contentFingerprint,keyVersion}');
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


CREATE OR REPLACE FUNCTION public.feature_one_export(p_actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'githubAccounts', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]') FROM public.github_accounts a WHERE user_id = p_actor),
    'installations', (SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]') FROM public.github_installations i WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.installation_id = i.id AND g.user_id = p_actor)),
    'repositories', (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'metadata_encrypted'), '[]') FROM public.repositories r WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.repository_id = r.id AND g.user_id = p_actor)),
    'snapshotReceipts', (SELECT coalesce(jsonb_agg(to_jsonb(receipt)), '[]') FROM public.snapshot_receipts receipt WHERE user_id = p_actor),
    'snapshots', (SELECT coalesce(jsonb_agg(to_jsonb(s) - ARRAY['branch_encrypted','artifact_key']), '[]') FROM public.repository_snapshots s WHERE EXISTS (SELECT 1 FROM public.snapshot_receipts receipt WHERE receipt.snapshot_id = s.id AND receipt.user_id = p_actor)),
    'files', (SELECT coalesce(jsonb_agg(to_jsonb(f) - ARRAY['locator_encrypted', 'fingerprint', 'fingerprint_key_version']), '[]') FROM public.file_inventory f WHERE EXISTS (SELECT 1 FROM public.snapshot_receipts receipt WHERE receipt.snapshot_id = f.snapshot_id AND receipt.user_id = p_actor)),
    'evidence', (SELECT coalesce(jsonb_agg(e.observation), '[]') FROM public.evidence_items e WHERE EXISTS (SELECT 1 FROM public.snapshot_receipts receipt WHERE receipt.snapshot_id = e.snapshot_id AND receipt.user_id = p_actor)),
    'accessGrants', (SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]') FROM public.repository_access_grants g WHERE user_id = p_actor),
    'jobs', (SELECT coalesce(jsonb_agg(to_jsonb(j)), '[]') FROM public.analysis_jobs j WHERE user_id = p_actor),
    'attempts', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]') FROM public.analysis_job_attempts a WHERE user_id = p_actor),
    'runs', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM public.analysis_runs r WHERE user_id = p_actor),
    'runSnapshots', (SELECT coalesce(jsonb_agg(to_jsonb(rs)), '[]') FROM public.analysis_run_snapshots rs WHERE user_id = p_actor),
    'reports', (SELECT coalesce(jsonb_agg(payload), '[]') FROM public.readiness_reports WHERE user_id = p_actor),
    'auditEvents', (SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]') FROM public.audit_events e WHERE actor_id = p_actor),
    'modelRuns', (SELECT coalesce(jsonb_agg(to_jsonb(m) - ARRAY['input_fingerprint', 'fingerprint_key_version', 'api_usage_id']), '[]') FROM public.model_runs m WHERE user_id = p_actor)
  );
$$;

REVOKE ALL ON FUNCTION public.feature_one_store_snapshot(uuid,uuid,jsonb), public.feature_one_export(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feature_one_store_snapshot(uuid,uuid,jsonb), public.feature_one_export(uuid) TO service_role;
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
    OR coalesce(policy->>'version','') NOT IN ('1.0.0','1.1.0') OR policy->>'scanner' IS DISTINCT FROM 'repofy-static-secrets-1.0.0'
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

NOTIFY pgrst,'reload schema';
