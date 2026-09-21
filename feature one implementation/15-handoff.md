# Run 15 handoff — Finding feedback and contribution provenance

**Status: implemented and locally verified.** September 20, 2026. ANA-017–019. The user approved all five provenance/fairness interpretations in [A–E](../docs/benchmarks/run15-human-review.md). No remote migration, deployment, live flag activation or external message was performed.

## Delivered

Owners can save accurate, inaccurate, unclear or irrelevant feedback against an exact immutable report and typed capability, claim, evidence or improvement. The UI offers accessible controls on capability explanations and evidence observations, acknowledgement, edit/reload, uncertain retry and read-only fallback. Bounded optional comments stay owner-private and never enter the model, mail, reviewer queue or telemetry. Report membership, active sessions, CSRF, revision checks and stable replay keys protect both reads and writes. Feedback cannot change verified claims, strength, confidence or role scores.

The minimal internal review API requires an active session, constant-time admin secret and an explicit database reviewer grant. Its generalized, paginated queue exposes classification, finding kind, detector/version when available and structured disposition, without private comments/source, report/finding/owner IDs or provider identities. Review notes and benchmark links use a closed synthetic registry. Both response and review revisions fence updates; owner edits reopen review. The [review procedure](../docs/benchmarks/run15-review-process.md) covers grants, revocation, synthetic reproduction, priorities and authorization before retaining any real example. Classification-only triage may need an independently authorized reproduction; the queue is not private source inspection.

Feedback and safe classification/review history expire 180 days after the owner's last edit. Old comment bodies are not retained. Opaque private request-key/hash tombstones prevent delayed retries from recreating deleted/expired responses, and disappear on account deletion. Owner export v8 includes current feedback, safe history/reviews and provenance; it excludes reviewer identities and replay secrets. Analysis/account deletion removes associated private data through the existing ownership graph.

Provenance records current provider-declared fork/template context, saved generated-path/vendor exclusions, Run 09 generated source markers, bounded commit relationships and provider-linked identity categories. A single exact root head with at least 100 files is only a possible bulk/squash/import signal. The display distinguishes unavailable history and missing template information from negative findings. Author names/emails, ownership, sole responsibility, misconduct, personal understanding and AI generation are never inferred.

`provenance_context@1.0.0` is carried by future `evidence_aggregation@1.1.0` runs. Contribution confidence and both modifiers stay null. Existing capability/role arithmetic is unchanged. This neutral policy has human-reviewed interpretation boundaries; it is not statistical calibration of authorship or fairness. New validated explanations and a report panel expose the basis and limitations. An explicit rescan creates the new policy version and comparison history; old report JSON stays immutable.

Workers choose supported handlers from each claimed frozen policy, preserving queued 1.0.0 and 1.1.0 jobs across intake rollout/rollback. SQL independently checks provenance membership, SHA, closed fields/signals, recorded metadata/file counts and unknown contribution. Provider outage remains explicit unavailable context; permission loss prevents publication and database failure remains retryable. A discovered terminal timestamp ordering race is fixed in the existing transition guard without allowing terminal edits or changing completed reports.

## Interfaces and rollout

| Area | Location |
| --- | --- |
| Contracts | `packages/contracts/src/finding-feedback.ts`, `provenance.ts`, additive aggregation fields |
| Owner/review API | `repofy-backend/src/routes/finding-feedback.routes.ts` and `domain/feedback/service.ts` |
| Provenance policy/stage | `repofy-backend/src/domain/provenance/`, aggregation and worker composition |
| Controls/context | `repofy-frontend/src/components/readiness/finding-feedback.tsx`, `provenance-panel.tsx` |
| Migration | `20260920000800_finding_feedback_and_provenance.sql` |
| Architecture/privacy | [ADR 0015](../docs/adr/0015-finding-feedback-and-provenance.md) |

Build contracts before installing the applications. Apply the additive migration before the API, worker, maintenance and export-v8 consumer. `FINDING_FEEDBACK_ENABLED` and `FEATURE_ONE_PROVENANCE_ENABLED` are separate, default-off flags under the feature master switch. Saved reads/deletion and maintenance remain available when intake/writes are off. No reviewers are seeded. Keep both supported policy handlers while queued work settles. Misleading future context requires a reviewed new version or disabled intake plus an approved quality notice and explicit reanalysis, never a silent history rewrite.

## Verification

Node 22, PostgreSQL 17, production Next.js and Chromium. Tests retain their existing assertions, timeouts and coverage thresholds; local heavy suites run with bounded concurrency.

| Check | Result |
| --- | --- |
| Backend full suite | 1,190 passed / 98 files; 88.04% statements, 85.00% branches, 89.62% functions, 90.51% lines |
| Frontend full suite | 580 passed / 87 files; 83.35% statements, 75.50% branches, 78.76% functions, 83.97% lines |
| Shared contracts | 81 passed; build passed |
| Real PostgreSQL | 104 passed, including concurrency, privileges, provenance validation, timestamp ordering and queued policy versions |
| Real report browser workflow | 4 passed, including the new feedback/review/provenance journey |
| Selection / route boundaries | 2 selection browser tests and 8 production-page HTTP checks passed |
| Builds / typecheck / lint | Both application builds and frontend typecheck passed; zero lint errors, one existing unused `vi` warning |
| Process and replay verification | Worker/maintenance lifecycle, ingestion, structural extraction, TS/JS detectors, Python/Java coverage, aggregation replay/load and rubric validation passed |

The maintenance process fixture now accepts and verifies the independent feedback-retention RPC. The aggregation check replayed the frozen 1.0.0 result and processed 20,000 observations across ten repositories in 1,995 ms with 475 MiB peak RSS, within its existing heap/watchdog limits. No production credentials or hosted services were used. [Machine-readable verification record](../docs/benchmarks/run15-verification.json).

The synthetic [fixture set](../repofy-backend/tests/fixtures/evidence/provenance.json) covers substantial original work in a fork, an extensively modified template, indistinguishable squash/import shapes, generated/vendor content beside authored source, multiple/mismatched/unlinked identities and missing private organization history. The calculation regression holds the extracted observations constant and confirms identical old/new strength, confidence and role arithmetic. Required human review is 5/5 agreement, explicitly unblinded and qualitative.

Private integration cases cover exact membership, four choices, duplicate/edit/stale writes, deleted reports, unsafe/overlong text, controlled review, retention/export/deletion, unavailable provider context, permission loss and no automatic provider/model calls from feedback. PostgreSQL adds independent concurrent feedback/review connections, service-only privileges, actual captured metadata and generated-source markers, forged provenance rejection, immutable storage, timestamp ordering and pinned worker policy selection.

The production browser journey saves and edits feedback through token refresh and a double click, reloads the saved response, verifies review permission and acknowledgement, checks flags-off owner reads and foreign-owner denial, and explicitly rescans unchanged source into the new aggregation policy. It checks immutable old scores, source reuse and safe context labels. Feedback and provenance panels receive desktop/mobile axe and overflow checks and synthetic screenshots. No test uses a live GitHub/model transport or actual private repository.

Chromium axe checks found zero violations for feedback and provenance at 1280×1000 and 390×844; mobile has no horizontal document overflow. Visually reviewed captures: feedback [desktop](../docs/benchmarks/run15-feedback-desktop.png) / [mobile](../docs/benchmarks/run15-feedback-mobile.png), provenance [desktop](../docs/benchmarks/run15-provenance-desktop.png) / [mobile](../docs/benchmarks/run15-provenance-mobile.png). Labels, wrapping, controls and unknown/context explanations are readable. These are standalone panel captures; fixed application navigation is hidden only during provenance capture to avoid overlaying a panel taller than the viewport. Accessibility and interaction checks use the unmodified page. This is automated accessibility and visual review, not full assistive-technology certification.

## Limits and next run

All contribution probabilities/modifiers remain unknown; eight synthetic scenarios and five human boundary judgements do not calibrate an authorship detector or population fairness. Fork/template fields are current provider context, not proof of historical origin at the analyzed commit. Optional history is bounded and may be missing; metadata-enabled rescans refetch it under the current accepted account/grant. Generated markers and path classifications are heuristics. The review registry is deliberately small and requires a contract/migration update for new case IDs; no general admin dashboard or automatic repair system is included.

Run 16 remains outstanding. It must evaluate the integrated behavior and broader calibration/release evidence. Existing live GitHub checks, pinned-model access/success smoke, deployment supervision and rollout review remain external gates. Default flags stay off.
