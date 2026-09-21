# Run 02 — Database, ownership, and immutable versions

**Status:** Complete for the scoped persistence foundation; see [verification and handoff](02-handoff.md). **Depends on:** Run 01. **Requirements:** CORE-003–004, ANA-002–003, ANA-005–007, CONS-006; PRD sections 15.5, 20, 22.6, and 28.

## Outcome and scope

Persist an authorized synthetic analysis with evidence and a completed private report, while preventing cross-user reads, foreign evidence references, and later modification of completed content. Build the schema needed by Feature 1; do not prebuild hiring organizations, public profiles, or defense sessions.

## Read first

- [Root migrations](../supabase/migrations) and [backend migrations](../repofy-backend/supabase/migrations).
- [Database client](../repofy-backend/src/config/supabase.ts), [authentication middleware](../repofy-backend/src/middleware/auth.ts), and [account service](../repofy-backend/src/services/account.service.ts).
- [Report persistence](../repofy-backend/src/services/reports.service.ts), [PGlite helper](../repofy-backend/tests/helpers/pglite-db.ts), and Run 01 contracts.

## Implementation sequence

1. Inventory migration histories and how local/test/deployed databases apply them. Record duplicate historical files and required dependencies without editing applied migrations. Choose one authoritative directory for new migrations and provide a reproducible ordered baseline. Ensure its changes trigger CI.
2. Create github_accounts, github_installations, repositories, and repository_access_grants. Use stable provider IDs; names/logins are mutable metadata. Support more than one verified GitHub identity per account without allowing one identity to be silently linked across unrelated users. Installation ownership alone does not grant an application user access.
3. Add repository_snapshots, analysis_jobs, analysis_job_attempts or equivalent stage attempts, analysis_runs, and explicit analysis_run_snapshots membership. Store logical request hashes/idempotency keys, exact SHAs, version dependencies, and terminal status separately from immutable payloads.
4. Add file_inventory, evidence_items, capability_definitions, capability_evidence, capability_assessments, role_templates, role_requirements, readiness_reports, and supporting membership tables where necessary. Keep generic saved reports and account profiles untouched. An analysis joining several snapshots must use explicit foreign keys, not only a JSON array.
5. Distinguish reusable snapshot observations from user-owned report membership. Build constraints or privileged transactional functions ensuring every cited evidence item belongs to an included run snapshot, matching capability/analysis version where appropriate. Do not claim a JSON evidence-ID array is protected by a normal foreign key.
6. Define ownership/access functions and RLS for browser-visible data, deny anonymous access, and enforce explicit policies in API repositories using the service-role client. Non-owner reads should not reveal the existence or private name of another user's object.
7. Enforce immutability of completed snapshots/runs/report payloads through database permissions, triggers, or narrow transactional functions. Allow normal job transitions and separate access/deletion status changes. Draft model output belongs in attempts/staging, not a published report row.
8. Resolve private locator retention in an ADR. Store only necessary file/symbol/line metadata, encrypt sensitive retained private identifiers as decided, and keep raw source out of ordinary rows. Distinguish internal keyed locators from safe API labels; an unkeyed hash of a guessable private path is not anonymization.
9. Add safe audit_events and model_runs/usage references. Define cascade and retention rules for user deletion, analysis deletion, shared snapshots, feedback, and job cancellation. Extend account deletion/export as tables are introduced rather than waiting for a later product feature.
10. Provide transaction helpers for creating a run and atomically finalizing exactly one validated report. Establish unique constraints for user+idempotency key and terminal output. Later worker leases and billing transitions can extend these helpers in Run 07.

## Data and authorization invariants

- A repository row is identity, not an authorization grant. Grant checks bind user, verified GitHub identity, installation, repository, and active status.
- A snapshot never changes its commit. A new commit or extraction-policy version produces a new appropriate artifact identity.
- Private canonical evidence cannot be queried through an unrestricted snapshot endpoint merely because another user analyzed the same repository.
- Removing a user's analysis removes it from product access promptly; deletion of canonical data honors other legitimate references without disclosing them.
- Revoking GitHub access blocks future retrieval. Whether existing private results remain owner-readable follows the documented policy, rather than an accidental cascade.

## Acceptance criteria

Fresh-baseline and existing-baseline migrations both succeed. A synthetic multi-repository report can be saved and read by its owner. A second user cannot list/read/delete it, attach it to a run, or cite its evidence. Cross-run evidence references and duplicate finalization are rejected at the persistence boundary. Completed content cannot be rewritten through ordinary service operations. Account/analysis deletion and exports include new data with no credentials or raw source.

## Verification

Use migration and constraint tests for invalid membership, duplicate idempotency keys, orphan evidence, incompatible rubric versions, and immutable updates. Test real database policy behavior with distinct user identities, not only mocked Supabase builders. Existing PGlite helpers stub auth.uid to null and are insufficient proof of owner RLS. Use real Supabase/PostgreSQL integration where needed, and add multi-connection tests once Run 07 implements claiming.

Test upgrades with existing profiles, advice, reports, and credits; verify their existing reads remain functional. Exercise user deletion with pending and completed jobs, and shared canonical observations owned through different grants.

## Migration, rollout, and handoff

Use additive migrations, narrowly scoped grants, indexes for owner/report/job lookup, and versioned seed insertion. Roll back application access by flag first. Do not drop evidence data as a routine deployment rollback; document restoration and a forward repair path for any failed migration.

Hand off the migration order, entity diagram, policy matrix, transaction interfaces, locator-retention ADR, fixture factory, deletion semantics, and tests proving immutability. Mark draft tables awaiting later worker functions clearly so existence is not mistaken for a complete job system.
