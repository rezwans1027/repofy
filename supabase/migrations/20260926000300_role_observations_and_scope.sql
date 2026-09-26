-- Expanded bounded role observations and scope classification. Prior policies,
-- detector registries and sealed artifacts retain their original semantics.
INSERT INTO feature_one_private.implementation_detectors(bundle_version,kind,capabilities,maximum_strength)
 SELECT '2.0.0',kind,capabilities,maximum_strength FROM feature_one_private.implementation_detectors WHERE bundle_version='1.0.6';
INSERT INTO feature_one_private.implementation_detectors VALUES
 ('2.0.0','labelled_control','["frontend_accessibility","frontend_interaction"]',0.55),
 ('2.0.0','native_accessible_action','["frontend_accessibility","frontend_interaction"]',0.55),
 ('2.0.0','state_transition','["frontend_state"]',0.55),
 ('2.0.0','validated_boundary','["architecture_modularity","architecture_boundaries","security_input_handling"]',0.55),
 ('2.0.0','mobile_subscription','["mobile_lifecycle"]',0.55),
 ('2.0.0','mobile_navigation','["mobile_navigation"]',0.55),
 ('2.0.0','mobile_cache','["mobile_offline","reliability_recovery"]',0.55),
 ('2.0.0','secret_configuration','["security_secrets"]',0.55),
 ('2.0.0','secure_storage','["security_secrets"]',0.55),
 ('2.0.0','resource_guard','["security_authorization"]',0.55),
 ('2.0.0','model_context','["ai_context"]',0.55),
 ('2.0.0','model_action_guard','["ai_safety"]',0.55),
 ('2.0.0','evaluation_harness','["ai_evaluation"]',0.55),
 ('2.0.0','safe_diagnostic','["observability_diagnostics"]',0.55),
 ('2.0.0','health_probe','["observability_health"]',0.55),
 ('2.0.0','asserted_failure','["testing_failures","testing_behavior"]',0.55),
 ('2.0.0','asserted_ui','["testing_behavior"]',0.55),
 ('2.0.0','asserted_value','["testing_behavior"]',0.55);

INSERT INTO feature_one_private.analyzer_coverage_manifests(version,declaration)
SELECT '1.3.0'||substring(version from 6),
 jsonb_set(jsonb_set(declaration,'{version}',to_jsonb('1.3.0'||substring(version from 6))),'{entries}',
 (SELECT jsonb_agg(CASE WHEN entry->>'id'='tsjs' THEN jsonb_set(entry,'{capabilities}',
   (SELECT jsonb_agg(cap ORDER BY cap) FROM (SELECT DISTINCT jsonb_array_elements_text(capabilities) cap
     FROM feature_one_private.implementation_detectors WHERE bundle_version='2.0.0') capabilities)) ELSE entry END ORDER BY ordinal)
  FROM jsonb_array_elements(declaration->'entries') WITH ORDINALITY entries(entry,ordinal)))
FROM feature_one_private.analyzer_coverage_manifests WHERE split_part(version,'-',1)='1.2.1';

INSERT INTO feature_one_private.aggregation_policies(id,version,definition)
SELECT id,'3.0.0',definition||'{"version":"3.0.0","scopeExclusions":"known_non_source_v1","testCorroboration":"separate_success_failure_v1"}'::jsonb
FROM feature_one_private.aggregation_policies WHERE id='evidence_aggregation' AND version='2.0.0';
INSERT INTO feature_one_private.aggregation_policies(id,version,definition)
SELECT id,'3.1.0',definition||'{"version":"3.1.0","provenance":"context_only_v1"}'::jsonb
FROM feature_one_private.aggregation_policies WHERE id='evidence_aggregation' AND version='3.0.0';

CREATE OR REPLACE FUNCTION public.feature_one_ingestion_ready(p_actor uuid,p_attempt uuid,p_token uuid,p_summary jsonb,p_files jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; count_files integer := jsonb_array_length(p_files); exclusions bigint; n bigint; lim jsonb;
BEGIN
  PERFORM public.feature_one_ingestion_checkpoint(p_actor,p_attempt,p_token);
  IF (SELECT state FROM feature_one_private.ingestion_attempts WHERE id=p_attempt) <> 'active' THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  SELECT p.policy->'limits' INTO lim FROM feature_one_private.ingestion_pins p JOIN feature_one_private.ingestion_attempts a ON a.pin_id=p.id WHERE a.id=p_attempt;
  IF p_summary - ARRAY['archiveEntries','totalFiles','eligibleFiles','textBytes','totalLines','decompressedBytes','excluded','scope','semanticAnalysis','nonSourceExcludedFiles'] <> '{}'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(p_summary)) <> (CASE WHEN p_summary ? 'nonSourceExcludedFiles' THEN 10 ELSE 9 END)
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
  IF coalesce((p_summary->>'nonSourceExcludedFiles')::bigint,0) NOT BETWEEN 0 AND
    coalesce((p_summary#>>'{excluded,policy_file}')::bigint,0)+coalesce((p_summary#>>'{excluded,binary}')::bigint,0)+coalesce((p_summary#>>'{excluded,sensitive_path}')::bigint,0)
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
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
  boundary := CASE WHEN definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') THEN 'assertion_source' WHEN definition.kind='schema_constraint' THEN 'declared_constraint' ELSE 'observed_control' END;
  IF detail->>'claimBoundary' IS DISTINCT FROM boundary OR NEW.locator_kind <> 'file'
    OR o->>'sourceType' IS DISTINCT FROM (CASE WHEN definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') THEN 'test' ELSE 'code' END)
    OR (definition.kind NOT IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') AND detail->>'testBoundary' IS DISTINCT FROM 'not_a_test')
    OR (definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') AND coalesce(detail->>'testBoundary','') NOT IN ('local_implementation','mocked_or_intercepted'))
    OR (detail->>'testBoundary'='mocked_or_intercepted' AND ((o->>'confidence')::numeric>0.4 OR (o->>'strength')::numeric>0.35))
    THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
  SELECT * INTO f FROM public.file_inventory WHERE snapshot_id=NEW.snapshot_id AND locator_id=NEW.file_locator_id AND analyzed;
  IF f.locator_id IS NULL OR f.language NOT IN ('typescript','javascript') OR f.classification IS DISTINCT FROM o->>'sourceType'
    OR coalesce((detail#>>'{span,lines,start}')::integer,0) < 1
    OR coalesce((detail#>>'{span,lines,end}')::integer,0) < (detail#>>'{span,lines,start}')::integer
    OR coalesce((detail#>>'{span,lines,end}')::integer,2147483647) > (f.structure->>'lines')::integer THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  IF jsonb_typeof(detail->'relations') IS DISTINCT FROM 'array' OR jsonb_array_length(detail->'relations')>20
    OR (definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') AND jsonb_array_length(detail->'relations')=0) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(detail->'relations') LOOP
    SELECT * INTO target FROM public.file_inventory WHERE snapshot_id=NEW.snapshot_id AND locator_id=(ref->>'fileId')::uuid AND analyzed AND classification='code';
    IF target.locator_id IS NULL OR coalesce((ref#>>'{lines,start}')::integer,0)<1
      OR coalesce((ref#>>'{lines,end}')::integer,0)<(ref#>>'{lines,start}')::integer
      OR coalesce((ref#>>'{lines,end}')::integer,2147483647)>(target.structure->>'lines')::integer
      OR ref->>'relationship' IS DISTINCT FROM (CASE WHEN definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') THEN 'asserted_call' ELSE 'local_call' END)
      OR ref->>'independence' IS DISTINCT FROM (CASE WHEN definition.kind NOT IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') THEN 'same_source'
        WHEN detail->>'testBoundary'='mocked_or_intercepted' THEN 'mocked_test' ELSE 'separate_test' END)
      OR (definition.kind IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') AND target.locator_id=f.locator_id) THEN RAISE EXCEPTION 'FOREIGN_EVIDENCE'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

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
  IF base_version='2.0.0' THEN kinds:=kinds||ARRAY['labelled_control','native_accessible_action','state_transition','validated_boundary','mobile_subscription','mobile_navigation','mobile_cache','secret_configuration','secure_storage','resource_guard','model_context','model_action_guard','evaluation_harness','safe_diagnostic','health_probe','asserted_failure','asserted_ui','asserted_value']; END IF;
  IF jsonb_typeof(c->'disabledDetectors') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'disabledDetectors') value WHERE NOT value=ANY(kinds))
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(c->'disabledDetectors')) <> jsonb_array_length(c->'disabledDetectors')
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['eligibleFiles','analyzedFiles','parseFailures','limitedFiles','unsupportedFiles','generatedFiles','noSignalFiles','unresolvedImports','dynamicReferences','ambiguousBindings','indexedNodes','indexedBytes','aliasConfigurationsRejected']) key
      WHERE coalesce(c->>key,'') !~ '^[0-9]{1,9}$')
    OR (c->>'noSignalFiles')::integer>(c->>'analyzedFiles')::integer OR (c->>'analyzedFiles')::integer>256
    OR (c->>'indexedNodes')::integer>100001 OR (c->>'indexedBytes')::integer>2097152
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  FOREACH k IN ARRAY kinds LOOP bits := bits || CASE WHEN (c->'disabledDetectors') ? k THEN '1' ELSE '0' END; END LOOP;
  IF base_version NOT IN ('1.0.0','1.0.1','1.0.2','1.0.3','1.0.4','1.0.5','1.0.6','2.0.0') THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  expected_extractor := CASE base_version WHEN '1.0.0' THEN '1.0.0' ELSE '1.0.1' END;
  expected_coverage := CASE base_version WHEN '1.0.0' THEN '1.1.0' ELSE '1.1.1' END;
  expected := base_version || CASE WHEN bits LIKE '%1%' THEN '-q' || bits ELSE '' END;
  IF NEW.detector_bundle_id <> 'tsjs_implementation' OR NEW.detector_bundle_version <> expected OR (NEW.coverage_version <> expected_coverage AND NOT EXISTS (SELECT 1 FROM feature_one_private.analyzer_coverage_manifests WHERE version=NEW.coverage_version AND split_part(version,'-',1)=CASE base_version WHEN '1.0.0' THEN '1.2.0' WHEN '2.0.0' THEN '1.3.0' ELSE '1.2.1' END))
    OR (NEW.coverage_version=expected_coverage AND (NEW.extractor_id<>'structural_inventory' OR NEW.extractor_version<>expected_extractor OR NEW.extraction_policy_version<>expected_extractor))
    OR c#>>'{bundle,id}' IS DISTINCT FROM NEW.detector_bundle_id OR c#>>'{bundle,version}' IS DISTINCT FROM expected
    OR c->>'calibration' IS DISTINCT FROM 'uncalibrated' OR c->>'scope' IS DISTINCT FROM 'bounded_patterns_only'
    OR jsonb_typeof(c->'detectors') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'detectors')<>cardinality(kinds)
    OR (SELECT count(DISTINCT value->>'kind') FROM jsonb_array_elements(c->'detectors'))<>cardinality(kinds)
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
  total integer; eligible integer; analyzed integer; excluded integer; non_source integer:=0; expanded boolean:=split_part(NEW.coverage_version,'-',1)='1.3.0'; n integer; done integer; observed integer; impl_done integer;
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
  expected_version:=(CASE split_part(NEW.coverage_version,'-',1) WHEN '1.2.0' THEN '1.0.0' WHEN '1.2.1' THEN '1.0.1' WHEN '1.3.0' THEN '1.0.1' END)||substring(NEW.coverage_version from 6);
  IF expected_version IS NULL OR declaration IS NULL OR a->'declaration' IS DISTINCT FROM declaration OR NEW.extractor_id<>'language_inventory'
    OR NEW.extractor_version<>expected_version OR NEW.extraction_policy_version<>expected_version OR impl IS NULL
    OR a-ARRAY['declaration','state','result','reasons','counts','languages','capabilities']<>'{}'::jsonb
    OR NOT coalesce(feature_one_private.coverage_reasons_valid(a->'reasons'),false)
    OR NOT (a->'reasons') ?& ARRAY['runtime_not_assessed','uncalibrated']
    THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  SELECT count(*),count(*) FILTER(WHERE f.analyzed) INTO eligible,analyzed FROM public.file_inventory f WHERE snapshot_id=NEW.id;
  excluded:=(NEW.inventory_summary->>'excludedFiles')::integer; total:=eligible+excluded; c:=a->'counts';
  IF expanded THEN
    IF coalesce(NEW.inventory_summary->>'nonSourceExcludedFiles','') !~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    non_source:=(NEW.inventory_summary->>'nonSourceExcludedFiles')::integer;
    IF non_source NOT BETWEEN 0 AND excluded OR non_source>
      coalesce((NEW.inventory_summary#>>'{structural,exclusions,policy_file}')::integer,0)+coalesce((NEW.inventory_summary#>>'{structural,exclusions,binary}')::integer,0)+coalesce((NEW.inventory_summary#>>'{structural,exclusions,sensitive_path}')::integer,0)
      THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
  END IF;
  IF c IS DISTINCT FROM jsonb_build_object('totalFiles',total,'eligibleFiles',eligible,'excludedFiles',excluded,'analyzedFiles',analyzed,'unparsedFiles',eligible-analyzed,
    'analyzedFractionOfAllFiles',CASE WHEN total=0 THEN NULL ELSE analyzed::double precision/total END)||(CASE WHEN expanded THEN jsonb_build_object('nonSourceExcludedFiles',non_source) ELSE '{}'::jsonb END)
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
      OR (expanded AND ((item->'reasons') ? 'security_exclusions') IS DISTINCT FROM (excluded>non_source))
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

CREATE OR REPLACE FUNCTION public.feature_one_job_provenance_context(p_job uuid,p_token uuid,p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; prior jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions#>>'{aggregationPolicy,version}' NOT IN ('1.1.0','2.1.0','3.1.0') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  SELECT payload INTO prior FROM feature_one_private.analysis_provenance WHERE run_id=r.id;
  RETURN jsonb_build_object('prior',prior,'snapshots',(SELECT jsonb_agg(jsonb_build_object('snapshotId',s.id,'repositoryId',s.repository_id,'commitSha',s.commit_sha,
    'providerRepositoryId',repo.provider_repository_id,'visibility',s.visibility,'accountId',g.github_account_id,'installationId',g.installation_id,
    'totalFiles',(s.inventory_summary->>'totalFiles')::int,'exclusions',s.inventory_summary#>'{structural,exclusions}','generatedMarked',coalesce((s.coverage#>>'{implementation,generatedFiles}')::int,0),
    'history',(SELECT value FROM jsonb_array_elements(s.coverage#>'{structural,metadata}') WHERE value->>'source'='commits'),
    'commits',(SELECT coalesce(jsonb_agg(jsonb_build_object('match',e.observation#>>'{structural,provider,authorMatch}','relationship',e.observation#>>'{structural,provider,relationship}','parents',e.observation#>'{structural,counts,parents}')),'[]')
      FROM public.evidence_items e WHERE e.snapshot_id=s.id AND e.observation#>>'{structural,kind}'='commit')) ORDER BY s.id)
    FROM public.analysis_run_snapshots rs JOIN public.repository_snapshots s ON s.id=rs.snapshot_id JOIN public.repositories repo ON repo.id=s.repository_id JOIN public.repository_access_grants g ON g.id=rs.grant_id WHERE rs.run_id=r.id));
END $$;

CREATE OR REPLACE FUNCTION public.feature_one_job_provenance_store(p_job uuid,p_token uuid,p_run uuid,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.analysis_runs; item jsonb; prior jsonb; context jsonb; source jsonb; expected_history jsonb; expected_files jsonb; expected_signals jsonb;
  records int; connected int; others int; unlinked int; history_state text; only_root boolean;
BEGIN
  PERFORM feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions#>>'{aggregationPolicy,version}' NOT IN ('1.1.0','2.1.0','3.1.0') OR p_result->'policy' IS DISTINCT FROM '{"id":"provenance_context","version":"1.0.0"}'::jsonb
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

CREATE OR REPLACE FUNCTION public.feature_one_job_aggregation_input(p_job uuid,p_token uuid,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q feature_one_private.analysis_execution; r public.analysis_runs; catalog jsonb;
BEGIN
  q:=feature_one_private.analysis_fence(p_job,p_token);
  SELECT * INTO r FROM public.analysis_runs WHERE id=p_run AND job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.versions IS DISTINCT FROM q.policy->'versions' OR NOT (r.versions->'aggregationPolicy' IN ('{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"1.1.0"}'::jsonb,'{"id":"evidence_aggregation","version":"2.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"2.1.0"}'::jsonb,'{"id":"evidence_aggregation","version":"3.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"3.1.0"}'::jsonb)) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
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
      FROM public.evidence_items e JOIN public.analysis_run_snapshots rs ON rs.snapshot_id=e.snapshot_id WHERE rs.run_id=r.id)) || CASE WHEN r.versions#>>'{aggregationPolicy,version}' IN ('1.1.0','2.1.0','3.1.0') THEN jsonb_build_object('provenance',(SELECT payload FROM feature_one_private.analysis_provenance WHERE run_id=r.id)) ELSE '{}'::jsonb END;
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
    OR NOT (p_result->'policy' IN ('{"id":"evidence_aggregation","version":"1.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"1.1.0"}'::jsonb,'{"id":"evidence_aggregation","version":"2.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"2.1.0"}'::jsonb,'{"id":"evidence_aggregation","version":"3.0.0"}'::jsonb,'{"id":"evidence_aggregation","version":"3.1.0"}'::jsonb)) THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM feature_one_private.aggregation_policies WHERE id=p_result#>>'{policy,id}' AND version=p_result#>>'{policy,version}') THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
  IF p_result#>>'{policy,version}' IN ('1.1.0','2.1.0','3.1.0') THEN
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
      IF p_result#>>'{policy,version}' IN ('3.0.0','3.1.0') AND cov->'nonSourceExcludedFiles' IS DISTINCT FROM
        coalesce(snap.coverage#>'{assessment,counts,nonSourceExcludedFiles}','0'::jsonb) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      expected:=CASE WHEN s IS NULL OR s->>'state'='not_assessable' THEN 0
        WHEN (cov->>'eligibleFiles')::numeric+(cov->>'excludedFiles')::numeric-CASE WHEN p_result#>>'{policy,version}' IN ('3.0.0','3.1.0') THEN coalesce((cov->>'nonSourceExcludedFiles')::numeric,0) ELSE 0 END>0 THEN round((cov->>'analyzedFiles')::numeric/((cov->>'eligibleFiles')::numeric+(cov->>'excludedFiles')::numeric-CASE WHEN p_result#>>'{policy,version}' IN ('3.0.0','3.1.0') THEN coalesce((cov->>'nonSourceExcludedFiles')::numeric,0) ELSE 0 END),6)
        WHEN (cov->>'metadataAssessed')::boolean THEN 1 ELSE 0 END;
      IF (cov->>'fraction')::numeric IS DISTINCT FROM expected THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
      IF p_result#>>'{policy,version}' IN ('2.0.0','2.1.0','3.0.0','3.1.0') AND cov->'reasons' IS DISTINCT FROM
        (SELECT coalesce(jsonb_agg(reason ORDER BY reason),'[]') FROM jsonb_array_elements_text(coalesce(s->'reasons','["legacy_coverage_unknown"]')) reason)
        THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
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
          OR e.observation#>>'{implementation,testBoundary}' IS DISTINCT FROM 'local_implementation' OR NOT (EXISTS(
            SELECT 1 FROM jsonb_array_elements(e.observation#>'{implementation,relations}') rel JOIN public.evidence_items member ON member.id=base.id
            WHERE rel->>'fileId'=member.file_locator_id::text AND rel->>'conceptId'=member.observation#>>'{implementation,conceptId}'
              AND rel->>'symbolId'=member.observation#>>'{implementation,symbolId}' AND rel->>'independence'='separate_test'
              AND rel->>'relationship'='asserted_call' AND (rel#>>'{lines,start}')::int<=(member.observation#>>'{implementation,span,lines,start}')::int AND (rel#>>'{lines,end}')::int>=(member.observation#>>'{implementation,span,lines,end}')::int) OR (p_result#>>'{policy,version}' IN ('3.0.0','3.1.0')
          AND base.observation#>>'{implementation,testBoundary}'='local_implementation'
          AND base.observation#>>'{implementation,kind}' IN ('asserted_call','asserted_failure','asserted_ui','asserted_value')
          AND e.observation#>>'{implementation,kind}' IN ('asserted_call','asserted_failure','asserted_ui','asserted_value')
          AND (base.observation#>>'{implementation,kind}'='asserted_failure')<>(e.observation#>>'{implementation,kind}'='asserted_failure')
          AND base.content_fingerprint IS DISTINCT FROM e.content_fingerprint
          AND base.observation#>>'{implementation,patternId}' IS DISTINCT FROM e.observation#>>'{implementation,patternId}'
          AND EXISTS(SELECT 1 FROM jsonb_array_elements(base.observation#>'{implementation,relations}') br,
            jsonb_array_elements(e.observation#>'{implementation,relations}') er
            WHERE br->>'independence'='separate_test' AND er->>'independence'='separate_test'
              AND br->>'fileId'=er->>'fileId' AND br->>'conceptId'=er->>'conceptId' AND br->>'symbolId'=er->>'symbolId'))) THEN RAISE EXCEPTION 'UNSUPPORTED_CLAIM'; END IF;
        total:=total+.1;
      END LOOP;
      IF (cl->>'strength')::numeric IS DISTINCT FROM round(least(expected,(cl->>'baseStrength')::numeric+total),6) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END LOOP;
    IF cap->>'state'='assessed' THEN
      SELECT value INTO cl FROM jsonb_array_elements(cap#>'{trace,clusters}') WHERE value->>'clusterId'=cap#>>'{trace,selectedClusterId}';
      IF cl IS NULL OR (cap->>'strength')::numeric IS DISTINCT FROM (cl->>'strength')::numeric OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(cap#>'{trace,clusters}') c WHERE (c->>'strength')::numeric>(cl->>'strength')::numeric) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    END IF;
    IF cap->'provenance' IS DISTINCT FROM jsonb_build_object('state','unknown','value',NULL,'policy',CASE WHEN p_result#>>'{policy,version}' IN ('1.1.0','2.1.0','3.1.0') THEN 'context_only_v1' ELSE 'not_inferred_v1' END) THEN RAISE EXCEPTION 'INCOMPLETE_ANALYSIS'; END IF;
    allowed:='[]';
    IF cap->>'state'='assessed' THEN
      SELECT * INTO base FROM public.evidence_items WHERE id=(cl->>'baseEvidenceId')::uuid;
      IF base.observation->'implementation' IS NOT NULL AND base.observation#>>'{implementation,kind}' NOT IN ('asserted_call','asserted_failure','asserted_ui','asserted_value') THEN allowed:=allowed||'"repository_behavior"'::jsonb; END IF;
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
      IF p_result#>>'{policy,version}' IN ('2.0.0','2.1.0','3.0.0','3.1.0') THEN
        -- Confidence qualifies a mapped observation only, never a whole capability.
        label:=CASE WHEN expected>=.5 AND cap->>'state'='assessed'
          AND base.observation->'implementation' IS NOT NULL
          AND base.observation#>>'{implementation,testBoundary}' IS DISTINCT FROM 'mocked_or_intercepted'
          AND p_result->'validation'='[]'::jsonb
          AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cap#>'{trace,coverage}') c
            WHERE c->>'state'='not_assessable' OR (c->>'fraction')::numeric<>1
              OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'reasons') reason
                WHERE reason NOT IN ('ai_runtime_not_assessed','native_mobile_not_assessed','no_observed_evidence',
                  'runtime_not_assessed','uncalibrated','unsupported_depth','unsupported_version')))
          THEN 'moderate' ELSE 'low' END;
      ELSE
      label:=CASE WHEN expected>=.5 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cap#>'{trace,coverage}') c WHERE c->>'state'<>'assessable' OR (c->>'fraction')::numeric<>1) THEN 'moderate' ELSE 'low' END;
      END IF;
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

REVOKE ALL ON FUNCTION feature_one_private.validate_implementation_evidence(),feature_one_private.validate_implementation_seal(),
 feature_one_private.validate_language_coverage_seal() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.feature_one_ingestion_ready(uuid,uuid,uuid,jsonb,jsonb),public.feature_one_job_provenance_context(uuid,uuid,uuid),
 public.feature_one_job_provenance_store(uuid,uuid,uuid,jsonb),public.feature_one_job_aggregation_input(uuid,uuid,uuid),public.feature_one_job_aggregation_store(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feature_one_ingestion_ready(uuid,uuid,uuid,jsonb,jsonb),public.feature_one_job_provenance_context(uuid,uuid,uuid),
 public.feature_one_job_provenance_store(uuid,uuid,uuid,jsonb),public.feature_one_job_aggregation_input(uuid,uuid,uuid),public.feature_one_job_aggregation_store(uuid,uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
