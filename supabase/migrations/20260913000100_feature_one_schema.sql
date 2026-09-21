-- Feature 1 storage foundation. No legacy report/profile data is converted.
-- All writes are through narrowly granted functions in the following migration.
CREATE SCHEMA IF NOT EXISTS feature_one_private;
REVOKE ALL ON SCHEMA feature_one_private FROM PUBLIC, anon, authenticated, service_role;

CREATE DOMAIN feature_one_private.version AS text
  CHECK (VALUE ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$' AND length(VALUE) <= 64);
CREATE DOMAIN feature_one_private.provider_id AS text
  CHECK (VALUE ~ '^[1-9][0-9]{0,19}$');
CREATE DOMAIN feature_one_private.digest AS text
  CHECK (VALUE ~ '^sha256:[0-9a-f]{64}$');
CREATE DOMAIN feature_one_private.ciphertext AS text
  CHECK (VALUE ~ '^v1\.[0-9]+\.[0-9]+\.[0-9]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
    AND length(VALUE) <= 8192);

CREATE TABLE public.github_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_user_id feature_one_private.provider_id NOT NULL UNIQUE,
  login text NOT NULL CHECK (length(login) BETWEEN 1 AND 100),
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz,
  UNIQUE (id, user_id)
);
CREATE TABLE public.github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_installation_id feature_one_private.provider_id NOT NULL UNIQUE,
  provider_owner_id feature_one_private.provider_id NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('User', 'Organization')),
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
  last_verified_at timestamptz NOT NULL,
  last_webhook_at timestamptz
);
CREATE TABLE public.repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_repository_id feature_one_private.provider_id NOT NULL UNIQUE,
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  -- Mutable provider names/default branch are deliberately not authorization inputs.
  metadata_encrypted feature_one_private.ciphertext,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.repository_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_account_id uuid NOT NULL,
  installation_id uuid NOT NULL REFERENCES public.github_installations(id) DEFERRABLE INITIALLY DEFERRED,
  repository_id uuid NOT NULL REFERENCES public.repositories(id) DEFERRABLE INITIALLY DEFERRED,
  permission_scope text NOT NULL DEFAULT 'contents:read' CHECK (permission_scope = 'contents:read'),
  attestation_id uuid NOT NULL,
  statement_version feature_one_private.version NOT NULL,
  attested_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (github_account_id, user_id) REFERENCES public.github_accounts(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id, repository_id)
);
CREATE INDEX repository_access_grants_owner ON public.repository_access_grants(user_id, repository_id);

CREATE TABLE public.repository_snapshots (
  id uuid PRIMARY KEY,
  repository_id uuid NOT NULL REFERENCES public.repositories(id) DEFERRABLE INITIALLY DEFERRED,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  branch_encrypted feature_one_private.ciphertext NOT NULL,
  identity_version feature_one_private.version NOT NULL,
  extraction_policy_version feature_one_private.version NOT NULL,
  extractor_id text NOT NULL,
  extractor_version feature_one_private.version NOT NULL,
  detector_bundle_id text NOT NULL,
  detector_bundle_version feature_one_private.version NOT NULL,
  coverage_version feature_one_private.version NOT NULL,
  inventory_summary jsonb NOT NULL CHECK (jsonb_typeof(inventory_summary) = 'object'),
  coverage jsonb NOT NULL CHECK (jsonb_typeof(coverage) = 'object'),
  created_at timestamptz NOT NULL,
  sealed_at timestamptz,
  UNIQUE (id, repository_id),
  UNIQUE (repository_id, commit_sha, visibility, identity_version, extraction_policy_version,
    extractor_id, extractor_version, detector_bundle_id, detector_bundle_version, coverage_version)
);
CREATE TABLE public.snapshot_receipts (
  user_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  repository_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snapshot_id, grant_id),
  -- A cleanup race must fail rather than cascade away another user's receipt.
  FOREIGN KEY (snapshot_id, repository_id) REFERENCES public.repository_snapshots(id, repository_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (grant_id, user_id, repository_id) REFERENCES public.repository_access_grants(id, user_id, repository_id) ON DELETE CASCADE
);
CREATE INDEX snapshot_receipts_snapshot ON public.snapshot_receipts(snapshot_id);

CREATE TABLE public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash feature_one_private.digest NOT NULL,
  request jsonb NOT NULL CHECK (jsonb_typeof(request) = 'object'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
  stage text NOT NULL DEFAULT 'authorization' CHECK (stage IN ('authorization', 'snapshot', 'security_filtering', 'inventory', 'extraction', 'metadata', 'aggregation', 'role_mapping', 'synthesis', 'validation', 'publication', 'cleanup')),
  failure_code text CHECK (failure_code IS NULL OR failure_code ~ '^[A-Z_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (user_id, idempotency_key),
  UNIQUE (id, user_id),
  CHECK ((status IN ('completed', 'failed', 'canceled')) = (finished_at IS NOT NULL))
);
CREATE INDEX analysis_jobs_owner_created ON public.analysis_jobs(user_id, created_at DESC, id);
CREATE TABLE public.analysis_job_grants (
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  repository_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  PRIMARY KEY (job_id, repository_id),
  UNIQUE (job_id, user_id, repository_id, grant_id),
  FOREIGN KEY (job_id, user_id) REFERENCES public.analysis_jobs(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (grant_id, user_id, repository_id) REFERENCES public.repository_access_grants(id, user_id, repository_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.analysis_job_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'canceled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  failure_code text CHECK (failure_code IS NULL OR failure_code ~ '^[A-Z_]{1,64}$'),
  FOREIGN KEY (job_id, user_id) REFERENCES public.analysis_jobs(id, user_id) ON DELETE CASCADE,
  UNIQUE (job_id, number),
  UNIQUE (id, job_id, user_id),
  CHECK ((status <> 'running') = (finished_at IS NOT NULL))
);
CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL UNIQUE,
  versions jsonb NOT NULL CHECK (jsonb_typeof(versions) = 'object' AND versions->>'contract' = '1.0.0'),
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  snapshot_set_hash feature_one_private.digest NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (attempt_id, job_id, user_id) REFERENCES public.analysis_job_attempts(id, job_id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id, job_id),
  UNIQUE (id, taxonomy_id, taxonomy_version),
  CHECK (taxonomy_id = versions#>>'{taxonomy,id}' AND taxonomy_version = versions#>>'{taxonomy,version}')
);
CREATE TABLE public.analysis_run_status (
  run_id uuid PRIMARY KEY REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'canceled')),
  finished_at timestamptz,
  CHECK ((status <> 'running') = (finished_at IS NOT NULL))
);
CREATE TABLE public.analysis_run_snapshots (
  run_id uuid NOT NULL,
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  repository_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  PRIMARY KEY (run_id, snapshot_id),
  UNIQUE (run_id, repository_id),
  FOREIGN KEY (run_id, user_id, job_id) REFERENCES public.analysis_runs(id, user_id, job_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, repository_id) REFERENCES public.repository_snapshots(id, repository_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, snapshot_id, grant_id) REFERENCES public.snapshot_receipts(user_id, snapshot_id, grant_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (job_id, user_id, repository_id, grant_id) REFERENCES public.analysis_job_grants(job_id, user_id, repository_id, grant_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX analysis_run_snapshots_snapshot ON public.analysis_run_snapshots(snapshot_id);

CREATE TABLE public.file_inventory (
  snapshot_id uuid NOT NULL REFERENCES public.repository_snapshots(id) ON DELETE CASCADE,
  locator_id uuid NOT NULL,
  locator_encrypted feature_one_private.ciphertext NOT NULL,
  fingerprint feature_one_private.digest NOT NULL,
  fingerprint_key_version feature_one_private.version NOT NULL,
  language text NOT NULL CHECK (length(language) BETWEEN 1 AND 64),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 0 AND 1000000000),
  classification text NOT NULL CHECK (classification IN ('code', 'test', 'config', 'docs', 'ci', 'other')),
  eligible boolean NOT NULL,
  analyzed boolean NOT NULL,
  exclusion_reason text CHECK (exclusion_reason ~ '^[a-z_]{1,64}$'),
  PRIMARY KEY (snapshot_id, locator_id),
  UNIQUE (snapshot_id, fingerprint_key_version, fingerprint),
  CHECK (NOT analyzed OR eligible),
  CHECK (eligible = (exclusion_reason IS NULL))
);
CREATE TABLE public.evidence_items (
  id uuid PRIMARY KEY,
  locator_kind text NOT NULL CHECK (locator_kind IN ('file', 'provider_metadata')),
  file_locator_id uuid,
  snapshot_id uuid NOT NULL REFERENCES public.repository_snapshots(id) ON DELETE CASCADE,
  locator_id uuid NOT NULL,
  locator_encrypted feature_one_private.ciphertext NOT NULL,
  fingerprint feature_one_private.digest NOT NULL,
  fingerprint_key_version feature_one_private.version NOT NULL,
  detector_id text NOT NULL,
  detector_version feature_one_private.version NOT NULL,
  observation jsonb NOT NULL CHECK (jsonb_typeof(observation) = 'object'),
  CHECK ((locator_kind = 'file') = (file_locator_id IS NOT NULL)),
  FOREIGN KEY (snapshot_id, file_locator_id) REFERENCES public.file_inventory(snapshot_id, locator_id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, snapshot_id),
  UNIQUE (snapshot_id, detector_id, detector_version, fingerprint_key_version, fingerprint)
);
CREATE TABLE public.capability_definitions (
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  group_id text NOT NULL,
  definition jsonb NOT NULL,
  PRIMARY KEY (taxonomy_id, taxonomy_version, capability_id)
);
CREATE TABLE public.capability_evidence (
  evidence_id uuid NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  PRIMARY KEY (evidence_id, taxonomy_id, taxonomy_version, capability_id),
  FOREIGN KEY (taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_definitions(taxonomy_id, taxonomy_version, capability_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.role_templates (
  role_id text NOT NULL CHECK (role_id IN ('backend', 'frontend', 'full_stack', 'mobile', 'ai_application')),
  version feature_one_private.version NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (role_id, version),
  UNIQUE (role_id, version, taxonomy_id, taxonomy_version)
);
CREATE TABLE public.role_requirements (
  role_id text NOT NULL,
  role_version feature_one_private.version NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1),
  minimum_evidence numeric NOT NULL CHECK (minimum_evidence BETWEEN 0 AND 1),
  required boolean NOT NULL,
  PRIMARY KEY (role_id, role_version, capability_id),
  FOREIGN KEY (role_id, role_version, taxonomy_id, taxonomy_version) REFERENCES public.role_templates(role_id, version, taxonomy_id, taxonomy_version) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_definitions(taxonomy_id, taxonomy_version, capability_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.analysis_run_roles (
  run_id uuid NOT NULL,
  role_id text NOT NULL,
  role_version feature_one_private.version NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  PRIMARY KEY (run_id, role_id),
  FOREIGN KEY (run_id, taxonomy_id, taxonomy_version) REFERENCES public.analysis_runs(id, taxonomy_id, taxonomy_version) ON DELETE CASCADE,
  FOREIGN KEY (role_id, role_version, taxonomy_id, taxonomy_version) REFERENCES public.role_templates(role_id, version, taxonomy_id, taxonomy_version) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.analysis_run_evidence (
  run_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  PRIMARY KEY (run_id, evidence_id),
  FOREIGN KEY (run_id, snapshot_id) REFERENCES public.analysis_run_snapshots(run_id, snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id, snapshot_id) REFERENCES public.evidence_items(id, snapshot_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.capability_assessments (
  run_id uuid NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  assessment jsonb NOT NULL,
  PRIMARY KEY (run_id, capability_id),
  FOREIGN KEY (run_id, taxonomy_id, taxonomy_version) REFERENCES public.analysis_runs(id, taxonomy_id, taxonomy_version) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_definitions(taxonomy_id, taxonomy_version, capability_id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (run_id, capability_id, taxonomy_id, taxonomy_version)
);
CREATE TABLE public.assessment_evidence (
  run_id uuid NOT NULL,
  capability_id text NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  evidence_id uuid NOT NULL,
  PRIMARY KEY (run_id, capability_id, evidence_id),
  FOREIGN KEY (run_id, capability_id, taxonomy_id, taxonomy_version) REFERENCES public.capability_assessments(run_id, capability_id, taxonomy_id, taxonomy_version) ON DELETE CASCADE,
  FOREIGN KEY (run_id, evidence_id) REFERENCES public.analysis_run_evidence(run_id, evidence_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (evidence_id, taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_evidence(evidence_id, taxonomy_id, taxonomy_version, capability_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.readiness_reports (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  job_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  contract_version text NOT NULL CHECK (contract_version = '1.0.0'),
  visibility text NOT NULL CHECK (visibility = 'owner_only'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (run_id, user_id, job_id) REFERENCES public.analysis_runs(id, user_id, job_id) ON DELETE CASCADE,
  UNIQUE (id, run_id)
);
CREATE INDEX readiness_reports_owner_created ON public.readiness_reports(user_id, created_at DESC, id);
-- These edges are generated in the publishing transaction from ALL nested citations.
-- JSON arrays themselves are not foreign keys.
CREATE TABLE public.report_evidence_citations (
  report_id uuid NOT NULL,
  run_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  PRIMARY KEY (report_id, evidence_id),
  FOREIGN KEY (report_id, run_id) REFERENCES public.readiness_reports(id, run_id) ON DELETE CASCADE,
  FOREIGN KEY (run_id, evidence_id) REFERENCES public.analysis_run_evidence(run_id, evidence_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.report_capability_mentions (
  report_id uuid NOT NULL,
  run_id uuid NOT NULL,
  taxonomy_id text NOT NULL,
  taxonomy_version feature_one_private.version NOT NULL,
  capability_id text NOT NULL,
  PRIMARY KEY (report_id, capability_id),
  FOREIGN KEY (report_id, run_id) REFERENCES public.readiness_reports(id, run_id) ON DELETE CASCADE,
  FOREIGN KEY (run_id, taxonomy_id, taxonomy_version) REFERENCES public.analysis_runs(id, taxonomy_id, taxonomy_version) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (taxonomy_id, taxonomy_version, capability_id) REFERENCES public.capability_definitions(taxonomy_id, taxonomy_version, capability_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('grant_verified', 'grant_revoked', 'analysis_created', 'run_created', 'report_completed', 'analysis_canceled', 'analysis_deleted')),
  object_type text NOT NULL CHECK (object_type IN ('grant', 'job', 'run', 'report')),
  object_id uuid NOT NULL,
  request_id uuid NOT NULL,
  safe_metadata jsonb NOT NULL DEFAULT '{}' CHECK (
    jsonb_typeof(safe_metadata) = 'object' AND safe_metadata - ARRAY['repository_count', 'evidence_count'] = '{}'
    AND (NOT safe_metadata ? 'repository_count' OR (safe_metadata->>'repository_count') ~ '^[0-9]{1,5}$')
    AND (NOT safe_metadata ? 'evidence_count' OR (safe_metadata->>'evidence_count') ~ '^[0-9]{1,5}$')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_owner_created ON public.audit_events(actor_id, created_at DESC);
CREATE TABLE public.model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('readiness_synthesis', 'improvements')),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{1,64}$'),
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 128),
  prompt_version feature_one_private.version NOT NULL,
  input_fingerprint feature_one_private.digest NOT NULL,
  fingerprint_key_version feature_one_private.version NOT NULL,
  output_schema_version feature_one_private.version NOT NULL,
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  estimated_cost numeric CHECK (estimated_cost >= 0),
  latency_ms integer CHECK (latency_ms >= 0),
  validation_status text NOT NULL CHECK (validation_status IN ('pending', 'valid', 'invalid', 'failed')),
  api_usage_id uuid REFERENCES public.api_usage(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (attempt_id, job_id, user_id) REFERENCES public.analysis_job_attempts(id, job_id, user_id) ON DELETE CASCADE
);
COMMENT ON TABLE public.analysis_job_attempts IS 'Run 02 scaffolding. Worker leases, fencing, retries and billing are Run 07; no worker is enabled.';
COMMENT ON TABLE public.model_runs IS 'Source-free Run 12 staging/usage references; never store model input/output text or credentials here.';

CREATE INDEX repository_access_grants_repository ON public.repository_access_grants(repository_id);
CREATE INDEX repository_access_grants_installation ON public.repository_access_grants(installation_id);
CREATE INDEX repository_access_grants_account ON public.repository_access_grants(github_account_id);
CREATE INDEX analysis_attempts_owner ON public.analysis_job_attempts(user_id);
CREATE INDEX analysis_runs_job ON public.analysis_runs(job_id);
CREATE INDEX analysis_runs_owner ON public.analysis_runs(user_id, created_at DESC);
CREATE INDEX analysis_run_snapshots_owner ON public.analysis_run_snapshots(user_id);
CREATE INDEX analysis_run_evidence_item ON public.analysis_run_evidence(evidence_id);
CREATE INDEX report_citations_run_evidence ON public.report_evidence_citations(run_id, evidence_id);
CREATE INDEX model_runs_attempt ON public.model_runs(attempt_id);
CREATE INDEX model_runs_owner ON public.model_runs(user_id);

-- Secure this migration independently. A deployment interrupted before the policy
-- migration must not inherit Supabase's broad default grants on new public tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['github_accounts', 'github_installations', 'repositories', 'repository_access_grants',
    'repository_snapshots', 'snapshot_receipts', 'analysis_jobs', 'analysis_job_grants', 'analysis_job_attempts',
    'analysis_runs', 'analysis_run_status', 'analysis_run_snapshots', 'file_inventory', 'evidence_items',
    'capability_definitions', 'capability_evidence', 'role_templates', 'role_requirements', 'analysis_run_roles',
    'analysis_run_evidence', 'capability_assessments', 'assessment_evidence', 'readiness_reports',
    'report_evidence_citations', 'report_capability_mentions', 'audit_events', 'model_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END $$;
