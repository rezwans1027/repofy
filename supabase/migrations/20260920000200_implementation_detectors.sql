-- Run 09: additive immutable detector registry and source/capability membership checks.
-- Historical structural snapshots, report payloads and canonical identity stay unchanged.
CREATE TABLE feature_one_private.implementation_detectors (
  bundle_version text NOT NULL,
  kind text NOT NULL,
  capabilities jsonb NOT NULL CHECK(jsonb_typeof(capabilities)='array'),
  maximum_strength numeric NOT NULL CHECK(maximum_strength BETWEEN 0 AND 0.6),
  PRIMARY KEY(bundle_version,kind)
);
INSERT INTO feature_one_private.implementation_detectors VALUES
 ('1.0.0','route_service','["api_design","architecture_modularity"]',0.55),
 ('1.0.0','request_validation','["api_boundary_validation","security_input_handling"]',0.55),
 ('1.0.0','authentication_guard','["api_boundary_validation"]',0.55),
 ('1.0.0','ownership_guard','["security_authorization"]',0.55),
 ('1.0.0','structured_error','["api_design"]',0.55),
 ('1.0.0','form_validation','["frontend_interaction","security_input_handling"]',0.55),
 ('1.0.0','request_state','["frontend_interaction"]',0.55),
 ('1.0.0','accessible_action','["frontend_accessibility"]',0.4),
 ('1.0.0','parameterized_query','["security_input_handling"]',0.55),
 ('1.0.0','transaction','["data_transactions"]',0.55),
 ('1.0.0','schema_constraint','["data_modeling"]',0.45),
 ('1.0.0','bounded_retry','["reliability_recovery","performance_resources"]',0.55),
 ('1.0.0','state_guard','["reliability_concurrency"]',0.45),
 ('1.0.0','failure_cleanup','["reliability_recovery"]',0.55),
 ('1.0.0','asserted_call','["testing_behavior"]',0.55),
 ('1.0.0','bounded_model_output','["ai_integration"]',0.55);
REVOKE ALL ON feature_one_private.implementation_detectors FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION feature_one_private.immutable_detector_definition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_CONTENT'; END;
$$;
CREATE TRIGGER immutable_detector_definition BEFORE UPDATE OR DELETE ON feature_one_private.implementation_detectors
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_detector_definition();

CREATE FUNCTION feature_one_private.validate_implementation_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE detail jsonb := NEW.observation->'implementation'; o jsonb := NEW.observation; s public.repository_snapshots;
  definition feature_one_private.implementation_detectors; f public.file_inventory; ref jsonb; target public.file_inventory; boundary text;
BEGIN
  IF detail IS NULL THEN
    IF NEW.detector_id LIKE 'tsjs.%' THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.repository_snapshots WHERE id=NEW.snapshot_id;
  SELECT * INTO definition FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.0' AND kind=detail->>'kind';
  IF definition.kind IS NULL OR s.coverage->'implementation' IS NULL OR s.detector_bundle_id <> 'tsjs_implementation'
    OR NEW.detector_id IS DISTINCT FROM 'tsjs.' || definition.kind OR NEW.detector_version IS DISTINCT FROM '1.0.0'
    OR o->'capabilityIds' IS DISTINCT FROM definition.capabilities OR o ? 'structural'
    OR detail->>'confidenceBasis' IS DISTINCT FROM 'resolved_static_pattern' OR detail->>'calibration' IS DISTINCT FROM 'uncalibrated'
    OR coalesce((o->>'confidence')::numeric,1) NOT BETWEEN 0 AND 0.55
    OR coalesce((o->>'strength')::numeric,1) NOT BETWEEN 0 AND definition.maximum_strength
    OR (s.coverage#>'{implementation,disabledDetectors}') ? definition.kind THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
  boundary := CASE WHEN definition.kind='asserted_call' THEN 'assertion_source' WHEN definition.kind='schema_constraint' THEN 'declared_constraint' ELSE 'observed_control' END;
  IF detail->>'claimBoundary' IS DISTINCT FROM boundary OR NEW.locator_kind <> 'file'
    OR o->>'sourceType' IS DISTINCT FROM (CASE WHEN definition.kind='asserted_call' THEN 'test' ELSE 'code' END)
    OR (definition.kind <> 'asserted_call' AND detail->>'testBoundary' IS DISTINCT FROM 'not_a_test')
    OR (definition.kind='asserted_call' AND coalesce(detail->>'testBoundary','') NOT IN ('local_implementation','mocked_or_intercepted'))
    OR (detail->>'testBoundary'='mocked_or_intercepted' AND ((o->>'confidence')::numeric>0.4 OR (o->>'strength')::numeric>0.35))
    THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
  SELECT * INTO f FROM public.file_inventory WHERE snapshot_id=NEW.snapshot_id AND locator_id=NEW.file_locator_id AND analyzed;
  IF f.locator_id IS NULL OR f.language NOT IN ('typescript','javascript') OR f.classification IS DISTINCT FROM o->>'sourceType'
    OR coalesce((detail#>>'{span,lines,start}')::integer,0) < 1
    OR coalesce((detail#>>'{span,lines,end}')::integer,0) < (detail#>>'{span,lines,start}')::integer
    OR coalesce((detail#>>'{span,lines,end}')::integer,2147483647) > (f.structure->>'lines')::integer THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  IF jsonb_typeof(detail->'relations') IS DISTINCT FROM 'array' OR jsonb_array_length(detail->'relations')>20
    OR (definition.kind='asserted_call' AND jsonb_array_length(detail->'relations')=0) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(detail->'relations') LOOP
    SELECT * INTO target FROM public.file_inventory WHERE snapshot_id=NEW.snapshot_id AND locator_id=(ref->>'fileId')::uuid AND analyzed AND classification='code';
    IF target.locator_id IS NULL OR coalesce((ref#>>'{lines,start}')::integer,0)<1
      OR coalesce((ref#>>'{lines,end}')::integer,0)<(ref#>>'{lines,start}')::integer
      OR coalesce((ref#>>'{lines,end}')::integer,2147483647)>(target.structure->>'lines')::integer
      OR ref->>'relationship' IS DISTINCT FROM (CASE WHEN definition.kind='asserted_call' THEN 'asserted_call' ELSE 'local_call' END)
      OR ref->>'independence' IS DISTINCT FROM (CASE WHEN definition.kind<>'asserted_call' THEN 'same_source'
        WHEN detail->>'testBoundary'='mocked_or_intercepted' THEN 'mocked_test' ELSE 'separate_test' END)
      OR (definition.kind='asserted_call' AND target.locator_id=f.locator_id) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_implementation_evidence BEFORE INSERT ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.validate_implementation_evidence();

CREATE FUNCTION feature_one_private.validate_implementation_seal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c jsonb := NEW.coverage->'implementation'; row jsonb; definition feature_one_private.implementation_detectors; expected text;
  kinds text[] := ARRAY['route_service','request_validation','authentication_guard','ownership_guard','structured_error','form_validation','request_state','accessible_action','parameterized_query','transaction','schema_constraint','bounded_retry','state_guard','failure_cleanup','asserted_call','bounded_model_output'];
  bits text := ''; k text;
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
  expected := '1.0.0' || CASE WHEN bits LIKE '%1%' THEN '-q' || bits ELSE '' END;
  IF NEW.detector_bundle_id <> 'tsjs_implementation' OR NEW.detector_bundle_version <> expected OR NEW.coverage_version <> '1.1.0'
    OR c#>>'{bundle,id}' IS DISTINCT FROM NEW.detector_bundle_id OR c#>>'{bundle,version}' IS DISTINCT FROM expected
    OR c->>'calibration' IS DISTINCT FROM 'uncalibrated' OR c->>'scope' IS DISTINCT FROM 'bounded_patterns_only'
    OR jsonb_typeof(c->'detectors') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'detectors')<>16
    OR (SELECT count(DISTINCT value->>'kind') FROM jsonb_array_elements(c->'detectors'))<>16
    OR coalesce((c->>'eligibleFiles')::integer,-1) <> (SELECT count(*) FROM public.file_inventory WHERE snapshot_id=NEW.id AND eligible AND language IN ('typescript','javascript') AND classification IN ('code','test'))
    OR (c->>'eligibleFiles')::integer <> (c->>'analyzedFiles')::integer+(c->>'parseFailures')::integer+(c->>'limitedFiles')::integer+(c->>'unsupportedFiles')::integer+(c->>'generatedFiles')::integer
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(c->'detectors') LOOP
    SELECT * INTO definition FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.0' AND kind=row->>'kind';
    IF definition.kind IS NULL OR row->>'version' IS DISTINCT FROM '1.0.0' OR row->'capabilityIds' IS DISTINCT FROM definition.capabilities
      OR row->>'state' IS DISTINCT FROM (CASE WHEN (c->'disabledDetectors') ? definition.kind THEN 'quarantined' ELSE 'enabled' END)
      OR coalesce((row->>'observations')::integer,-1) <> (SELECT count(*) FROM public.evidence_items WHERE snapshot_id=NEW.id AND detector_id='tsjs.' || definition.kind)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_implementation_seal BEFORE UPDATE ON public.repository_snapshots
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.validate_implementation_seal();
REVOKE ALL ON FUNCTION feature_one_private.immutable_detector_definition(),feature_one_private.validate_implementation_evidence(),feature_one_private.validate_implementation_seal() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst, 'reload schema';
