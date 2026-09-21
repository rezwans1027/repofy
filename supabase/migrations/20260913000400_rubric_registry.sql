-- Versioned domain definitions. Import/activation is migration-owner only, never an app write API.
ALTER TABLE public.role_templates ADD COLUMN definition jsonb;
ALTER TABLE public.role_requirements ADD COLUMN definition jsonb;

CREATE TABLE public.feature_one_taxonomy_versions (
  taxonomy_id text NOT NULL,
  version feature_one_private.version NOT NULL,
  manifest jsonb NOT NULL,
  PRIMARY KEY (taxonomy_id, version)
);
CREATE TABLE public.feature_one_rubric_releases (
  release_id text PRIMARY KEY CHECK (release_id ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (taxonomy_id, taxonomy_version) REFERENCES public.feature_one_taxonomy_versions(taxonomy_id, version)
);
CREATE TABLE public.feature_one_active_rubrics (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  release_id text NOT NULL REFERENCES public.feature_one_rubric_releases(release_id),
  activated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.role_requirement_capabilities (
  role_id text NOT NULL,
  role_version feature_one_private.version NOT NULL,
  requirement_id text NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  PRIMARY KEY (role_id, role_version, requirement_id, capability_id),
  FOREIGN KEY (role_id, role_version, requirement_id) REFERENCES public.role_requirements(role_id, role_version, capability_id),
  FOREIGN KEY (taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_definitions(taxonomy_id, taxonomy_version, capability_id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['feature_one_taxonomy_versions', 'feature_one_rubric_releases', 'feature_one_active_rubrics', 'role_requirement_capabilities'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END $$;
CREATE TRIGGER immutable_taxonomy BEFORE UPDATE OR DELETE ON public.feature_one_taxonomy_versions
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();
CREATE TRIGGER immutable_release BEFORE UPDATE OR DELETE ON public.feature_one_rubric_releases
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.immutable_row();

CREATE FUNCTION feature_one_private.published_rubric_content() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE row_data jsonb; rid text; rv text;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME = 'capability_definitions' THEN
    IF EXISTS (SELECT 1 FROM public.feature_one_taxonomy_versions WHERE taxonomy_id = row_data->>'taxonomy_id' AND version = row_data->>'taxonomy_version') THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION';
    END IF;
  ELSE
    rid := row_data->>'role_id'; rv := coalesce(row_data->>'role_version', row_data->>'version');
    IF EXISTS (SELECT 1 FROM public.feature_one_rubric_releases r, jsonb_array_elements(r.manifest->'rubrics') rubric
      WHERE rubric->>'roleId' = rid AND rubric->>'version' = rv) THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seal_published_capabilities BEFORE INSERT OR DELETE ON public.capability_definitions
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.published_rubric_content();
CREATE TRIGGER seal_published_templates BEFORE INSERT OR DELETE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.published_rubric_content();
CREATE TRIGGER seal_published_requirements BEFORE INSERT OR DELETE ON public.role_requirements
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.published_rubric_content();
CREATE TRIGGER seal_published_components BEFORE INSERT OR UPDATE OR DELETE ON public.role_requirement_capabilities
  FOR EACH ROW EXECUTE FUNCTION feature_one_private.published_rubric_content();

CREATE FUNCTION feature_one_private.check_rubric_version(p_previous text, p_next text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE previous_parts int[]; next_parts int[];
BEGIN
  IF p_next IS NULL OR p_next !~ '^1\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$' THEN RAISE EXCEPTION 'UNSUPPORTED_VERSION_TRANSITION'; END IF;
  IF p_previous IS NULL THEN
    IF p_next <> '1.0.0' THEN RAISE EXCEPTION 'UNSUPPORTED_VERSION_TRANSITION'; END IF;
  ELSE
    previous_parts := string_to_array(p_previous, '.')::int[]; next_parts := string_to_array(p_next, '.')::int[];
    IF NOT ((next_parts[2] = previous_parts[2] AND next_parts[3] = previous_parts[3] + 1)
      OR (next_parts[2] = previous_parts[2] + 1 AND next_parts[3] = 0)) THEN RAISE EXCEPTION 'UNSUPPORTED_VERSION_TRANSITION'; END IF;
  END IF;
END $$;

CREATE FUNCTION feature_one_private.import_rubric_release(p_manifest jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE tax jsonb; cap jsonb; rubric jsonb; requirement jsonb; component jsonb;
  stored jsonb; previous_version text; tid text; tv text; rid text; rv text; release_key text; total numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(826402, 3);
  release_key := p_manifest->>'releaseId'; tax := p_manifest->'taxonomy'; tid := tax->>'id'; tv := tax->>'version';
  SELECT manifest INTO stored FROM public.feature_one_rubric_releases WHERE release_id = release_key;
  IF FOUND THEN
    IF stored IS DISTINCT FROM p_manifest THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
    RETURN;
  END IF;
  IF p_manifest->>'contractVersion' IS DISTINCT FROM '1.0.0' OR p_manifest->>'manifestVersion' IS DISTINCT FROM '1.0.0'
    OR jsonb_array_length(p_manifest->'rubrics') IS DISTINCT FROM 5
    OR (SELECT count(DISTINCT value->>'roleId') FROM jsonb_array_elements(p_manifest->'rubrics')) <> 5
    OR jsonb_array_length(tax->'categories') IS DISTINCT FROM 14
    OR (SELECT count(DISTINCT value->>'categoryId') FROM jsonb_array_elements(tax->'categories')) <> 14
    OR (SELECT count(DISTINCT value->>'groupId') FROM jsonb_array_elements(tax->'capabilities')) <> 14
    OR jsonb_array_length(tax->'capabilities') NOT BETWEEN 14 AND 100
    OR (SELECT count(DISTINCT value->>'capabilityId') FROM jsonb_array_elements(tax->'capabilities')) IS DISTINCT FROM jsonb_array_length(tax->'capabilities')
    THEN RAISE EXCEPTION 'INVALID_RUBRIC_MANIFEST'; END IF;

  SELECT manifest INTO stored FROM public.feature_one_taxonomy_versions WHERE taxonomy_id = tid AND version = tv;
  IF FOUND THEN
    IF stored IS DISTINCT FROM tax THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
  ELSE
    SELECT version INTO previous_version FROM public.feature_one_taxonomy_versions WHERE taxonomy_id = tid
      ORDER BY string_to_array(version::text, '.')::int[] DESC LIMIT 1;
    PERFORM feature_one_private.check_rubric_version(previous_version, tv);
    FOR cap IN SELECT value FROM jsonb_array_elements(tax->'capabilities') LOOP
      IF cap->>'taxonomyVersion' IS DISTINCT FROM tv OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tax->'categories') c WHERE c->>'categoryId' = cap->>'groupId')
        OR cap#>>'{presencePolicy,maximumStrength}' IS DISTINCT FROM '0.39'
        OR cap->>'kind' NOT IN ('engineering_behavior', 'technology_signal', 'provenance_signal') THEN RAISE EXCEPTION 'INVALID_RUBRIC_MANIFEST'; END IF;
      INSERT INTO public.capability_definitions(taxonomy_id, taxonomy_version, capability_id, group_id, definition)
        VALUES (tid, tv, cap->>'capabilityId', cap->>'groupId', cap);
    END LOOP;
    INSERT INTO public.feature_one_taxonomy_versions(taxonomy_id, version, manifest) VALUES (tid, tv, tax);
  END IF;

  FOR rubric IN SELECT value FROM jsonb_array_elements(p_manifest->'rubrics') LOOP
    rid := rubric->>'roleId'; rv := rubric->>'version';
    IF rubric->>'taxonomyId' IS DISTINCT FROM tid OR rubric->>'taxonomyVersion' IS DISTINCT FROM tv
      OR rubric->>'contractVersion' IS DISTINCT FROM '1.0.0'
      OR rubric->>'calibration' IS DISTINCT FROM 'uncalibrated'
      OR rubric#>>'{availability,externalRollout}' IS DISTINCT FROM 'false'
      OR rubric#>>'{coveragePolicy,denominator}' IS DISTINCT FROM 'all_requirement_weights'
      OR rubric#>>'{coveragePolicy,unknownRequirements}' IS DISTINCT FROM 'retain_weight_report_separately'
      THEN RAISE EXCEPTION 'INVALID_RUBRIC_MANIFEST'; END IF;
    SELECT definition INTO stored FROM public.role_templates WHERE role_id = rid AND version = rv;
    IF FOUND THEN
      IF stored IS DISTINCT FROM rubric THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
      CONTINUE;
    END IF;
    SELECT version INTO previous_version FROM public.role_templates WHERE role_id = rid AND definition IS NOT NULL
      ORDER BY string_to_array(version::text, '.')::int[] DESC LIMIT 1;
    PERFORM feature_one_private.check_rubric_version(previous_version, rv);
    IF jsonb_array_length(rubric->'requirements') NOT BETWEEN 1 AND 100
      OR (SELECT count(DISTINCT value->>'requirementId') FROM jsonb_array_elements(rubric->'requirements')) IS DISTINCT FROM jsonb_array_length(rubric->'requirements')
      THEN RAISE EXCEPTION 'INVALID_RUBRIC_MANIFEST'; END IF;
    SELECT sum((value->>'weight')::numeric) INTO total FROM jsonb_array_elements(rubric->'requirements');
    IF total IS NULL OR total = 'NaN'::numeric OR abs(total - 1) >= 0.000001 THEN RAISE EXCEPTION 'INVALID_RUBRIC_WEIGHTS'; END IF;
    INSERT INTO public.role_templates(role_id, version, taxonomy_id, taxonomy_version, name, definition)
      VALUES (rid, rv, tid, tv, rubric->>'name', rubric);
    FOR requirement IN SELECT value FROM jsonb_array_elements(rubric->'requirements') LOOP
      IF requirement->>'version' IS DISTINCT FROM rv
        OR requirement->>'requirementId' IS DISTINCT FROM requirement->>'capabilityId'
        OR NOT (requirement->'capabilityIds' @> jsonb_build_array(requirement->>'capabilityId'))
        OR jsonb_array_length(requirement->'capabilityIds') NOT BETWEEN 1 AND 10
        OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(requirement->'capabilityIds')) IS DISTINCT FROM jsonb_array_length(requirement->'capabilityIds')
        OR requirement#>>'{aggregation,operator}' IS DISTINCT FROM 'all'
        OR requirement#>>'{aggregation,strength}' IS DISTINCT FROM 'minimum'
        OR requirement#>>'{aggregation,confidence}' IS DISTINCT FROM 'minimum'
        OR requirement#>>'{evidencePolicy,assessability}' IS DISTINCT FROM 'all_capabilities'
        OR requirement#>>'{evidencePolicy,presenceOnlyMaximumStrength}' IS DISTINCT FROM '0.39'
        OR coalesce(requirement#>>'{evidencePolicy,minimumConfidence}', '') NOT IN ('low', 'moderate', 'high')
        OR coalesce((requirement#>>'{evidencePolicy,minimumImplementationClusters}')::int, 0) NOT BETWEEN 1 AND 10
        OR coalesce((requirement#>>'{evidencePolicy,minimumCorroboratingClusters}')::int, -1) NOT BETWEEN 0 AND 10
        OR coalesce((requirement->>'minimumEvidence')::numeric, -1) NOT BETWEEN 0.4 AND 1
        OR ((requirement->>'minimumEvidence')::numeric >= 0.65 AND (
          (requirement#>>'{evidencePolicy,minimumCorroboratingClusters}')::int < 1
          OR NOT (requirement#>'{evidencePolicy,corroboratingFamilies}' <@ '["test","ci"]'::jsonb)))
        THEN RAISE EXCEPTION 'INVALID_RUBRIC_POLICY'; END IF;
      INSERT INTO public.role_requirements(role_id, role_version, taxonomy_id, taxonomy_version, capability_id, weight, minimum_evidence, required, definition)
        VALUES (rid, rv, tid, tv, requirement->>'capabilityId', (requirement->>'weight')::numeric,
          (requirement->>'minimumEvidence')::numeric, (requirement->>'required')::boolean, requirement);
      FOR component IN SELECT value FROM jsonb_array_elements(requirement->'capabilityIds') LOOP
        IF NOT EXISTS (SELECT 1 FROM public.capability_definitions WHERE taxonomy_id = tid AND taxonomy_version = tv
          AND capability_id = component#>>'{}' AND definition->>'kind' = 'engineering_behavior') THEN RAISE EXCEPTION 'INVALID_CAPABILITY_REFERENCE'; END IF;
        INSERT INTO public.role_requirement_capabilities VALUES (rid, rv, requirement->>'requirementId', tid, tv, component#>>'{}');
      END LOOP;
    END LOOP;
  END LOOP;
  INSERT INTO public.feature_one_rubric_releases(release_id, taxonomy_id, taxonomy_version, manifest)
    VALUES (release_key, tid, tv, p_manifest);
END $$;

CREATE FUNCTION feature_one_private.activate_rubric_release(p_release_id text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(826402, 3);
  IF NOT EXISTS (SELECT 1 FROM public.feature_one_rubric_releases WHERE release_id = p_release_id) THEN RAISE EXCEPTION 'UNKNOWN_RUBRIC_RELEASE'; END IF;
  INSERT INTO public.feature_one_active_rubrics(singleton, release_id) VALUES (true, p_release_id)
    ON CONFLICT (singleton) DO UPDATE SET release_id = excluded.release_id, activated_at = now();
END $$;

CREATE FUNCTION public.feature_one_read_rubric_catalog(p_actor uuid, p_release_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  SELECT manifest INTO result FROM public.feature_one_rubric_releases
    WHERE release_id = coalesce(p_release_id, (SELECT release_id FROM public.feature_one_active_rubrics WHERE singleton));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION feature_one_private.published_rubric_content() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION feature_one_private.check_rubric_version(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION feature_one_private.import_rubric_release(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION feature_one_private.activate_rubric_release(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.feature_one_read_rubric_catalog(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.feature_one_read_rubric_catalog(uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';
