-- Reachability and lexical-binding corrections have a new detector identity.
-- Structural extractors and coverage calculations are unchanged. Detector 1.0.2
-- composes with the same 1.0.1 extractors and 1.1.1/1.2.1 coverage declarations.
-- Historical definitions and sealed reports remain valid and immutable.
INSERT INTO feature_one_private.implementation_detectors(bundle_version,kind,capabilities,maximum_strength)
  SELECT '1.0.2',kind,capabilities,maximum_strength FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.1';

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
  IF base_version NOT IN ('1.0.0','1.0.1','1.0.2') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
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
NOTIFY pgrst, 'reload schema';
