**Feature 1 PRD review — September 25, 2026**

**Verdict: REQUEST CHANGES for Feature 1 completion; retain rollout HOLD.** The branch implements a substantial private evidence workflow, including real persistence, workers, evidence navigation, rescans and feedback. Its core role-readiness outcome remains unavailable, and its human/provider/operational acceptance is incomplete. A green local suite does not establish PRD completion.

Reviewed `feature/project-evidence-readiness` at `8596ac8b99583e4f9e1f67e228c56095a7eda0d0` against `main` at `3dd07620fc2412e6570beedb035d9a919a8df660`. The worktree was clean. The branch contains eight commits and changes 450 files, including generated benchmark artifacts and implementation documentation. The review covers PRD §9, its relevant shared requirements, language/role scope, quality targets and release gates. Features 2–6 and ANA-020 are deliberate deferrals outside this review's completion criteria.

The source of truth is [PRD v1.0](/Users/rezwansheikh/VSC/Repofy/repofy/Repofy_PRD_v1.0.md:323). Prior review and remediation documents were treated as context, with current behavior checked independently. No implementation, migration, rollout flag or stored release artifact was changed by this review.

**1. High — The branch still cannot provide usable readiness for any initial role.**

Requirements: ANA-006, ANA-009 and PRD §§9.1–9.2, 9.6.

The [availability projection](/Users/rezwansheikh/VSC/Repofy/repofy/packages/contracts/src/role-availability.ts:15) has no path that returns `available`. This accurately reflects the underlying limitation: [achieved coverage](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/achieved.ts:74) classifies positive behavioral patterns as partially assessable, while [aggregation](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts:191) permits Moderate confidence only when all capability scopes are fully assessable. All 31 required requirements across the five initial rubrics require Moderate confidence and depend on capabilities that cannot attain it under this policy.

A fresh probe passed the repository fixture containing all 16 positive detector examples through actual safe ingestion, extraction, aggregation and narrative rendering. It produced 55 evidence items and 15 assessed capabilities, with these results:

| Role | Required requirements satisfied | Recorded coverage | Displayed readiness |
| --- | ---: | ---: | --- |
| Frontend | 0 / 6 | 4.40% | Unavailable |
| Backend | 0 / 6 | 2.75% | Unavailable |
| Full-Stack | 0 / 7 | 0% | Unavailable |
| Mobile | 0 / 6 | 4.40% | Unavailable |
| AI Application | 0 / 6 | 3.60% | Unavailable |

These percentages describe this synthetic fixture's stored calculations, not achievable maxima or developer readiness. The stronger conclusion about unattainable required requirements follows from the policy and rubric combination above.

[ADR 0016](/Users/rezwansheikh/VSC/Repofy/repofy/docs/adr/0016-role-readiness-availability.md:1) correctly mitigates misleading presentation, preserves immutable calculations, and withholds role-score changes in comparisons. That is a successful remediation of the presentation problem. It leaves the PRD's central question—what roles the projects support—unanswered.

**Required next work:** qualify detector coverage, confidence and role requirements together using representative implemented, weak and unknown portfolios. Publish new immutable versions and explicitly register qualified availability. Add an acceptance case that satisfies a required requirement through the real detector-to-rubric pipeline, plus a meaningful before/after rescan case. Preserve honest uncertainty; changing thresholds merely to obtain higher numbers would not establish validity.

**2. Medium — Browser users cannot include commit, PR or provider CI evidence.**

Requirements: ANA-005, ANA-018; related ING-009 and ANA-016 scope continuity.

Both [initial analysis](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/analysis-progress.tsx:31) and [rescan submission](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/rescan-panel.tsx:36) hard-code `includeMetadata: { commits: false, pullRequests: false, ci: false }`. Neither flow offers controls to change this. The [metadata collector](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/github-app/metadata-client.ts:118) therefore skips every provider metadata family even when read permissions exist.

A fresh collector probe with the browser defaults made zero provider calls and returned `not_requested` with zero records for commits, pull requests, checks, statuses and Actions. The API and collector support these inputs, but the normal browser journey cannot obtain them. Consequently, [history-dependent provenance](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/provenance/policy.ts:15), including the possible bulk-initial-commit signal and connected-author history, cannot be populated by that journey. Fork/template context and static workflow-file observations remain separate working paths.

A report created through the API with metadata enabled also loses that requested scope on a browser rescan. The UI discloses that metadata is off, and comparisons qualify scope changes; those protections prevent silent interpretation but do not complete the user workflow.

**Required next work:** expose optional metadata choices with permission-aware explanations, and let users preserve or explicitly change them during rescans. Include those choices in request replay/idempotency scope. Verify one browser-originated analysis and rescan that persist exact-commit CI and bounded history evidence, including denied-permission and unavailable-provider states. If API-only metadata is an intentional release boundary, record it as an explicit Feature 1 scope deferral.

**Current requirement assessment.** “Implemented locally” means that an integrated path and relevant automated checks exist. Live GitHub/model success, production operation and independent semantic calibration remain separate gates for all applicable rows.

| Requirement | Current assessment | Evidence and remaining work |
| --- | --- | --- |
| ANA-001 — Authorized repository selection | Implemented locally | GitHub App discovery, saved selection, attestation and server authorization. Browser and database cases reject foreign/forged references. Live App/organization qualification remains. |
| ANA-002 — Exact repository, branch and SHA | Implemented locally | Durable pins, encrypted branch/locators, snapshot identity and immutable version dependencies. Branch movement and rescan pinning are tested. |
| ANA-003 — Async, idempotent job and visible status | Implemented locally | Separate worker, leases, attempt fencing, stage UI, retry/cancel/recovery and atomic report/settlement. Deployed supervision/recovery remains unverified. |
| ANA-004 — Inventory and coverage | Implemented within bounded scope | Files, exclusions, languages, dependency/framework declarations, tests, CI/config and metadata coverage are recorded. Broad PRD deep-support ambition remains only partially covered. |
| ANA-005 — Structured evidence across sources | Partial browser delivery | Code/config/test/docs extraction and provider collectors exist. The browser disables commit/PR/provider-CI collection; see finding 2. |
| ANA-006 — Versioned capability mapping/confidence | Mechanism implemented; acceptance partial | Deterministic aggregation, deduplication, corroboration and separate strength/confidence are present. Confidence is uncalibrated and incompatible with required role thresholds; see finding 1. |
| ANA-007 — Traceable or explicitly unverified claims | Implemented locally | Closed model selections, evidence membership/scope checks and deterministic text validation. Current human semantic-support acceptance remains pending. |
| ANA-008 — Repository/category/requirement grouping | Implemented locally | Project, capability and role-requirement navigation reach owner-scoped paginated evidence. |
| ANA-009 — Initial role evidence coverage | Incomplete product outcome | All five rubrics calculate; every current readiness projection is unavailable or unknown. |
| ANA-010 — Appropriate evidence language | Implemented locally | Strength/confidence and not-observed/not-assessable states are distinct; current UI avoids treating unusable role values as readiness. |
| ANA-011 — Prioritized improvement plan | Implemented; usefulness unqualified | Server-owned relevance/gap/proof/confidence/effort ranking and role associations exist. Realistic recommendation usefulness and resulting evidence gains still need qualification. |
| ANA-012 — Complete improvement details | Implemented with location limits | Rationale, expected proof, acceptance criteria, effort, project associations and gap identity are visible. Cards link to scope/evidence; no actual change location is established, and `permittedLocations` remains empty. |
| ANA-013 — Expandable reasoning | Implemented locally | Capability calculations expose selected evidence, corroboration, confidence factors and scope. |
| ANA-014 — Public/private/unverified distinctions | Implemented for owner reports | Explicit evidence labels, owner-only projections and permission-checked location lookup. Candidate-written evidence entry and external sharing are later surfaces. |
| ANA-015 — Target-role reordering | Implemented locally | Saved focus reorders recorded capabilities, improvements and role views without modifying the immutable report or invoking the model. |
| ANA-016 — Rescan and version comparison | Implemented locally, with scope caveats | Pinned new work, compatible reuse, immutable baseline, history and qualified evidence differences. Browser metadata scope limitation is finding 2. |
| ANA-017 — Finding feedback | Implemented locally | Four choices, private comments, revision/idempotency fences, controlled review, export/retention/deletion. The visible controls cover capability/evidence findings; APIs support additional finding kinds. |
| ANA-018 — Provenance signals | Partial browser delivery | Fork/template and generated/vendor context exist. History-dependent signals have collectors but are unavailable through the current browser inputs. Heuristic uncertainty is explicit. |
| ANA-019 — Contribution confidence | Explicit unknown-only implementation | Context is shown, but contribution confidence and numeric modifiers remain null. This is a defensible uncertainty policy, with no calibrated attribution assessment delivered. |
| ANA-020 — Create a GitHub issue | Deliberately deferred P2 | No write permission or issue creation workflow. This does not block the scoped P0/P1 milestone. |

The capability engine contains **34 capabilities and 16 implementation detectors**. Fourteen capabilities have implementation-pattern mappings; seven additional capabilities have structural/presence mappings; thirteen have no positive aggregation mapping. The latter are frontend state; mobile lifecycle/navigation/offline; architecture boundaries; failure testing; secret management; diagnostics/health observability; AI context/evaluation/safety; and provenance origin. The provenance context panel is separate from a scored `provenance_origin` capability.

The [coverage declaration](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/manifest.ts:4) limits implementation inspection to 256 files and 2 MiB. Supported TypeScript/JavaScript/React/Express behavior is a bounded pattern set; Next.js configuration/UI support does not establish Next.js server-route semantics. Python and Java are baseline, SQL/config/docs are largely structural, and native mobile/AI runtime capability depth remains unsupported. These limitations are disclosed and appropriately conservative. They still constrain completion of PRD §7.2 and the five-role product.

The all-positive probe generated 29 proposals from the closed improvement-template system. The revised cards identify their different capabilities and gaps. Their proof and effort estimates remain policy values, and no source-specific edit plan is generated. ANA-011/012 need representative usefulness review and before/after evidence cases before being described as calibrated, personalized coaching. Empty change locations alone are not a requirement violation: ANA-012 only requires relevant files when available.

**Shared foundations and engineering review.** The inspected paths cover correctness, authorization/privacy, concurrency, failure handling, performance bounds, API/schema compatibility, architecture, maintainability, dependencies and tests.

| Area | Assessment |
| --- | --- |
| CORE-001/002/003 | Existing authentication and separately verified GitHub identities are preserved. Active-session, ownership and explicit actor checks protect the Feature 1 routes/RPCs. Employer workspace authorization is outside Feature 1. |
| CORE-004/005 | Audited selection/revocation/deletion/job mutations and default-off flags exist. New analysis additionally requires the internal owner allowlist and complete configured handlers. Saved-report reads and cleanup can continue while intake is disabled. |
| GH-001–004, 006–009 | GitHub App access, repository-scoped read tokens held in memory, verified webhooks, revisions and fresh provider checks are implemented. Selection includes private/organization authorization attestation. Live installation, permission and revoke/reconnect acceptance remains open. |
| GH-005 | Private-key configuration exists; managed-secret storage and rotation require deployed evidence. Locator encryption supports retained read keys. These are distinct credential lifecycles. |
| ING-001–008 | Commit pinning, bounded archive parsing, safe paths, security exclusions, `.repofyignore`, likely-secret screening, no repository execution and cleanup/sweeping have implementations and synthetic/process tests. Production storage/RSS/logging/retention drills remain open. |
| ING-009/010 | Bounded optional provider metadata is implemented behind request options; browser delivery is incomplete. The future execution subsystem remains correctly outside basic analysis. |
| CONS-003/006 | Private defaults, source-free projections, encrypted locators, on-demand location authorization, deletion and account export are present. Backup/provider retention still requires operational qualification. Employer consent/sharing controls belong to later features. |
| Versioning and integrity | Shared strict contracts, immutable runs/reports, snapshot membership, recorded policy/model/rubric dependencies and additive migrations form a reusable foundation. Deployment must apply migrations before compatible application code. |
| Reliability and billing | Real PostgreSQL tests exercise owner isolation, concurrency, stale attempts, immutable publication and duplicate settlement. Production Feature 1 uses `internal_free_v1`; test-unit billing is not a shipped commercial entitlement model. |
| Performance and cost | File/parser/time/memory boundaries, pagination, compatible snapshot reuse, model reservations and job/global budgets exist. The small synthetic workload does not establish production completion, p50/p95 latency or actual provider cost. |
| Maintainability | Domain modules and shared runtime contracts give the feature useful boundaries. Correctness depends on keeping TypeScript policy, SQL validation, version registration and UI interpretation aligned. Existing parity tests help; future qualification must exercise the complete chain. |
| Dependencies | Fresh production-only npm audits returned zero reported vulnerabilities for both applications. This covers the installed production dependency graph and registry advisories, not every possible security defect. |

No additional Critical source-disclosure, cross-owner access or duplicate-settlement defect was demonstrated in the inspected paths and fresh synthetic verification. This review does not replace the pending deployed threat-model and privacy acceptance.

**Status of the previous review's findings.**

| Previous finding | Current head |
| --- | --- |
| Unattainable role readiness | Presentation corrected by ADR 0016; underlying product acceptance remains open as finding 1. |
| UPSERT/optional-INTO MERGE crossing schema-only admission | Reproduced forms are covered by current screening and policy `1.1.4`, with regression checks passing. No claim of universal SQL-dialect completeness. |
| Indistinguishable improvement cards | Corrected: capability/gap/role identity and direct scope/evidence navigation are rendered and covered by browser checks. |
| Missing PR change-detector permission | Corrected in `.github/workflows/ci.yml`: the `changes` job grants `pull-requests: read`. Remote execution/protection is still unqualified. |

**Release acceptance remains open.** The [recorded release decision](/Users/rezwansheikh/VSC/Repofy/repofy/docs/benchmarks/run16-release-decision.json:4) is HOLD with nine pending gates: current-version human claim-boundary review; independent role/improvement calibration; live GitHub; successful pinned-model integration; deployed operations/privacy/recovery; representative capacity/cost; human assistive-technology review; hosted existing-app regression; and remote required CI/protection.

The implementation digest independently recomputed during this review is `80914953202eedd3aee9bacb177856f871ad5308e2638ad75d426362e08d2ce8`, matching the recorded release evidence. The frozen benchmark records 24 expected detector true positives, zero false positives and one documented false negative, with 58/58 valid major-claim references. Current human claim support, unsupported-major-claim rate and role calibration remain null because older approvals do not qualify the changed implementation. The PRD's ≥90% human support, <2% unsupported major claims and ≥95% completion targets have not been established for representative production use.

The stored provider smoke records a historical HTTP 404; it is not evidence of current provider availability. This review made no live model call. The production composition still requires successful synthesis before publishing a new report. Read-only GitHub CLI queries returned no PRs or workflow runs for this branch, so no remote CI pass is claimed. Live-account, deployment, branch protection and independent human gates were not completed by this local code review.

**Fresh verification.** Node 22.23.2 was used explicitly. All 22 local verification checks passed against the unchanged implementation, using the release verifier's command sequence with recording disabled for benchmark/load runs and separate temporary logs.

| Check | Fresh result |
| --- | --- |
| Shared contracts build/typecheck/tests | 84 tests passed |
| Backend typechecks, unit/integration tests and coverage | 1,528 tests passed across 109 files |
| Disposable real PostgreSQL migrations/authorization/concurrency | 125 tests passed |
| Ingestion, worker, extraction, detector, coverage and aggregation process checks | Passed |
| Rubric manifest/SQL parity, frozen benchmark and integrated synthetic load | Passed |
| Frontend lint/typecheck/build, tests and coverage | 585 tests passed across 88 files |
| Production-build readiness HTTP boundaries | 8 passed |
| Repository-selection browser journeys | 2 passed |
| Private report/worker/PostgreSQL browser journeys | 5 passed |
| Additional review probes | Confirmed role unavailability/required-threshold failure, mapping depth and disabled browser metadata collection |

Total: **2,322 contract/unit/integration/PostgreSQL tests plus 15 HTTP/browser checks**. These totals include existing-app tests. Both configured coverage gates passed; they are not PRD completion percentages. Fresh mobile role/improvement/mixed-report screenshots were inspected. Automated keyboard/axe/overflow checks passed; human screen-reader acceptance remains pending. A useful UX follow-up is to place a concise evidence summary above role-focus/rescan controls, matching PRD §29.2's summary-first hierarchy.

**Recommended completion order:** qualify an attainable and useful role assessment under new versions; expose and preserve optional metadata choices; validate improvement usefulness on representative portfolios and rescans; then close the current-version human and external rollout gates. The evidence platform and private workflow are far along. Completing Feature 1 now depends primarily on measurement validity and user-visible evidence depth, followed by live and operational acceptance.
