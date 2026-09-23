-- Register state-guard correction 1.0.4 and quote-aware SQL screening policy 1.1.1.
-- Preserve prior detector definitions, policy pins and sealed reports.
INSERT INTO feature_one_private.implementation_detectors(bundle_version,kind,capabilities,maximum_strength)
  SELECT '1.0.4',kind,capabilities,maximum_strength FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.3';

CREATE OR REPLACE FUNCTION feature_one_private.validate_implementation_seal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c jsonb := NEW.coverage->'implementation'; row jsonb; definition feature_one_private.implementation_detectors; expected text;
  kinds text[] := ARRAY['route_service','request_validation','authentication_guard','ownership_guard','structured_error','form_validation','request_state','accessible_action','parameterized_query','transaction','schema_constraint','bounded_retry','state_guard','failure_cleanup','asserted_call','bounded_model_output'];
  bits text := ''; k text; base_version text := split_part(NEW.detector_bundle_version,'-',1); expected_coverage text; expected_extractor text;
BEGIN
  IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL THEN RETURN NEW; END IF;
  IF c IS NULL THEN
    IF NEW.detector_bundle_id='tsjs_implementation' THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    RETURN NEW;
  END IF;
  IF jsonb_typeof(c->'disabledDetectors') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'disabledDetectors') value WHERE NOT value=ANY(kinds))
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(c->'disabledDetectors')) <> jsonb_array_length(c->'disabledDetectors')
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['eligibleFiles','analyzedFiles','parseFailures','limitedFiles','unsupportedFiles','generatedFiles','noSignalFiles','unresolvedImports','dynamicReferences','ambiguousBindings','indexedNodes','indexedBytes','aliasConfigurationsRejected']) key
      WHERE coalesce(c->>key,'') !~ '^[0-9]{1,9}$')
    OR (c->>'noSignalFiles')::integer>(c->>'analyzedFiles')::integer OR (c->>'analyzedFiles')::integer>256
    OR (c->>'indexedNodes')::integer>100001 OR (c->>'indexedBytes')::integer>2097152
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOREACH k IN ARRAY kinds LOOP bits := bits || CASE WHEN (c->'disabledDetectors') ? k THEN '1' ELSE '0' END; END LOOP;
  IF base_version NOT IN ('1.0.0','1.0.1','1.0.2','1.0.3','1.0.4') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  expected_extractor := CASE base_version WHEN '1.0.0' THEN '1.0.0' ELSE '1.0.1' END;
  expected_coverage := CASE base_version WHEN '1.0.0' THEN '1.1.0' ELSE '1.1.1' END;
  expected := base_version || CASE WHEN bits LIKE '%1%' THEN '-q' || bits ELSE '' END;
  IF NEW.detector_bundle_id <> 'tsjs_implementation' OR NEW.detector_bundle_version <> expected OR (NEW.coverage_version <> expected_coverage AND NOT EXISTS (SELECT 1 FROM feature_one_private.analyzer_coverage_manifests WHERE version=NEW.coverage_version AND split_part(version,'-',1)=CASE base_version WHEN '1.0.0' THEN '1.2.0' ELSE '1.2.1' END))
    OR (NEW.coverage_version=expected_coverage AND (NEW.extractor_id<>'structural_inventory' OR NEW.extractor_version<>expected_extractor OR NEW.extraction_policy_version<>expected_extractor))
    OR c#>>'{bundle,id}' IS DISTINCT FROM NEW.detector_bundle_id OR c#>>'{bundle,version}' IS DISTINCT FROM expected
    OR c->>'calibration' IS DISTINCT FROM 'uncalibrated' OR c->>'scope' IS DISTINCT FROM 'bounded_patterns_only'
    OR jsonb_typeof(c->'detectors') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'detectors')<>16
    OR (SELECT count(DISTINCT value->>'kind') FROM jsonb_array_elements(c->'detectors'))<>16
    OR coalesce((c->>'eligibleFiles')::integer,-1) <> (SELECT count(*) FROM public.file_inventory WHERE snapshot_id=NEW.id AND eligible AND language IN ('typescript','javascript') AND classification IN ('code','test'))
    OR (c->>'eligibleFiles')::integer <> (c->>'analyzedFiles')::integer+(c->>'parseFailures')::integer+(c->>'limitedFiles')::integer+(c->>'unsupportedFiles')::integer+(c->>'generatedFiles')::integer
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(c->'detectors') LOOP
    SELECT * INTO definition FROM feature_one_private.implementation_detectors WHERE bundle_version=base_version AND kind=row->>'kind';
    IF definition.kind IS NULL OR row->>'version' IS DISTINCT FROM base_version OR row->'capabilityIds' IS DISTINCT FROM definition.capabilities
      OR row->>'state' IS DISTINCT FROM (CASE WHEN (c->'disabledDetectors') ? definition.kind THEN 'quarantined' ELSE 'enabled' END)
      OR coalesce((row->>'observations')::integer,-1) <> (SELECT count(*) FROM public.evidence_items WHERE snapshot_id=NEW.id AND detector_id='tsjs.' || definition.kind)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION feature_one_private.validate_implementation_seal() FROM PUBLIC,anon,authenticated,service_role;

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
    OR coalesce(policy->>'version','') NOT IN ('1.0.0','1.1.0','1.1.1') OR policy->>'scanner' IS DISTINCT FROM 'repofy-static-secrets-1.0.0'
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
