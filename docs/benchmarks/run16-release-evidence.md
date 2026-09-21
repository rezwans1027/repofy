# Run 16 release evidence — private Feature 1

Decision: **HOLD for rollout**. Runs 01–15 implement the scoped private workflow. Run 16 supplies integrated verification, frozen benchmarks, a recorded first human review and a fail-closed release decision. This is not a declaration that Feature 1's release milestone or the complete developer product has passed. No remote migration, deployment, provider call, customer charge or flag activation was performed.

The current [decision](run16-release-decision.json) lists every local and external gate. The [verification record](run16-verification.json) records actual commands, exit codes, timestamps and an implementation digest; an incomplete, failed or stale run is not accepted. Owners below are operational responsibility roles, not claims that individuals have been assigned or consulted.

## Reproducible evidence

| Artifact | What it establishes | What it does not establish |
|---|---|---|
| [Frozen corpus](../../repofy-backend/scripts/release/corpus.json), adjacent SHA-256 | 24 synthetic evaluation cases, annotated detector/file observations, role coverage, valid alternatives and uncertainty; development fixture hashes are recorded separately | Independently authored or blinded evaluation; representative production prevalence |
| [Component results](run16-results.json) | Real ingestion, extraction, aggregation, rendering and validators; known-pattern precision/recall, source spans, major references, neutral provenance, privacy sentinels and resource measurements | Provider quality/availability, network latency, hosted authorization or deployed capacity |
| [Frozen reviewed rendering](run16-reviewed-rendering.json), bound by the [review record](run16-human-review.json) | Exact application text matching the approved 22 major-claim cards and two unknown cards under the recorded corpus/domain versions | Approval of every claim or of a different equally ranked observation selected in another run |
| [30 frozen role vectors](../../repofy-backend/scripts/release/rubric-cases.json) | Expected requirement states, independent confidence/corroboration and retained unknown weight, six boundaries per role | Empirical role weights, detector accuracy, mobile/runtime support or improvement usefulness |
| [Integrated workload](run16-load.json) | Real HTTP/API, PostgreSQL 17 and worker with synthetic transports; 13 valid jobs, a separate over-limit rejection, queue/stage/API measurements, cleanup and cost ledger | Production SLA, actual model charges, maximum byte-volume capacity or real provider outage behavior |
| [Local configuration](run16-preflight.json) | Six flags disabled, empty analysis allowlist; credential presence booleans only | Remote deployment configuration, valid credentials, managed storage or accepted retention |
| [External gates](run16-external-gates.json) | Explicit pending checks, responsible roles and closure evidence | A pass merely because credentials or reviewers are unavailable |

Run from the repository root after installing the apps/contracts and Chromium, with Node 22 and PostgreSQL 17:

```bash
npm --prefix repofy-backend run release:verify
npm --prefix repofy-backend run release:preflight -- --record
npm --prefix repofy-backend run release:decision -- --record
npm --prefix repofy-backend run release:decision -- --require-ready
```

The final command must exit nonzero for the present HOLD. None of these commands deploys or enables the feature. `release:verify` runs the complete local gate sequentially; its load/browser harnesses need exclusive loopback ports 3190/3191. PostgreSQL uses a disposable local cluster or loopback `TEST_PG_ADMIN_URL`, never the application database. `release:benchmark` and `release:load` can be run separately; `--record` updates their safe aggregate artifacts. The corpus and role-vector hashes must not be changed to fit output.

## Quality and human interpretation

The evaluation found **24 true positives, zero false positives and one false negative**: observed precision 100%, recall 96% across 25 annotated positive detector/file observations. These are small counts for selected static patterns, not general analyzer precision/recall. The route/service detector missed the concise expression-body callback in `workspace_layers/packages/api/endpoint.ts`; its positive reference remains unchanged. [R16-Q01](../../repofy-backend/scripts/release/known-limitations.json) is an explicit P2 bounded-scope omission. Any new omission or unexpected observation fails the regression gate. A future correction needs a new immutable detector version and a new evaluation record.

All **58 rendered major claims have valid references**, and all **127 combined span/membership checks** pass. Privacy sentinels and contribution-confidence errors are zero for these 24 cases. Unsupported native and empty inputs stay unknown. Python and Java establish only their declared baseline structure. Dependencies, CI configuration, source assertions, forks, templates and generated files never become runtime proficiency, passing tests, misconduct or authorship conclusions. No reference-label or production scoring policy was changed in Run 16.

The requesting user replied **“Agree with all expected labels”** on September 20, 2026. That records 22/22 major claims supported, 0/22 unsupported, 2/2 unknown-card agreement and 30/30 hypothetical rubric-boundary agreement (6/6 per role), with no reported disagreement or uncertainty. The 95% Wilson upper bound for 0/22 is approximately **14.9%**, and these are correlated, unblinded convenience examples. The observed zero does not establish a population unsupported-claim rate below 2%. Calibration of weights, strength/confidence bands and improvement usefulness remains unmeasured. The [protocol](rubric-calibration.md) still requires the second independent engineering reviewer and documented role expertise, plus representative empirical judgments; a third reviewer resolves disagreement. No reviewer identity or expertise was invented.

The first gate run exposed a measurement defect: fresh test repository UUIDs can change which equally ranked observation supplies a capability's narrative (C02). The benchmark now binds labels to a frozen actual rendering matching the approved text and checks its corpus, domain and rendering hashes. Fresh-run differences are listed separately in `reviewedRendering.differingReviewCards`; they do not inherit approval. Six diagnostic replays exercised both C02 selections while retaining the same reviewed sample. This fix changes the benchmark, not production tie-breaking or approved wording. Review metrics explicitly describe the frozen sample.

## Requirement acceptance matrix

`B` below means the backend unit/integration suite; `PG` means real PostgreSQL (including independent connections/processes); `UI` means the five real report browser journeys plus selection and route suites. Exact commands and outcomes are in the verification record. All references are local synthetic evidence unless stated otherwise.

| Requirement | Implementation entry points | Automated / observed local acceptance | Remaining release evidence and owner |
|---|---|---|---|
| ANA-001 authorized selection | [selection](../../repofy-backend/src/domain/github-app/selection.ts), [picker](../../repofy-frontend/src/components/readiness/repository-picker.tsx) | B selection/analysis HTTP, PG tampering/consent/revocation, UI picker/start | Real App installation and organization scope — GitHub administrator |
| ANA-002 exact repository/branch/SHA | [ingestion](../../repofy-backend/src/domain/ingestion/service.ts), [rescan](../../repofy-backend/src/domain/rescans/service.ts) | PG first-pin races, policy isolation; UI branch movement after admission | Live exact-commit archive — GitHub administrator |
| ANA-003 asynchronous idempotent job | [worker](../../repofy-backend/src/domain/jobs/worker.ts), [progress](../../repofy-frontend/src/components/readiness/analysis-progress.tsx) | PG duplicate starts, two claimants/SIGKILL/stale lease, atomic settlement/draft recovery; UI reload/replay | Deployed supervision and outage drill — reliability operator |
| ANA-004 inventory and coverage | [pipeline](../../repofy-backend/src/domain/extraction/pipeline.ts), [coverage](../../repofy-backend/src/domain/coverage/achieved.ts) | B source types, count denominators, disabled parsers; corpus, bounded process checks, mixed UI | Larger representative workload and documented language limits — analyzer owner |
| ANA-005 structured evidence | [extraction](../../repofy-backend/src/domain/extraction/pipeline.ts), [detectors](../../repofy-backend/src/domain/detectors/rules.ts) | B source spans/metadata boundaries; PG forged observations/commit rejection; 127 reference checks | R16-Q01 omission; optional metadata needs real granted scopes — analyzer/GitHub owners |
| ANA-006 versioned mapping/confidence | [aggregation](../../repofy-backend/src/domain/aggregation/engine.ts), [policy](../../repofy-backend/src/domain/aggregation/policy.ts) | B duplicates, confidence ceiling, separate strength; PG immutable registry; 30 vectors | Independent detector/band/rubric calibration — evaluation lead |
| ANA-007 supported major claims | [narrative validator](../../repofy-backend/src/domain/synthesis/narrative.ts) | B forbidden claims/IDs/disclosure; PG tampering; 58/58 major references; 22 reviewed claims | Small sample; second independent review and pinned-model success — evaluation/model owners |
| ANA-008 evidence grouping | [reader](../../repofy-backend/src/domain/readiness/reader.ts), [explorer](../../repofy-frontend/src/components/readiness/evidence-explorer.tsx) | B/PG snapshot membership/pagination; UI per-repository/capability/role filters and citations | Human assistive technology — accessibility reviewer |
| ANA-009 all five roles | [rubrics](../../repofy-backend/src/domain/rubrics/catalog.ts), [role matching](../../repofy-backend/src/domain/aggregation/roles.ts) | Manifest/seed parity; PG registry; full-denominator arithmetic; five roles in every workload report | Role weights and engineering interpretation uncalibrated — evaluation lead |
| ANA-010 bounded evidence language | [renderer](../../repofy-backend/src/domain/synthesis/narrative.ts), [coverage UI](../../repofy-frontend/src/components/readiness/analyzer-coverage.tsx) | B statement-boundary attacks, C01–C24; native/empty five-role unknown UI | Broader empirical claim review — evaluation lead |
| ANA-011 prioritized improvements | [ranking/renderer](../../repofy-backend/src/domain/synthesis/narrative.ts), [report](../../repofy-frontend/src/components/readiness/readiness-report.tsx) | B deterministic ranking, meaningful template constraints; UI future-proof ordering | Representative usefulness/effort judgments — role engineering reviewers |
| ANA-012 improvement details | [narrative contracts](../../packages/contracts/src/narrative.ts), [reader](../../repofy-backend/src/domain/readiness/reader.ts) | Contract positive/negative fields; B acceptance/proof/effort/rationale; UI detail expansion | Usefulness and actual permitted locations only when available — evaluation lead |
| ANA-013 expandable reasoning | [assessment UI](../../repofy-frontend/src/components/readiness/report-assessments.tsx) | B/contract traces, UI reasoning and supporting-evidence focus/return | Human screen-reader traversal — accessibility reviewer |
| ANA-014 public/private/unverified distinctions | [reader](../../repofy-backend/src/domain/readiness/reader.ts), [report contracts](../../packages/contracts/src/report-view.ts) | B/PG owner projections; UI public-to-private link suppression/revocation; generalized sentinel checks | No public/employer Feature 1 route; provider retention approval — privacy owner |
| ANA-015 role focus | [focus](../../repofy-backend/src/domain/rescans/focus.ts), [role UI](../../repofy-frontend/src/components/readiness/role-focus.tsx) | B/PG focus authorization, UI persisted reorder without report rewrite or model call | Human assistive technology — accessibility reviewer |
| ANA-016 rescans/comparisons | [rescan service](../../repofy-backend/src/domain/rescans/service.ts), [comparison](../../repofy-backend/src/domain/rescans/comparison.ts) | B real synthetic histories, PG admission/revocation, UI unchanged reuse/new SHA/deleted baseline | Live permission/reconnect and deployed frozen-policy rollback — GitHub/reliability owners |
| ANA-017 feedback | [feedback service](../../repofy-backend/src/domain/feedback/service.ts), [feedback UI](../../repofy-frontend/src/components/readiness/finding-feedback.tsx) | Four labels, bounded comment, replay/edit/reviewer fences, export/deletion; UI no score rewrite | Named authorized reviewer operations — review administrator |
| ANA-018 provenance | [provenance](../../repofy-backend/src/domain/provenance/policy.ts) | B fork/template/generated/bulk/missing history; PG actual inventory/commit inputs; UI neutral context | Real optional metadata scopes and broader fairness sample — evaluation/GitHub owners |
| ANA-019 contribution confidence | [neutral policy](../../repofy-backend/src/domain/provenance/policy.ts), [panel](../../repofy-frontend/src/components/readiness/provenance-panel.tsx) | Null contribution confidence/modifiers; exact score equality with/without context; prior A–E and new C23/C24 review | Contribution remains unknown, not calibrated authorship. Independent interpretation review — evaluation lead |

ANA-020 issue creation remains an explicit P2 deferral. Feature 1 introduces no write permission or issue-creation flow.

### Shared support acceptance

| Requirement | Entry points and local evidence | Remaining boundary / responsible owner |
|---|---|---|
| CORE-001 account + verified identities | Auth controller/service regressions; [GitHub service](../../repofy-backend/src/domain/github-app/service.ts), PG identity conflict/reconnect/session tests | Hosted OAuth/account smoke — QA/GitHub administrator |
| CORE-002 identity separate from display | Stable provider IDs, changed-login/forged-identity PG tests | Live provider verification — GitHub administrator |
| CORE-003 server authorization | Service-only RPCs and RLS, live session middleware, all owner routes; B/PG/UI cross-owner checks | Hosted Auth/PostgREST verification — deployment operator |
| CORE-004 intent/audit | Selection attestation, idempotent start/rescan/feedback/delete; safe events checked in UI/PG | No sharing/submission consent workflow — later features |
| CORE-005 flags | [configuration](../../repofy-backend/src/config/feature-one.ts), B parent/child gates and flags-off reads, separate maintenance checks | Local flags all off; remote configuration unverified — deployment operator |
| GH-001 App installation | [client/service](../../repofy-backend/src/domain/github-app/client.ts), synthetic signed/scoped transports and PG links | Development App smoke — GitHub administrator |
| GH-002 minimum read permissions | Installation permission checks; optional metadata boundaries; [setup](../github-app-setup.md) | Verify actual App scopes; no write permissions — GitHub administrator |
| GH-003 selected repositories | Installation/user/repo relationship plus application selection and PG grant fences | Real selected/private/organization access — GitHub administrator |
| GH-004 short-lived tokens | In-memory mint/use; B transport expiry, redaction, no persistence/export | Live expiry and secret-store audit — security operator |
| GH-005 managed signing key | [vault](../../repofy-backend/src/domain/github-app/crypto.ts), key validation/redaction and local missing-credential preflight | Managed storage and rotation unverified — security operator |
| GH-006 signed access-change webhooks | [webhook](../../repofy-backend/src/domain/github-app/webhook.ts), raw-byte signature/replay/stale-event tests and PG races | Actual delivery/rotation smoke — GitHub administrator |
| GH-007 revoked access | Uncached stage/location checks and SQL revision/lease fences; B/PG mid-run revocation, UI locations hidden | Live revoke/reconnect — GitHub administrator |
| GH-008 attestation | Server-owned text/version/time; malformed/missing/foreign requests rejected in B/PG/UI | Record real authorized internal owner's selection — rollout owner |
| GH-009 organization relationship | User/installation/repository intersections, owner types and denied relationships in B/PG | Real organization installation — GitHub administrator |
| ING-001 commit pinning | [ingestion repository](../../repofy-backend/src/domain/ingestion/repository.ts), PG first pin and UI moving branch | Live archive relationship — GitHub administrator |
| ING-002 ephemeral isolation | [workspace](../../repofy-backend/src/domain/ingestion/workspace.ts), no-follow 0700 workspace, separate process/cleanup tests | Volume/RSS/native isolation/backup policy — reliability operator |
| ING-003 exclusions | [exclusions](../../repofy-backend/src/domain/ingestion/exclusions.ts), mandatory filters and `.repofyignore` adversarial tests | Scanner/exclusion limitations disclosed — analyzer owner |
| ING-004 pre-model filtering | [scanner](../../repofy-backend/src/domain/ingestion/scanner.ts), fail-closed contexts, synthetic secret/path/instruction sentinels through model and projections | No exhaustive secret-detection claim; actual provider policy — privacy owner |
| ING-005 processing bounds | Count/byte/context/time policies, heap/watchdog probes, 10,000 accepted/10,001 rejected workload | Maximum-byte deployed volume/RSS and network capacity — reliability operator |
| ING-006 no execution | Static parsers, no repository install/build/hooks/config evaluation; hostile execution sentinels/process checks | Host trust/container hardening — security operator |
| ING-007 raw deletion | Immediate disposal and orphan sweeper; terminal workspace checks and abrupt-process recovery | Actual volume sweep during DB/host outage under 60 minutes — reliability operator |
| ING-008 telemetry | Fixed errors; Sentry/analytics suppression, nested JSON/HTML/log/export sentinels, no private source in artifacts | Deployed logging/crash-dump audit — privacy operator |
| ING-009 bounded metadata | [metadata](../../repofy-backend/src/domain/extraction/metadata.ts), permission/SHA/pagination/result tests and provenance fixtures | Actual optional provider scopes/rate limits — GitHub administrator |
| CONS-003 hidden identifiers | Closed generalized contracts, encrypted locators, separate fresh location checks, no-store/cache/account-switch tests | No external sharing routes; later disclosure policy remains out of scope |
| CONS-006 analysis/account deletion | PG cascades/fencing/shared-reference tests, active/completed UI deletion, account service/export regressions | Managed backups, retention and restore/deletion replay — privacy/deployment operators |

ING-010 execution isolation for a future verified-build subsystem is deferred; no repository execution is introduced. Employer retention, per-claim disclosure and other consent workflows remain with Features 2–6.

## Failure, privacy and regression disposition

| Failure or surface | Check and measured boundary |
|---|---|
| Duplicate delivery/two claimants | `tests/postgres/jobs.cases.ts`: independent connections/processes admit one request/lease; winning claimant is SIGKILLed; replacement uses a new token after test-clock lease expiry; stale writes fail |
| Forced exit/orphan raw source | `ingestion:verify`: abrupt fixture-process exit leaves a workspace, fresh-process sweep removes it; `worker:verify` checks bounded supervision/maintenance lifecycle. Deployed active-job/volume outage drill remains pending |
| Partial snapshot loss | Real worker PG test removes its workspace between attempts and reuses persisted snapshot/draft without repeat synthesis |
| Model success before persistence | Reserved outcome with no durable draft is uncertain and never automatically regenerated; stored draft resumes validation; synthetic gateway refusals/rate limits/invalid choices are rejected |
| Settlement/acknowledgment loss | Independent PG connection closes before commit: report/charge roll back together; post-commit lost acknowledgment resolves by status; one reserve/settle or reserve/refund pair, no duplicate paid deductions in test ledger |
| Deletion/revocation during work | PG authorization/lease fences prevent stale completion/resurrection; UI active-job deletion plus stale heartbeat; account deletion preserves only other legitimate owners' references |
| Provider limits/deterministic validation | B GitHub pagination/rate/redirect/timeout bounds, model cost/size/schema limits, invalid final reports never publish; PG budget race cannot exceed $10/day fixture ceiling |
| Saved reads during outage | Integrated workload performs 150 report/history/evidence reads with both synthetic providers unavailable; no new model/download call. UI reload/evidence remains usable |
| Cross-user surfaces | Selections, jobs, reports, nested evidence, locations, preferences, rescans, comparisons, feedback, deletion and exports: missing/foreign indistinguishable in B/PG/UI |
| Leak surfaces | Synthetic source/credential/hidden-path/instruction/comment sentinels in internal/model/generalized JSON, rendered HTML/head, logs/Sentry/events, export/cache/account switch; copied report URLs remain owner-gated and private locations have no external URL |
| Public/employer routes | Feature 1 registers private owner routes only; `/api/v1/public/readiness-reports` and `/api/v1/employer/readiness-reports` return 404 in the integrated harness. Future public/employer projections are not enabled |
| Existing app | Full backend/frontend regressions cover auth, explorer, advice, credits, export and account deletion; PG upgrade preserves legacy records. Dedicated hosted browser regression remains pending and has stale legacy-analyze assumptions documented in [CI](../ci.md) |

No known P0/P1 implementation defect was left unresolved by the measured local checks. This statement does not turn unverified provider, calibration, operational or accessibility gates into passes. The one known detector omission is visible, does not inflate a score and is retained in recall.

## Performance, cost, accessibility and operations

The [load record](run16-load.json) gives exact final timings, sample counts, hardware, peak process RSS, generated archive bytes, and terminal-to-empty-workspace checks. Analysis time is split into queue, processing and end-to-end time; API measurements are loopback round trips. The workload has one worker, two queued jobs at most, five selected repositories at most and 13/13 valid completions. A 95% interval has a lower bound around 77.2%; it is not proof of a 95% population completion rate. The 10,001-file rejection is a separate deliberately invalid workload and is not silently removed from a valid-workload denominator.

The 13 synthetic model receipts report 13,000 input and 13,000 output tokens, estimated at $0.026 under the frozen policy; **actual provider spend is $0**. The per-call reservation is $0.05, per-job cap $0.10 and rolling global cap $10; budget races are checked against real PostgreSQL. Costs/prices here describe the checked-in policy, not verified current provider billing. Token-count stubs and a 105,169-byte generated archive cannot predict deployment resource use or model quality.

Keyboard focus/return, native control names, status/alert announcements, equivalent text for scores/unknown states, mobile overflow and axe/contrast are automated across selection/progress/report/evidence/focus/comparison/feedback. Synthetic [desktop](run16-mixed-desktop.png) and [mobile](run16-mixed-mobile.png) captures are visually reviewed separately. No human screen-reader pass is claimed. The independent accessibility gate lists the remaining core-flow traversal.

See [operations](../analysis-worker-operations.md#run-16-release-and-incident-procedure) for migration/contracts/API-worker/frontend order, one-worker internal-cohort proposal, secret rotation, provider retention, sweep deadlines, uncertain-model reconciliation, deletion/backups, incident response and compatible rollback. No new migration or production math/version is introduced. Branch protection must require the blocking `feature-one-gate`; actual remote configuration and CI execution remain unverified. The opt-in hosted suite now fails on missing setup or errors, with credential traces disabled; a skipped check supplies no evidence.
