-- Trusted backend entry points. None are callable by browser roles.
CREATE FUNCTION feature_one_private.require_grant(p_actor uuid, p_grant uuid)
RETURNS public.repository_access_grants LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE g public.repository_access_grants;
BEGIN
  SELECT * INTO g FROM public.repository_access_grants WHERE id = p_grant AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM 1 FROM public.github_accounts WHERE id = g.github_account_id AND user_id = p_actor AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND OR g.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  PERFORM 1 FROM public.github_installations WHERE id = g.installation_id AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  RETURN g;
END $$;

CREATE FUNCTION public.feature_one_bind_grant(p_actor uuid, p_facts jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid; i uuid; r uuid; g uuid;
BEGIN
  -- The caller must have verified these provider facts. This is not a GitHub adapter.
  -- Protect legacy verified links as well as the new multiple-identity table.
  IF EXISTS (SELECT 1 FROM public.github_tokens WHERE github_user_id::text = p_facts->>'providerUserId' AND user_id <> p_actor) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  INSERT INTO public.github_accounts(user_id, provider_user_id, login, verified_at)
    VALUES (p_actor, p_facts->>'providerUserId', p_facts->>'login', (p_facts->>'verifiedAt')::timestamptz)
    ON CONFLICT (provider_user_id) DO UPDATE SET login = excluded.login, verified_at = excluded.verified_at
      WHERE github_accounts.user_id = p_actor AND github_accounts.revoked_at IS NULL
    RETURNING id INTO a;
  IF a IS NULL THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  INSERT INTO public.github_installations(provider_installation_id, provider_owner_id, owner_type, status, last_verified_at)
    VALUES (p_facts->>'providerInstallationId', p_facts->>'providerOwnerId', p_facts->>'ownerType', 'active', (p_facts->>'verifiedAt')::timestamptz)
    ON CONFLICT (provider_installation_id) DO UPDATE SET last_verified_at = excluded.last_verified_at
      WHERE github_installations.status = 'active'
        AND github_installations.provider_owner_id = excluded.provider_owner_id AND github_installations.owner_type = excluded.owner_type
    RETURNING id INTO i;
  IF i IS NULL THEN RAISE EXCEPTION 'ACCESS_REVOKED'; END IF;
  INSERT INTO public.repositories(provider_repository_id, visibility)
    VALUES (p_facts->>'providerRepositoryId', p_facts->>'visibility')
    ON CONFLICT (provider_repository_id) DO UPDATE SET visibility = excluded.visibility, updated_at = now()
    RETURNING id INTO r;
  INSERT INTO public.repository_access_grants(user_id, github_account_id, installation_id, repository_id,
      attestation_id, statement_version, attested_at, verified_at)
    VALUES (p_actor, a, i, r, (p_facts->>'attestationId')::uuid, p_facts->>'statementVersion',
      (p_facts->>'attestedAt')::timestamptz, (p_facts->>'verifiedAt')::timestamptz)
    RETURNING id INTO g;
  INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
    VALUES (p_actor, 'grant_verified', 'grant', g, p_request_id);
  RETURN jsonb_build_object('githubAccountId', a, 'installationId', i, 'repositoryId', r, 'grantId', g);
END $$;

CREATE FUNCTION public.feature_one_revoke_grant(p_actor uuid, p_grant uuid, p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.repository_access_grants SET revoked_at = coalesce(revoked_at, now()) WHERE id = p_grant AND user_id = p_actor;
  -- Missing and foreign IDs have the same response and produce no foreign audit event.
  IF FOUND THEN
    INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
      VALUES (p_actor, 'grant_revoked', 'grant', p_grant, p_request_id);
  END IF;
END $$;

CREATE FUNCTION public.feature_one_store_snapshot(p_actor uuid, p_grant uuid, p_bundle jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.repository_access_grants; s jsonb := p_bundle->'snapshot'; v jsonb := p_bundle->'versions';
  sid uuid; item jsonb; obs jsonb; cap text; existing public.repository_snapshots;
BEGIN
  g := feature_one_private.require_grant(p_actor, p_grant);
  IF (s->>'repositoryId')::uuid IS DISTINCT FROM g.repository_id OR NOT EXISTS (
      SELECT 1 FROM public.repositories WHERE id = g.repository_id AND provider_repository_id = s->>'providerRepositoryId' AND visibility = s->>'repositoryVisibility') THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF s->>'snapshotIdentityVersion' IS DISTINCT FROM v->>'snapshotIdentity'
      OR p_bundle#>>'{coverage,snapshotId}' IS DISTINCT FROM s->>'snapshotId'
      OR p_bundle#>>'{inventorySummary,snapshotId}' IS DISTINCT FROM s->>'snapshotId'
      OR p_bundle#>>'{coverage,manifestVersion}' IS DISTINCT FROM v->>'coverageManifest'
      OR p_bundle#>'{coverage,detectorBundle}' IS DISTINCT FROM v->'detectorBundle'
      OR p_bundle#>'{inventorySummary,extractorBundle}' IS DISTINCT FROM v->'extractorBundle' THEN
    RAISE EXCEPTION 'VERSION_MISMATCH';
  END IF;
  INSERT INTO public.repository_snapshots(id, repository_id, commit_sha, visibility, branch_encrypted,
      identity_version, extraction_policy_version, extractor_id, extractor_version, detector_bundle_id,
      detector_bundle_version, coverage_version, inventory_summary, coverage, created_at)
    VALUES ((s->>'snapshotId')::uuid, g.repository_id, s->>'commitSha', s->>'repositoryVisibility', p_bundle->>'branchEncrypted',
      s->>'snapshotIdentityVersion', s->>'extractionPolicyVersion', v#>>'{extractorBundle,id}', v#>>'{extractorBundle,version}',
      v#>>'{detectorBundle,id}', v#>>'{detectorBundle,version}', v->>'coverageManifest',
      p_bundle->'inventorySummary', p_bundle->'coverage', (s->>'createdAt')::timestamptz)
    ON CONFLICT (repository_id, commit_sha, visibility, identity_version, extraction_policy_version,
      extractor_id, extractor_version, detector_bundle_id, detector_bundle_version, coverage_version) DO NOTHING
    RETURNING id INTO sid;
  IF sid IS NULL THEN
    SELECT * INTO STRICT existing FROM public.repository_snapshots WHERE repository_id = g.repository_id AND commit_sha = s->>'commitSha'
      AND visibility = s->>'repositoryVisibility' AND identity_version = s->>'snapshotIdentityVersion' AND extraction_policy_version = s->>'extractionPolicyVersion'
      AND extractor_id = v#>>'{extractorBundle,id}' AND extractor_version = v#>>'{extractorBundle,version}'
      AND detector_bundle_id = v#>>'{detectorBundle,id}' AND detector_bundle_version = v#>>'{detectorBundle,version}' AND coverage_version = v->>'coverageManifest'
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

CREATE FUNCTION public.feature_one_create_job(p_actor uuid, p_request jsonb, p_request_hash text, p_grant_ids uuid[], p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.analysis_jobs; g public.repository_access_grants; gid uuid; seen uuid[] := '{}'; jid uuid;
BEGIN
  -- Serialize identical logical requests without an in-memory lock (worker claiming is later).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || (p_request->>'idempotencyKey'), 0));
  SELECT * INTO j FROM public.analysis_jobs WHERE user_id = p_actor AND idempotency_key = p_request->>'idempotencyKey';
  IF FOUND THEN
    IF j.request_hash <> p_request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN j.id;
  END IF;
  IF cardinality(p_grant_ids) NOT BETWEEN 1 AND 10 OR jsonb_array_length(p_request->'repositoryIds') <> cardinality(p_grant_ids)
      OR p_request->>'contractVersion' IS DISTINCT FROM '1.0.0' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOREACH gid IN ARRAY p_grant_ids LOOP
    g := feature_one_private.require_grant(p_actor, gid);
    IF NOT (p_request->'repositoryIds' ? g.repository_id::text) OR g.repository_id = ANY(seen) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    seen := array_append(seen, g.repository_id);
  END LOOP;
  INSERT INTO public.analysis_jobs(user_id, idempotency_key, request_hash, request)
    VALUES (p_actor, p_request->>'idempotencyKey', p_request_hash, p_request) RETURNING id INTO jid;
  INSERT INTO public.analysis_job_grants(job_id, user_id, repository_id, grant_id)
    SELECT jid, p_actor, repository_id, id FROM public.repository_access_grants WHERE id = ANY(p_grant_ids);
  INSERT INTO public.audit_events(actor_id, job_id, action, object_type, object_id, request_id, safe_metadata)
    VALUES (p_actor, jid, 'analysis_created', 'job', jid, p_request_id, jsonb_build_object('repository_count', cardinality(p_grant_ids)));
  RETURN jid;
END $$;

CREATE FUNCTION public.feature_one_create_run(p_actor uuid, p_job uuid, p_versions jsonb, p_snapshot_ids uuid[], p_request_id uuid)
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
    IF s.identity_version IS DISTINCT FROM p_versions->>'snapshotIdentity'
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

CREATE FUNCTION public.feature_one_finalize_report(p_actor uuid, p_report jsonb, p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.analysis_jobs; r public.analysis_runs; item jsonb; nested jsonb; cap jsonb; claim jsonb; sid uuid;
  eid uuid; rid uuid := (p_report->>'reportId')::uuid; s public.repository_snapshots; tid text; tv text;
BEGIN
  SELECT * INTO j FROM public.analysis_jobs WHERE id = (p_report->>'jobId')::uuid AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
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
  UPDATE public.analysis_run_status SET status = 'completed', finished_at = now() WHERE run_id = r.id;
  UPDATE public.analysis_job_attempts SET status = 'completed', finished_at = now() WHERE id = r.attempt_id;
  UPDATE public.analysis_jobs SET status = 'completed', stage = 'cleanup', finished_at = now(), updated_at = now() WHERE id = j.id;
  INSERT INTO public.audit_events(actor_id, job_id, action, object_type, object_id, request_id, safe_metadata)
    VALUES (p_actor, j.id, 'report_completed', 'report', rid, p_request_id, jsonb_build_object('evidence_count', jsonb_array_length(p_report->'evidence')));
  RETURN rid;
END $$;

CREATE FUNCTION public.feature_one_cancel_job(p_actor uuid, p_job uuid, p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.analysis_jobs WHERE id = p_job AND user_id = p_actor AND status IN ('queued', 'running') FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.analysis_run_status SET status = 'canceled', finished_at = now() WHERE status = 'running' AND run_id IN (SELECT id FROM public.analysis_runs WHERE job_id = p_job);
  UPDATE public.analysis_job_attempts SET status = 'canceled', finished_at = now() WHERE job_id = p_job AND status = 'running';
  UPDATE public.analysis_jobs SET status = 'canceled', stage = 'cleanup', finished_at = now(), updated_at = now() WHERE id = p_job;
  INSERT INTO public.audit_events(actor_id, job_id, action, object_type, object_id, request_id)
    VALUES (p_actor, p_job, 'analysis_canceled', 'job', p_job, p_request_id);
END $$;

CREATE FUNCTION feature_one_private.prune_canonical() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  DELETE FROM public.repository_snapshots s WHERE NOT EXISTS (SELECT 1 FROM public.snapshot_receipts WHERE snapshot_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots WHERE snapshot_id = s.id);
  DELETE FROM public.repositories r WHERE NOT EXISTS (SELECT 1 FROM public.repository_access_grants WHERE repository_id = r.id)
    AND NOT EXISTS (SELECT 1 FROM public.repository_snapshots WHERE repository_id = r.id);
  DELETE FROM public.github_installations i WHERE NOT EXISTS (SELECT 1 FROM public.repository_access_grants WHERE installation_id = i.id);
END $$;
CREATE FUNCTION public.feature_one_delete_analysis(p_actor uuid, p_job uuid, p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE snapshots uuid[];
BEGIN
  PERFORM 1 FROM public.analysis_jobs WHERE id = p_job AND user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT array_agg(snapshot_id) INTO snapshots FROM public.analysis_run_snapshots WHERE job_id = p_job;
  DELETE FROM public.analysis_jobs WHERE id = p_job AND user_id = p_actor;
  DELETE FROM public.snapshot_receipts receipt WHERE user_id = p_actor AND snapshot_id = ANY(snapshots)
    AND NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots rs WHERE rs.user_id = p_actor AND rs.snapshot_id = receipt.snapshot_id AND rs.grant_id = receipt.grant_id);
  PERFORM feature_one_private.prune_canonical();
  INSERT INTO public.audit_events(actor_id, action, object_type, object_id, request_id)
    VALUES (p_actor, 'analysis_deleted', 'job', p_job, p_request_id);
END $$;
CREATE FUNCTION feature_one_private.after_account_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM feature_one_private.prune_canonical();
  RETURN NULL;
END $$;
-- Deferred until all FK cascades have removed user memberships, irrespective of trigger order.
CREATE CONSTRAINT TRIGGER feature_one_account_cleanup AFTER DELETE ON auth.users
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION feature_one_private.after_account_delete();

CREATE FUNCTION public.feature_one_prune_retention() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Receipts left by ingestion before a run was attached have a bounded recovery window.
  DELETE FROM public.snapshot_receipts receipt WHERE created_at < now() - interval '24 hours'
    AND NOT EXISTS (SELECT 1 FROM public.analysis_run_snapshots rs WHERE rs.user_id = receipt.user_id AND rs.snapshot_id = receipt.snapshot_id AND rs.grant_id = receipt.grant_id);
  DELETE FROM public.audit_events WHERE created_at < now() - interval '90 days';
  PERFORM feature_one_private.prune_canonical();
END $$;

CREATE FUNCTION public.feature_one_read_report(p_actor uuid, p_report uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT payload FROM public.readiness_reports WHERE id = p_report AND user_id = p_actor;
$$;
CREATE FUNCTION public.feature_one_list_reports(p_actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('reportId', id, 'runId', run_id, 'jobId', job_id, 'createdAt', created_at) ORDER BY created_at DESC, id), '[]')
  FROM public.readiness_reports WHERE user_id = p_actor;
$$;
CREATE FUNCTION public.feature_one_export(p_actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'githubAccounts', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]') FROM public.github_accounts a WHERE user_id = p_actor),
    'installations', (SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]') FROM public.github_installations i WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.installation_id = i.id AND g.user_id = p_actor)),
    'repositories', (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'metadata_encrypted'), '[]') FROM public.repositories r WHERE EXISTS (SELECT 1 FROM public.repository_access_grants g WHERE g.repository_id = r.id AND g.user_id = p_actor)),
    'snapshotReceipts', (SELECT coalesce(jsonb_agg(to_jsonb(receipt)), '[]') FROM public.snapshot_receipts receipt WHERE user_id = p_actor),
    'snapshots', (SELECT coalesce(jsonb_agg(to_jsonb(s) - 'branch_encrypted'), '[]') FROM public.repository_snapshots s WHERE EXISTS (SELECT 1 FROM public.snapshot_receipts receipt WHERE receipt.snapshot_id = s.id AND receipt.user_id = p_actor)),
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

-- SECURITY DEFINER functions must not inherit PUBLIC execute while deployment is
-- between migrations. The next migration grants only the supported entry points.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'feature_one_private' OR (n.nspname = 'public' AND left(p.proname, 12) = 'feature_one_') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn.signature);
  END LOOP;
END $$;
