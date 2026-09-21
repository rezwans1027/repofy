# Run 16 — Benchmarks, integration verification, and rollout readiness

**Status:** Local implementation and evidence recorded; rollout **HOLD**. See [handoff](16-handoff.md), [acceptance matrix](../docs/benchmarks/run16-release-evidence.md) and [machine decision](../docs/benchmarks/run16-release-decision.json). The first review agreed with all C01–C24/R01–R30 labels; independent calibration and external verification remain pending. **Depends on:** Runs 01–15. **Requirements:** ANA-001–019 acceptance; relevant CORE/GH/ING/CONS requirements; PRD sections 4.3, 18.5, 22–24, 27.1, 28.5, and 32.

## Outcome and scope

Produce defensible evidence that Feature 1 works as an integrated private developer workflow and document whether it is ready for the intended rollout. Resolve integration defects rather than treating a checklist or green mocked test suite as release proof.

This run consolidates verification already added in earlier runs. It does not certify Features 2–6, public-profile disclosure, employer consent, Repo Defense grading, or job-description parsing. The full PRD has additional release gates outside this folder.

## Read first

Read every run's handoff, [the requirement map](REQUIREMENTS.md), [CI](../.github/workflows/ci.yml), [CI documentation](../docs/ci.md), and [Playwright configuration](../repofy-frontend/playwright.config.ts). Reconcile documented scripts/secrets with current executable configuration instead of copying stale setup instructions.

## Implementation and review sequence

1. Audit requirement completion against ANA-001–019 and the shared support matrix. For each item, identify implementation entry points, automated checks, manual evidence, unresolved limitations, and owner. Keep missing tests, external smoke checks, and unmet acceptance visible.
2. Assemble a versioned benchmark corpus from earlier synthetic fixtures: strong/weak TS/JS applications, frontend/backend/full-stack examples, mobile and AI application patterns, monorepos, baseline Python/Java, unsupported languages, tests/CI/schema/configuration, forks/templates, and private-style repositories with secret/hidden-path sentinels.
3. Separate development fixtures from held-out evaluation examples. Provide reference observations, expected capability boundaries, valid alternatives, and uncertainty labels. Record corpus, detector, taxonomy, rubric, aggregation, prompt/model, and coverage versions with every benchmark result.
4. Measure evidence precision/recall for known detectors, valid reference rate, human claim-support agreement, unsupported major claims, role-rubric calibration, contribution-confidence errors, private-disclosure failures, latency, completion rate, and cost. Do not report unmeasured metrics as passing.
5. Run human review on a documented sample across roles/language tiers and difficult cases. Record reviewer criteria, sample size, disagreements, and limitations. A test authored from the same detector implementation is not independent evidence of semantic correctness.
6. Run production-like end-to-end workflows through frontend, API, real database, worker, and synthetic provider adapters. Add separately documented real GitHub App/model smoke checks with approved development resources. Never place real private source or credentials in CI artifacts.
7. Exercise cross-user authorization for selections, jobs, reports, evidence, feedback, comparison, deletion, and any refetch. Test private-data leakage through nested JSON, rendered HTML, URLs, caches, logs/Sentry, analytics, error messages, exports, and copied links. Confirm there are no enabled public/employer report routes.
8. Inject worker/provider/database failures: duplicate delivery, two worker claimants, stale lease completion, forced worker kill, partial snapshot loss, model success before persistence, billing settlement failure, revoked access mid-run, deletion during processing, GitHub limits, and deterministic validation failure. Verify recovery, no duplicate charge, no resurrection, and cleanup deadlines.
9. Load-test within the stated repository limits and record hardware/concurrency/context. Separate queue wait from stage processing latency. Check partial/unsupported scans, bounded memory/disk, and cost-cap enforcement. Size a safe initial concurrency/allowlist based on measurements.
10. Complete keyboard/screen-reader/mobile/contrast checks on selection, progress, capability navigation, evidence drill-down, role changes, comparisons, and feedback. Charts require equivalent text. Verify existing login, GitHub explorer, advice, credits, account export, and deletion after shared changes.
11. Make CI trustworthy for this feature: shared-package/root-migration changes trigger checks; worker/contracts build; database tests run against suitable infrastructure; E2E failures are not silently ignored. The current Playwright continue-on-error setting needs a documented transition to a blocking Feature 1 gate once reliable; skipped/missing-credential checks are not passing evidence.
12. Finalize operations and privacy documentation: worker deploy/supervision, secret rotation, access revocation, cleanup sweeper, retry/dead-letter handling, billing reconciliation, model retention configuration, deletion policy, incident investigation without source logs, feature flags, and rollback.
13. Review failures, implement scoped fixes, and rerun affected checks. Repeat the complete release gate only after changes justify it. Produce a final measured result and rollout decision with explicit blockers; do not mechanically mark every plan complete.

## Measured targets from the PRD

| Area | Initial target | Interpretation |
|---|---|---|
| Major claims with valid references | 100% | Necessary structural support; semantic support is measured separately |
| Human agreement that evidence supports claims | At least 90% | Record sample composition and uncertainty |
| Unsupported major-claim rate | Below 2% | Evaluate claim scope, not only whether IDs exist |
| Analysis completion within configured limits | At least 95% | Define workload, exclusions, and failure denominator |
| Undisclosed private details in external projections | 0 | Test generalized projection contracts; no external Feature 1 route is enabled |
| Duplicate paid deductions | 0 | Verify real database concurrency and recovery boundaries |
| Standard authenticated API p95 | Under 500 ms | Excludes asynchronous work; state measurement environment |
| Analysis p50 / p95 | Under 4 / 12 minutes | Within configured size limits and declared concurrency |
| Raw source cleanup | Within 60 minutes of terminal outcome | Includes crash/orphan cleanup, not only happy-path disposal |

Do not weaken absolute privacy, authorization, or duplicate-charge invariants to reach completion-rate targets. Where the PRD permits visible quality limitations, record the exact limitation and affected scope rather than making an unsupported blanket quality claim.

## Required integrated scenarios

- Authorized TS/JS private repository to a report with traceable capability evidence, five role results, and improvements.
- Several selected repositories, including public/private and mixed supported languages.
- Dependency-only or weak repository with appropriately limited evidence.
- Unsupported/empty/too-large repository with an actionable truthful outcome.
- Revoked access before starting and during processing; reconnect restores only legitimate access.
- Duplicate starts/retries, worker replacement, one final report, and correct settlement/refund.
- Role focus, new-commit rescan, unchanged-SHA reuse, immutable baseline, and explainable comparisons.
- Finding feedback and provenance uncertainty without automated authorship or hiring conclusions.
- Analysis/account deletion during active and completed work, including caches and temporary files.
- Provider outage while reading a completed report.

## Acceptance criteria and artifacts

Produce a release evidence document with requirement links, test commands/results, benchmark metrics, reviewed examples, privacy threat-model disposition, performance/cost measurements, actual flag configuration, migration/deployment order, known limitations, and remaining external dependencies. Store only safe synthetic artifacts and aggregate results.

Feature 1 is complete only when ANA-001–019 and its support requirements have passed their applicable checks with no known P0/P1 defects in the delivered flow. ANA-020 remains an explicit P2 deferral. If human review, real integration, or necessary infrastructure verification is pending, state that precisely instead of claiming the milestone passed.

## Rollout and rollback

Deploy schema/contracts compatibility first, then API/worker, then private frontend routes. Start with internal users and controlled repository limits; observe completion, unsupported claims, privacy blocks, retries, costs, and cleanup. Expand only with recorded evidence that gates hold.

An incident disables new intake or the affected analyzer/model policy, while preserving report access where safe and keeping cleanup/reconciliation/revocation active. Document whether queued work drains or cancels and how refunds settle. Retain immutable versions; never repair history by silently overwriting reports.

PRD section 32 also requires profile-disclosure tests before the complete developer-product public release. Feature 1's internal readiness is not permission to bypass those later Feature 2 gates or launch employer functionality.
