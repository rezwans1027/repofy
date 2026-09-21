-- Review corrections: append analyzer definitions instead of changing sealed policy identities.
-- Both historical and corrected snapshots retain their exact version relationships.
INSERT INTO feature_one_private.implementation_detectors(bundle_version,kind,capabilities,maximum_strength)
  SELECT '1.0.1',kind,capabilities,maximum_strength FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.0';
INSERT INTO feature_one_private.analyzer_coverage_manifests(version,declaration)
  SELECT '1.2.1'||substring(version from 6),
    jsonb_set(declaration,'{version}',to_jsonb('1.2.1'||substring(version from 6)))
  FROM feature_one_private.analyzer_coverage_manifests WHERE split_part(version,'-',1)='1.2.0';

CREATE OR REPLACE FUNCTION feature_one_private.validate_implementation_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE detail jsonb := NEW.observation->'implementation'; o jsonb := NEW.observation; s public.repository_snapshots;
  definition feature_one_private.implementation_detectors; f public.file_inventory; ref jsonb; target public.file_inventory; boundary text;
BEGIN
  IF detail IS NULL THEN
    IF NEW.detector_id LIKE 'tsjs.%' THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.repository_snapshots WHERE id=NEW.snapshot_id;
  SELECT * INTO definition FROM feature_one_private.implementation_detectors WHERE bundle_version=split_part(s.detector_bundle_version,'-',1) AND kind=detail->>'kind';
  IF definition.kind IS NULL OR s.coverage->'implementation' IS NULL OR s.detector_bundle_id <> 'tsjs_implementation'
    OR NEW.detector_id IS DISTINCT FROM 'tsjs.' || definition.kind OR NEW.detector_version IS DISTINCT FROM definition.bundle_version
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

CREATE OR REPLACE FUNCTION feature_one_private.validate_implementation_seal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c jsonb := NEW.coverage->'implementation'; row jsonb; definition feature_one_private.implementation_detectors; expected text;
  kinds text[] := ARRAY['route_service','request_validation','authentication_guard','ownership_guard','structured_error','form_validation','request_state','accessible_action','parameterized_query','transaction','schema_constraint','bounded_retry','state_guard','failure_cleanup','asserted_call','bounded_model_output'];
  bits text := ''; k text; base_version text := split_part(NEW.detector_bundle_version,'-',1); expected_coverage text;
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
  IF base_version NOT IN ('1.0.0','1.0.1') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  expected_coverage := CASE base_version WHEN '1.0.0' THEN '1.1.0' ELSE '1.1.1' END;
  expected := base_version || CASE WHEN bits LIKE '%1%' THEN '-q' || bits ELSE '' END;
  IF NEW.detector_bundle_id <> 'tsjs_implementation' OR NEW.detector_bundle_version <> expected OR (NEW.coverage_version <> expected_coverage AND NOT EXISTS (SELECT 1 FROM feature_one_private.analyzer_coverage_manifests WHERE version=NEW.coverage_version AND split_part(version,'-',1)=CASE base_version WHEN '1.0.0' THEN '1.2.0' ELSE '1.2.1' END))
    OR (NEW.coverage_version=expected_coverage AND (NEW.extractor_id<>'structural_inventory' OR NEW.extractor_version<>base_version OR NEW.extraction_policy_version<>base_version))
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

CREATE OR REPLACE FUNCTION feature_one_private.validate_language_coverage_seal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a jsonb:=NEW.coverage->'assessment'; declaration jsonb; c jsonb; item jsonb; impl jsonb:=NEW.coverage->'implementation';
  total integer; eligible integer; analyzed integer; excluded integer; n integer; done integer; observed integer; impl_done integer;
  cap text; families text[]; kinds text[]; has_detector boolean; enabled boolean; metadata_assessed boolean; metadata_records integer;
  expected_state text; expected_depth text; expected_version text; i integer; states text[]:=ARRAY['analyzed','parse_failure','limited','unsupported','generated'];
  counters text[]:=ARRAY['analyzedFiles','parseFailures','limitedFiles','unsupportedFiles','generatedFiles'];
BEGIN
  IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL THEN RETURN NEW; END IF;
  IF a IS NULL THEN
    IF NEW.extractor_id='language_inventory' OR EXISTS(SELECT 1 FROM feature_one_private.analyzer_coverage_manifests WHERE version=NEW.coverage_version)
      OR EXISTS(SELECT 1 FROM public.file_inventory WHERE snapshot_id=NEW.id AND structure ? 'coverage') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    RETURN NEW;
  END IF;
  SELECT m.declaration INTO declaration FROM feature_one_private.analyzer_coverage_manifests m WHERE version=NEW.coverage_version;
  expected_version:=(CASE split_part(NEW.coverage_version,'-',1) WHEN '1.2.0' THEN '1.0.0' WHEN '1.2.1' THEN '1.0.1' END)||substring(NEW.coverage_version from 6);
  IF expected_version IS NULL OR declaration IS NULL OR a->'declaration' IS DISTINCT FROM declaration OR NEW.extractor_id<>'language_inventory'
    OR NEW.extractor_version<>expected_version OR NEW.extraction_policy_version<>expected_version OR impl IS NULL
    OR a-ARRAY['declaration','state','result','reasons','counts','languages','capabilities']<>'{}'::jsonb
    OR NOT coalesce(feature_one_private.coverage_reasons_valid(a->'reasons'),false)
    OR NOT (a->'reasons') ?& ARRAY['runtime_not_assessed','uncalibrated']
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  SELECT count(*),count(*) FILTER(WHERE f.analyzed) INTO eligible,analyzed FROM public.file_inventory f WHERE snapshot_id=NEW.id;
  excluded:=(NEW.inventory_summary->>'excludedFiles')::integer; total:=eligible+excluded; c:=a->'counts';
  IF c IS DISTINCT FROM jsonb_build_object('totalFiles',total,'eligibleFiles',eligible,'excludedFiles',excluded,'analyzedFiles',analyzed,'unparsedFiles',eligible-analyzed,
    'analyzedFractionOfAllFiles',CASE WHEN total=0 THEN NULL ELSE analyzed::double precision/total END)
    OR (excluded>0 AND NOT (a->'reasons') ? 'security_exclusions')
    OR ((impl->>'limitedFiles')::integer>0 AND NOT (a->'reasons') ?& ARRAY['reduced_scan','parse_budget_exhausted'])
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  IF EXISTS(SELECT 1 FROM public.file_inventory f WHERE snapshot_id=NEW.id AND (
    f.structure->>'processing' IS NULL OR f.analyzed IS DISTINCT FROM (f.structure->>'processing'='analyzed')
    OR f.structure#>>'{coverage,source}' NOT IN ('source','tests','manifests','configuration','schemas','documentation','ci')
    OR f.structure#>>'{coverage,parser}' NOT IN ('python','java','maven','structural.source','structural.tests','structural.manifests','structural.configuration','structural.schemas','structural.documentation','structural.ci')
    OR f.structure->'coverage' IS NULL OR (f.structure->'coverage')-ARRAY['source','parser','reasons','implementation']<>'{}'::jsonb
    OR NOT coalesce(feature_one_private.coverage_reasons_valid(f.structure#>'{coverage,reasons}'),false)
    OR NOT (a->'reasons') @> (f.structure#>'{coverage,reasons}')
    OR f.structure#>>'{coverage,implementation}' NOT IN ('not_applicable','analyzed','parse_failure','unsupported','limited','generated')
    OR (f.language IN ('typescript','javascript') AND f.classification IN ('code','test')) IS DISTINCT FROM (f.structure#>>'{coverage,implementation}'<>'not_applicable')
    OR (f.structure#>>'{coverage,implementation}'='analyzed' AND NOT f.analyzed)
    OR ((declaration->'disabledParsers') ? (f.structure#>>'{coverage,parser}') AND (f.analyzed OR NOT (f.structure#>'{coverage,reasons}') ? 'parser_disabled'))
  )) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR i IN 1..5 LOOP
    IF (impl->>counters[i])::integer<>(SELECT count(*) FROM public.file_inventory WHERE snapshot_id=NEW.id AND structure#>>'{coverage,implementation}'=states[i])
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  IF jsonb_typeof(a->'languages') IS DISTINCT FROM 'array'
    OR jsonb_array_length(a->'languages')<>(SELECT count(DISTINCT language) FROM public.file_inventory WHERE snapshot_id=NEW.id)
    OR (SELECT count(DISTINCT value->>'language') FROM jsonb_array_elements(a->'languages'))<>jsonb_array_length(a->'languages') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(a->'languages') LOOP
    SELECT count(*),count(*) FILTER(WHERE f.analyzed),count(*) FILTER(WHERE structure#>>'{coverage,implementation}'='analyzed') INTO n,done,impl_done
      FROM public.file_inventory f WHERE snapshot_id=NEW.id AND language=item->>'language';
    expected_depth:=CASE WHEN impl_done>0 THEN 'bounded_patterns' WHEN EXISTS(SELECT 1 FROM public.file_inventory f WHERE snapshot_id=NEW.id AND language=item->>'language' AND f.analyzed AND structure->>'depth'='structural') THEN 'baseline' ELSE 'inventory' END;
    IF n=0 OR item->>'eligibleFiles' IS DISTINCT FROM n::text OR item->>'analyzedFiles' IS DISTINCT FROM done::text OR item->>'unparsedFiles' IS DISTINCT FROM (n-done)::text
      OR item->>'implementationAnalyzedFiles' IS DISTINCT FROM impl_done::text OR item->>'depth' IS DISTINCT FROM expected_depth
      OR NOT coalesce(feature_one_private.coverage_reasons_valid(item->'reasons'),false)
      OR item-ARRAY['language','depth','eligibleFiles','analyzedFiles','unparsedFiles','implementationAnalyzedFiles','reasons']<>'{}'::jsonb
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  IF jsonb_typeof(a->'capabilities') IS DISTINCT FROM 'array' OR jsonb_array_length(a->'capabilities')<>34
    OR (SELECT count(DISTINCT value->>'capabilityId') FROM jsonb_array_elements(a->'capabilities'))<>34
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(a->'capabilities') LOOP
    cap:=item->>'capabilityId';
    IF NOT EXISTS(SELECT 1 FROM public.capability_definitions WHERE taxonomy_id='engineering_capabilities' AND taxonomy_version='1.0.0' AND capability_id=cap)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    families:=CASE cap WHEN 'language_presence' THEN ARRAY['source','tests'] WHEN 'framework_presence' THEN ARRAY['manifests','configuration']
      WHEN 'data_modeling' THEN ARRAY['schemas'] WHEN 'delivery_automation' THEN ARRAY['ci'] WHEN 'delivery_reproducibility' THEN ARRAY['configuration']
      WHEN 'documentation_operability' THEN ARRAY['documentation'] WHEN 'documentation_decisions' THEN ARRAY['documentation'] ELSE ARRAY[]::text[] END;
    kinds:=CASE cap WHEN 'language_presence' THEN ARRAY['structure'] WHEN 'framework_presence' THEN ARRAY['dependency','configuration']
      WHEN 'data_modeling' THEN ARRAY['schema'] WHEN 'delivery_automation' THEN ARRAY['workflow'] WHEN 'delivery_reproducibility' THEN ARRAY['container']
      WHEN 'documentation_operability' THEN ARRAY['documentation'] WHEN 'documentation_decisions' THEN ARRAY['documentation'] ELSE ARRAY[]::text[] END;
    SELECT count(*)>0,coalesce(bool_or(NOT (impl->'disabledDetectors') ? kind),false) INTO has_detector,enabled FROM feature_one_private.implementation_detectors WHERE bundle_version=split_part(NEW.detector_bundle_version,'-',1) AND capabilities ? cap;
    SELECT count(*),count(*) FILTER(WHERE CASE WHEN structure#>>'{coverage,source}'=ANY(families) THEN f.analyzed AND structure->>'depth'='structural'
      ELSE enabled AND structure#>>'{coverage,implementation}'='analyzed' END) INTO n,done
      FROM public.file_inventory f WHERE snapshot_id=NEW.id AND ((has_detector AND classification IN ('code','test') AND structure#>>'{coverage,source}' IN ('source','tests')) OR structure#>>'{coverage,source}'=ANY(families));
    SELECT count(*) INTO observed FROM public.evidence_items e WHERE snapshot_id=NEW.id AND feature_one_private.coverage_meaningful(e.observation)
      AND ((e.observation ? 'implementation' AND enabled AND (e.observation->'capabilityIds') ? cap)
        OR (NOT e.observation ? 'implementation' AND e.observation#>>'{structural,kind}'=ANY(kinds)
          AND (cap<>'framework_presence' OR jsonb_array_length(e.observation#>'{structural,technologies}')>0)
          AND (cap<>'documentation_decisions' OR coalesce((e.observation#>>'{structural,counts,architectureHeadings}')::integer,0)>0))
        OR (cap='provenance_history' AND e.observation#>>'{structural,kind}' IN ('commit','pull_request')));
    SELECT coalesce(bool_or(value->>'state' IN ('available','no_signal','truncated')),false),coalesce(sum((value->>'records')::integer),0) INTO metadata_assessed,metadata_records
      FROM jsonb_array_elements(NEW.coverage#>'{structural,metadata}') WHERE cap='provenance_history' AND value->>'source' IN ('commits','pullRequests');
    expected_state:=CASE WHEN done=0 AND NOT metadata_assessed THEN 'not_assessable' WHEN observed=0 THEN 'evidence_not_observed_within_assessed_scope'
      WHEN cap='language_presence' AND done=n AND excluded=0 THEN 'assessable' ELSE 'partially_assessable' END;
    expected_depth:=CASE WHEN has_detector THEN 'bounded_patterns' WHEN cardinality(families)>0 OR cap='provenance_history' THEN 'baseline' ELSE 'unsupported' END;
    IF item->>'eligibleFiles' IS DISTINCT FROM n::text OR item->>'analyzedFiles' IS DISTINCT FROM done::text OR item->>'unparsedFiles' IS DISTINCT FROM (n-done)::text
      OR item->>'observations' IS DISTINCT FROM observed::text OR item->>'state' IS DISTINCT FROM expected_state OR item->>'depth' IS DISTINCT FROM expected_depth
      OR item->>'metadataRecords' IS DISTINCT FROM metadata_records::text OR item->'metadataAssessed' IS DISTINCT FROM to_jsonb(metadata_assessed)
      OR item->'confidenceCeiling' IS DISTINCT FROM to_jsonb(CASE WHEN done=0 AND NOT metadata_assessed THEN 0 WHEN has_detector THEN 0.55 ELSE 0.5 END)
      OR NOT coalesce(feature_one_private.coverage_reasons_valid(item->'reasons'),false)
      OR NOT (item->'reasons') ?& ARRAY['runtime_not_assessed','uncalibrated']
      OR (expected_state='not_assessable' AND observed<>0)
      OR (cap LIKE 'mobile_%' AND NOT (item->'reasons') ? 'native_mobile_not_assessed')
      OR (cap LIKE 'ai_%' AND NOT (item->'reasons') ? 'ai_runtime_not_assessed')
      OR item-ARRAY['capabilityId','state','depth','eligibleFiles','analyzedFiles','unparsedFiles','observations','metadataAssessed','metadataRecords','confidenceCeiling','reasons']<>'{}'::jsonb
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END LOOP;
  SELECT count(*) INTO observed FROM public.evidence_items WHERE snapshot_id=NEW.id AND feature_one_private.coverage_meaningful(observation);
  expected_state:=CASE WHEN analyzed=0 THEN 'not_assessable' WHEN observed=0 THEN 'evidence_not_observed_within_assessed_scope'
    WHEN eligible>analyzed OR excluded>0 OR (a->'reasons') ?| ARRAY['reduced_scan','resolution_incomplete','evidence_budget_exhausted','dynamic_configuration','unsupported_depth'] THEN 'partially_assessable' ELSE 'assessable' END;
  IF a->>'state' IS DISTINCT FROM expected_state OR a->>'result' IS DISTINCT FROM (CASE WHEN observed>0 THEN 'evidence_available' ELSE 'insufficient_evidence' END)
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION feature_one_private.validate_structural_detector_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.repository_snapshots; expected text;
BEGIN
  IF NOT NEW.observation ? 'structural' THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.repository_snapshots WHERE id=NEW.snapshot_id;
  IF s.extractor_id NOT IN ('structural_inventory','language_inventory') THEN RETURN NEW; END IF;
  IF split_part(s.extractor_version,'-',1) NOT IN ('1.0.0','1.0.1') THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
  expected := CASE WHEN NEW.detector_id='structural.schemas.schema' THEN split_part(s.extractor_version,'-',1) ELSE '1.0.0' END;
  IF NEW.detector_version IS DISTINCT FROM expected THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_structural_detector_version BEFORE INSERT ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.validate_structural_detector_version();
REVOKE ALL ON FUNCTION feature_one_private.validate_structural_detector_version() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION feature_one_private.validate_structural_version_seal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE disabled jsonb := NEW.coverage#>'{structural,disabledExtractors}'; base_version text := split_part(NEW.extractor_version,'-',1);
  kinds text[] := ARRAY['manifests','configuration','tests','ci','schemas','documentation','source']; bits text := ''; kind text; expected text;
BEGIN
  IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL OR (NEW.extractor_id<>'structural_inventory' AND NEW.detector_bundle_id<>'structural_signals')
    OR NEW.coverage ? 'implementation' THEN RETURN NEW; END IF;
  IF base_version NOT IN ('1.0.0','1.0.1') OR jsonb_typeof(disabled) IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(disabled) value WHERE NOT value=ANY(kinds))
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(disabled))<>jsonb_array_length(disabled)
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOREACH kind IN ARRAY kinds LOOP bits := bits || CASE WHEN disabled ? kind THEN '1' ELSE '0' END; END LOOP;
  expected := base_version || CASE WHEN bits LIKE '%1%' THEN '-disabled-' || bits ELSE '' END;
  IF NEW.extractor_id<>'structural_inventory' OR NEW.extractor_version<>expected OR NEW.extraction_policy_version<>expected
    OR NEW.detector_bundle_id<>'structural_signals' OR NEW.detector_bundle_version<>base_version OR NEW.coverage_version<>base_version
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_structural_version_seal BEFORE UPDATE ON public.repository_snapshots
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.validate_structural_version_seal();
REVOKE ALL ON FUNCTION feature_one_private.validate_structural_version_seal() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst, 'reload schema';
