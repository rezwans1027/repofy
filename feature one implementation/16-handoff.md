# Run 16 handoff — Benchmark and integrated release verification

**Status: local implementation and verification complete; rollout HOLD.** September 20, 2026 (America/New_York). All 22 local gates passed. The requesting user's new C01–C24 and R01–R30 review is recorded. The second independent engineering review and empirical calibration, live integrations and deployment checks remain pending. Feature 1 is **not declared release-complete**, and all six feature flags remain disabled with an empty analysis allowlist.

## Delivered

The [release evidence](../docs/benchmarks/run16-release-evidence.md) maps every ANA-001–019 and the 25 relevant CORE/GH/ING/CONS support requirements to implementation entry points, local tests, manual/external evidence, limitations and responsible roles. ANA-020 and Features 2–6 remain outside this run.

The new backend `scripts/release` tools provide a frozen 24-case evaluation corpus, 30 role boundary vectors, separate development-fixture hashes, known-detector precision/recall, structural and major-claim reference validation, neutral provenance/privacy checks, human-review binding, real HTTP/PostgreSQL/worker workload measurements, safe local configuration preflight, sequential verification with a source digest, and a fail-closed rollout decision. Unmeasured values remain null. Missing/failed/skipped evidence cannot authorize a rollout; the decision command never changes flags.

The integrated workload covers strong/weak TS/JS, AI adapter patterns, Python/Java baseline structure, native/empty unknowns, private sentinels, five repositories, duplicate starts, two queued jobs, 10,000 eligible files, a correctly rejected 10,001-file archive and 150 saved reads during simultaneous synthetic GitHub/model outages. Report reads do not make provider calls. The fifth browser journey adds mixed TypeScript/Python coverage, keyboard progress, outage reload/evidence and a native-language report whose five roles stay unknown. Test-only controls remain in the loopback harness, outside production routes.

Real PostgreSQL recovery verification now SIGKILLs the winning process in the two-claimant race before lease replacement; stale tokens cannot complete or mutate the recovered job. Existing tests retain partial-file loss, durable draft reuse, ambiguous model outcomes, transactional settlement loss, cancellation/deletion/revocation and budget concurrency. Local abrupt-process cleanup is distinct from the still-pending deployed volume/outage drill.

CI runs all three required Feature 1 jobs for either application, contracts, root migrations, benchmark JSON or workflow changes. The new blocking `feature-one-gate` requires actual success from every dependency. The separate hosted suite is an explicit opt-in; `continue-on-error` is removed. Its setup now uses the saved OAuth session actually consumed by `auth.setup.ts`, with required OAuth configuration, an ignored 0600 session file and no credential-bearing traces. That suite was not run and still has legacy disabled-analyze assumptions; it is explicitly not passing release evidence. Remote required branch protection was not changed.

## Measured results

| Measurement | Result / scope |
|---|---|
| Known detector observations | 24 TP, 0 FP, 1 FN; observed precision 100%, recall 96% across 25 annotated positives |
| Known omission | `tsjs.route_service` on a concise expression-body callback; R16-Q01 P2. Positive reference unchanged; future fix requires an immutable detector version |
| Valid references | 58/58 rendered major claims; 127/127 combined source-span/membership checks |
| Privacy / contribution errors | 0 disclosure failures; 0 provenance changes to strength/confidence/role math in the 24-case corpus |
| First human review | 22/22 major claims supported, 0/22 unsupported, 2/2 unknown cards; 30/30 role boundary agreements (6/6 per role) |
| Human sample limitation | One unblinded reviewer; role expertise not recorded; the 0/22 unsupported rate has a 95% upper bound ≈14.9%, not evidence of a <2% population rate |
| Integrated completion | 13/13 valid jobs; separate expected over-limit rejection. Descriptive 95% lower bound ≈77.2%; no production SLA claim |
| Local analysis end-to-end | p50 158 ms, p95 4,447 ms; queue p50 61 ms, p95 118 ms; one worker on Apple M4 Pro, 24 GiB RAM |
| Authenticated API reads | Report p95 15.76 ms (60 samples); job 14.36 ms, history 7.83 ms, evidence 7.66 ms; synthetic loopback transports |
| Memory / disk scope | Peak server RSS 444 MiB; largest generated archive 105,169 bytes. Maximum byte-volume/container capacity remains unmeasured |
| Raw cleanup | 13 empty-workspace checks, observed within at most 53 ms of terminal timestamps; actual deployed sweeper/outage deadline remains unverified |
| Cost | Actual provider spend $0. Synthetic usage: 13,000 input + 13,000 output tokens, $0.026 under the frozen policy; $0.10/job cap |

The new review is recorded verbatim as **“Agree with all expected labels.”** Earlier approvals are not reused. [Review and criteria](../docs/benchmarks/run16-human-review.md), [calibration protocol](../docs/benchmarks/rubric-calibration.md), [component results](../docs/benchmarks/run16-results.json), [load measurements](../docs/benchmarks/run16-load.json).

A benchmark-binding defect surfaced during verification: fresh fixture UUIDs can select a different equally ranked observation for C02. Labels are now bound to a frozen actual rendering matching the approved text and the original corpus/domain hashes; fresh-run variants are listed separately and do not inherit approval. Six diagnostic replays exercised both choices. No reference labels, approved wording, scoring policy or production detector behavior were changed. The final full gate used an unchanged implementation digest after this and the CI fixes.

## Verification

Node 22.23.2, PostgreSQL 17, production Next build and Chromium. [All commands, actual exit codes, timestamps and source digest](../docs/benchmarks/run16-verification.json) are retained; synthetic console logs remain in a local temporary directory.

| Check | Final result |
|---|---|
| Contracts | 81 tests; typecheck and CJS/ESM builds passed |
| Backend | 1,199 tests / 100 files; typecheck/build passed; 88.04% statements, 84.94% branches, 89.62% functions, 90.51% lines |
| Real PostgreSQL | 104 passed; no failures/skips |
| Process/policy gates | Ingestion, analysis/maintenance worker, structural extraction, TS/JS detectors, baseline coverage, aggregation and rubric validation passed |
| Release harness | Strict TypeScript check, frozen corpus/review benchmark and real integrated workload passed |
| Frontend | 580 tests / 87 files; typecheck/build passed; 83.29% statements, 75.50% branches, 78.63% functions, 83.97% lines |
| Lint | Zero errors; one pre-existing unused `vi` warning in `src/lib/query-client.test.ts` |
| Browser / HTTP | Five real report journeys, two selection journeys and eight reserved-route cases passed |
| Accessibility / visual | Automated keyboard/focus/status/axe/contrast/mobile overflow passed; final desktop/mobile synthetic captures visually inspected. Human screen-reader pass is pending |
| CI / artifact checks | YAML and all 41 shell steps parse; required/opt-in structure checked locally. Frozen hashes, requirement links and whitespace verified. Remote Actions/branch protection unverified |
| Decision behavior | Ordinary decision records HOLD; `--require-ready` exits 1 as intended. Incomplete verification was also rejected |

No test or coverage threshold was relaxed. Production domain code and database migrations did not change in Run 16. Existing auth/explorer/advice/credits/export/deletion tests and the legacy-data upgrade checks remain in the full suites. [Desktop capture](../docs/benchmarks/run16-mixed-desktop.png), [mobile capture](../docs/benchmarks/run16-mixed-mobile.png).

## Rollout blockers and closure

The [machine decision](../docs/benchmarks/run16-release-decision.json) has seven passing local gates and eight pending external gates:

1. Second independent engineering review, recorded role expertise and empirical rubric/detector/improvement calibration.
2. Real GitHub App installation, private archive, permissions, signed revocation and reconnect checks; local App credentials are absent.
3. Successful pinned-model schema/usage smoke and provider retention approval. Run 12's HTTP 404 is historical; Run 16 made no live requests or model substitution.
4. Deployed migrations/supervision, managed secrets/rotation, volume/RSS limits, cleanup through outages, deletion/backups and incident recovery.
5. Representative deployed completion/latency/cost/capacity measurements beyond small synthetic inputs.
6. Human assistive-technology traversal of the complete core workflow.
7. Reconciled dedicated hosted-account regression; missing sessions/credentials and stale legacy tests are not passes.
8. Actual remote CI execution and required `feature-one-gate` branch protection.

The [operations runbook](../docs/analysis-worker-operations.md#run-16-release-and-incident-procedure) documents schema/contracts → API/worker → private frontend order, a proposed one-worker/one-consenting-internal-owner start only after closure, zero-credit admission, rotation, retention, uncertain-model reconciliation, cleanup and rollback. Disable intake first during incidents, retain safe owner reads/deletion, keep revocation/maintenance/reconciliation active, and drain compatible queued versions or cancel them through the authorized API. Never rewrite historical reports, reset billing/lease rows to force work, or remove retained schema during rollback.

Run 16 adds no migration and does not modify local secrets or enable a flag. All pre-existing work from Runs 01–15 is preserved. No commit, push, remote deployment or external message was performed. Follow-up is closure of the named gates with attributable evidence, not a claim that all Feature 1 release requirements have passed.
