# Run 01 — Feature flags and shared contracts

**Status:** Complete (September 13, 2026); see [verification and handoff](01-handoff.md). **Depends on:** Current app only. **Requirements:** CORE-003, CORE-005; foundations for ANA-001 through ANA-014; PRD sections 15–18, 21, and 28.

## Outcome and scope

Establish one runtime-validated language for repository analysis across the frontend, API, worker, and eventual model adapter. An internal synthetic evidence object must validate against the same schema on both sides. New product surfaces stay disabled by default.

This run does not build repository fetching, a worker, detectors, or a functioning readiness report. Do not rename old advice/report contracts or enable the disabled legacy analyzer.

## Read first

- [PRD](../Repofy_PRD_v1.0.md), especially the evidence-item example and claim-validation rules.
- [Backend types](../repofy-backend/src/types/index.ts), [legacy report contract](../repofy-backend/src/types/shared/report.ts), and [frontend report contract](../repofy-frontend/src/shared/types/report.ts).
- [Backend configuration](../repofy-backend/src/config/env.ts), [response helpers](../repofy-backend/src/lib/response.ts), [frontend API client](../repofy-frontend/src/lib/api-client.ts), and [engine client](../repofy-backend/src/services/engine.service.ts).
- Both package manifests/tsconfigs, [frontend configuration](../repofy-frontend/next.config.ts), and [CI](../.github/workflows/ci.yml).

## Implementation sequence

1. Write an evidence-foundation ADR documenting a small shared package, the worker boundary, the additive API namespace, and the distinction from old profile scoring. Inventory the external engine interface and explicitly state that its source is unavailable here.
2. Create an installable packages/contracts package with runtime validation and inferred TypeScript types. The backend's CommonJS/rootDir and the frontend's bundler configuration must both work from clean package builds. Choose and prove a real package export/build strategy; a source alias alone is insufficient. Update lockfiles, install order, CI path filters, and deployment build-context instructions as necessary.
3. Define schemas for repository selections, verified identity references, access attestations, snapshots, analyzer coverage, inventory summaries, evidence observations, contribution uncertainty, capabilities, rubric requirements, analysis progress, claims, gaps, improvements, and private readiness reports. Keep source type, visibility, confidence, and evidence strength as separate concepts.
4. Validate identifiers, SHA formats appropriate to the provider, bounded text/arrays, normalized scores, coherent line ranges, timestamps, required versions, and unions for assessable versus unknown states. A runtime schema cannot alone establish database membership or semantic claim support; expose a domain-validation interface for those checks.
5. Define version dependencies: contract, snapshot identity, extractor/detector bundle, coverage manifest, aggregation policy, taxonomy, role rubric, disclosure policy, prompt, and model. Distinguish logical job ID, attempt ID, analysis-run ID, and report ID.
6. Define separate internal evidence and owner-facing response schemas. No API schema includes access tokens, raw archive locations, worker credentials, or unrestricted source blobs. Reserve a strict generalized evidence projection for future sharing, without creating a public endpoint.
7. Introduce authoritative backend feature flags and a safe client capability response. Proposed flags are featureOneEnabled, githubAppRepositoriesEnabled, rescansEnabled, and findingFeedbackEnabled. They default off; new credentials are conditionally required only when the relevant integration is enabled. Flags never replace authorization.
8. Specify request idempotency and an additive machine-readable error envelope. Preserve existing success/data and string-error consumers; add code, retryable, and requestId fields for new endpoints rather than breaking legacy handling. Preserve automatic auth refresh and CSRF headers.
9. Add a small internal fixture consumer in each package to prove shared validation/build compatibility. Avoid production routes that emit fabricated reports. Document how Run 02 and the worker will consume the contracts.

## Proposed contracts and UI behavior

StartAnalysisRequest includes repository IDs, optional role-template version, bounded metadata options, and an idempotency key. Server-owned identity, price, status, evidence, and confidence fields cannot be supplied by the browser. The server derives authorization and canonical request hashes.

AnalysisJobResponse contains stage, attempt summary, safe progress, retryability, failure code, timestamps, and the completed report reference. ReadinessReportResponse includes included snapshots, coverage limitations, grouped capabilities, five role results, gaps, and improvements. Private report responses use private/no-store cache policy in later API runs.

When disabled, the navigation hides or clearly marks the unfinished feature, direct routes return a defined unavailable state, and write endpoints perform no work. The implementation must choose consistent behavior and test it.

## Acceptance criteria

- Both package builds consume the same runtime contracts after a clean install; no parallel handwritten readiness schema is required.
- Unknown states cannot masquerade as a confidence-zero assessment or a definitive lack of skill.
- Every verified claim requires evidence references structurally; unverified statements use a distinct type and label.
- Feature flags are evaluated server-side, safely mirrored to the UI, and default off without breaking existing startup.
- The new error representation preserves existing API-client behavior, including refreshed requests.
- CI and deployment instructions account for shared-package changes and artifacts.

## Verification

Test valid and invalid fixtures, unsupported contract versions, missing evidence references, excessive text/arrays, invalid score bounds, accidental sensitive fields, and all disabled-route paths. Compile/build both existing packages and the new package. Exercise a frontend schema parse and a backend schema parse against the identical synthetic fixture. Test flags with missing integration credentials and avoid recording secret values in failures.

## Migration, rollout, and handoff

No database mutation is required. Roll back by disabling the feature and reverting only new package consumers if needed; legacy report/advice interfaces remain compatible. Telemetry records a safe feature/version identifier, never fixture/source content.

Hand off the exported schemas, ADR, package commands, API/error conventions, feature flags, source-redaction boundary, and the exact external-engine work still needed in Run 12. Run 02 should not need to invent fundamental identifier or ownership semantics.
