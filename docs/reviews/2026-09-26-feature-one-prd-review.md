**Feature 1 PRD progress review — September 26, 2026**

**Verdict: REQUEST CHANGES for Feature 1 completion; keep rollout on HOLD.** The private evidence platform and developer workflow are substantially implemented. The central role-readiness outcome remains unavailable, browser metadata collection is incomplete, and semantic quality and external release acceptance remain unqualified. Completing the implementation runs has not completed the PRD's user outcome.

**Scope and method.** Reviewed `feature/project-evidence-readiness` at `8596ac8b99583e4f9e1f67e228c56095a7eda0d0` against the local `origin/main` base, `3dd07620fc2412e6570beedb035d9a919a8df660`: eight commits, 450 changed files, including large benchmark artifacts and implementation plans. The review covers [PRD Feature 1](/Users/rezwansheikh/VSC/Repofy/repofy/Repofy_PRD_v1.0.md:323), ANA-001–019, relevant CORE/GH/ING/CONS requirements, language coverage, scoring, privacy, reliability, tests and release gates. Features 2–6 and ANA-020 are intentional exclusions from this branch's completion criteria.

The existing September 25 reviews were context, not fresh verification. I traced current implementation paths, reproduced the two product gaps below, and reran the local verification sequence without overwriting release evidence. The pre-existing untracked September 25 Feature 1 review was preserved. No application code, migration, rollout flag, or provider configuration was changed.

**Finding 1 — High: No initial role can provide a usable readiness assessment.**

Requirements: ANA-006, ANA-009; PRD §§7.3, 9.1–9.2 and 9.6.

The [availability function](/Users/rezwansheikh/VSC/Repofy/repofy/packages/contracts/src/role-availability.ts:15) never returns `available`. This is an intentional safeguard for an underlying policy incompatibility: [achieved coverage](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/achieved.ts:74) marks positive behavioral capability observations as partially assessable, while [aggregation](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts:191) requires every scope to be fully assessable to assign Moderate confidence. Every required requirement in the five initial rubrics needs Moderate confidence and includes capabilities that cannot reach it under this combination.

A fresh probe used the fixture containing all 16 positive detector examples through real safe ingestion, extraction, aggregation and deterministic report rendering. It produced 55 evidence items and 15 assessed capabilities, but none of the 31 required role requirements was satisfied:

| Role | Required requirements satisfied | Recorded weighted coverage | User-facing readiness |
| --- | ---: | ---: | --- |
| Frontend | 0 / 6 | 4.40% | Unavailable |
| Backend | 0 / 6 | 2.75% | Unavailable |
| Full-Stack | 0 / 7 | 0% | Unavailable |
| Mobile | 0 / 6 | 4.40% | Unavailable |
| AI Application | 0 / 6 | 3.60% | Unavailable |

These percentages are this fixture's calculations, not achievable maxima or readiness measurements. The policy/rubric incompatibility establishes the wider problem. The [current regression test](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/tests/unit/domain/role-availability.test.ts:7) explicitly expects zero satisfied required requirements and five unavailable roles. Its passing result verifies the safeguard, not completion of ANA-009.

[ADR 0016](/Users/rezwansheikh/VSC/Repofy/repofy/docs/adr/0016-role-readiness-availability.md:1) correctly prevents misleading headline scores and role-score improvements in comparisons. Preserve that behavior until the assessment is qualified. Merely enabling the availability state or lowering thresholds would not resolve this finding.

**Completion condition:** qualify detector coverage, confidence policy and rubric minima together on representative implemented, weak and unassessable portfolios for all five roles. Introduce new immutable versions, explicitly register qualified availability, and add real detector-to-rubric acceptance cases that satisfy required requirements. Include a meaningful improvement/rescan example with valid evidence gains and an interpretable role result.

**Finding 2 — Medium: Browser analyses cannot collect commit, PR or provider CI evidence, and rescans discard an enabled metadata scope.**

Requirements: ANA-005, ANA-018; related ING-009 and ANA-016.

Both [initial analysis submission](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/analysis-progress.tsx:31) and [rescan submission](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/rescan-panel.tsx:36) hard-code `includeMetadata: { commits: false, pullRequests: false, ci: false }`. There are no browser controls to change these choices. The API and authorized collectors implement optional metadata, but this normal user journey never requests it.

A fresh collector probe with those browser inputs made zero provider calls and returned `not_requested`, with zero records, for all five metadata families: commits, pull requests, checks, statuses and Actions. As a consequence, [history-dependent provenance](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/provenance/policy.ts:15), including possible bulk initial commits and connected-author history, cannot be populated from browser-originated analyses. Static workflow files and fork/template context remain working, separate sources.

For an API-created report that requested metadata, a browser rescan also sends all three options as false. Scope caveats in comparisons reduce the risk of misinterpretation, but they do not preserve the original analysis choice.

**Completion condition:** expose optional metadata choices with permission-aware descriptions; preserve the baseline choices on rescan or require an explicit change; include the options in replay/idempotency scope. Verify browser-originated analysis and rescan with exact-commit CI and bounded history, plus denied-permission and unavailable-provider cases. An API-only boundary would need an explicit scope decision instead of a claim that the whole browser workflow is complete.

**Requirement-by-requirement progress.** “Implemented locally” means an integrated path and relevant local verification exist. It does not imply live-provider, deployment or human calibration acceptance.

| Requirement | Assessment | Evidence and remaining boundary |
| --- | --- | --- |
| ANA-001 — Select authorized repositories | Implemented locally | GitHub App discovery, saved selection, consent attestation, forged/foreign input rejection and browser start flow. Live private and organization installation qualification remains open. |
| ANA-002 — Record exact repository, branch and SHA | Implemented locally | Durable immutable pins, encrypted branch/locators and snapshot membership. Retries and branch movement have regression coverage. |
| ANA-003 — Async idempotent jobs and status | Implemented locally | Separate worker, claims/leases, fenced attempts, progress, retry/cancel, crash recovery and atomic report/settlement. Deployed supervision and recovery remain unverified. |
| ANA-004 — Inventory files, languages, frameworks, tests and config | Implemented within bounded scope | Inventory, exclusions and declared/achieved coverage exist. The PRD's broad deep-support ambition exceeds the current bounded pattern set. |
| ANA-005 — Evidence across all specified sources | Partial | Code/config/tests/docs paths exist. Browser commit/PR/provider-CI collection is unavailable; finding 2. |
| ANA-006 — Versioned capability mapping and confidence | Mechanism implemented; acceptance incomplete | Deduplication, independent strength/confidence and versioned maps exist. Confidence is uncalibrated and incompatible with required role thresholds; finding 1. |
| ANA-007 — Traceable or explicitly unverified major claims | Structural safeguards implemented | Closed model selections, deterministic prose and evidence membership validation are substantial. Current-version human semantic-support acceptance remains pending. |
| ANA-008 — Group by repository, capability and role requirement | Implemented locally | Private evidence explorer and filters reach owner-scoped, paginated observations. |
| ANA-009 — Initial role evidence coverage | Product outcome incomplete | All five rubrics calculate, but current role readiness is always unavailable or unknown; finding 1. |
| ANA-010 — Honest evidence language | Implemented locally | Strength, confidence, not-observed and not-assessable states are distinct. No employment recommendation is introduced. |
| ANA-011 — Prioritized improvements | Implemented; usefulness unqualified | Role/gap/proof/confidence/effort ranking is explainable. Representative usefulness and actual evidence gain need qualification. |
| ANA-012 — Improvement details | Implemented with location limits | Rationale, expected proof, acceptance criteria, effort and relevant project associations exist. Source change locations are not established; the PRD allows files only when available. |
| ANA-013 — Expand capability reasoning | Implemented locally | Calculation traces expose base evidence, corroboration, scope, confidence factors and limitations. |
| ANA-014 — Public/private/unverified distinctions | Implemented for private owner reports | Explicit verification/privacy labels and separately authorized location lookup. Candidate-authored profile content and employer sharing belong to later surfaces. |
| ANA-015 — Target role reorders content | Implemented locally | Stored role focus reorders capabilities, gaps, roles and improvements without rewriting the report or calling a model. |
| ANA-016 — Rescans and evidence comparisons | Implemented locally, with scope limitation | New-SHA pinning, compatible reuse, immutable baseline, history and qualified gained/lost/changed observations. Metadata selection continuity needs finding 2 resolved. |
| ANA-017 — Finding feedback | Implemented locally | Four labels, bounded private comments, replay/revision checks, controlled review and retention/export/deletion. UI controls cover capability and evidence findings. |
| ANA-018 — Provenance signals | Partial browser delivery | Fork/template and generated/vendor context exist. History-dependent signals remain unreachable from current browser inputs. |
| ANA-019 — Contribution confidence | Explicit unknown-only behavior | Context is visible, but confidence and numeric modifiers remain null. This avoids unsupported attribution; calibrated contribution assessment is not delivered. |
| ANA-020 — Create GitHub issues | Explicitly deferred P2 | Separate write permission and issue creation are outside this branch's agreed scope. |

**Evidence depth and improvement quality.** The current taxonomy contains 34 capabilities and 16 implementation detectors. Fourteen capabilities have implementation mappings; seven additional capabilities have only structural/presence mappings. Thirteen have no positive aggregation mapping: frontend state; mobile lifecycle, navigation and offline behavior; architecture boundaries; failure testing; secret management; diagnostics and health observability; AI context, evaluation and safety; and provenance origin. The separate provenance context panel does not constitute a scored provenance-origin capability.

The [coverage declaration](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/manifest.ts:4) limits implementation inspection to 256 files and 2 MiB, inside the larger ingestion limits. TS/JS/React/Express support is a bounded static pattern set. Next.js configuration and UI support do not establish server-route semantics; Python/Java are baseline; SQL/config/docs are largely structural; native-mobile and AI-runtime depth remain unsupported. These limits are disclosed, but they materially constrain PRD §7.2 and the five-role outcome.

The positive probe generated 29 improvement proposals from closed templates. Cards now identify the relevant capability, gap, roles and evidence/scope navigation. Proof gain and effort remain policy estimates, and change locations remain empty. ANA-011/012 should not be described as calibrated personalized coaching until representative usefulness review and before/after project examples establish that claim. Missing file-specific edits alone are not an additional requirement violation.

The frozen corpus retains one known omission, `R16-Q01`: concise expression-body route callbacks are not recognized by the route/service detector. It remains counted as a false negative. Address it in a new detector version when expanding coverage; it is separate from the central confidence/rubric problem.

**Shared foundations and engineering review.**

| Area | Assessment |
| --- | --- |
| CORE-001–003: authentication, identity and authorization | Existing login remains distinct from verified GitHub repository authority. Active-session, owner and actor checks protect routes and service-role RPCs. Employer workspace authorization is later scope. |
| CORE-004–005: intent, audit and flags | Selection, revocation, job mutations, deletion and feedback have audit/intent boundaries. Feature flags default off; new analysis also requires an owner allowlist and complete synthesis configuration. Saved reads and maintenance can continue while intake is off. |
| GH-001–004, GH-006–009 | Installation/user/repository intersections, short-lived scoped tokens, authorization attestation, signed webhooks and revision fences are implemented. Live installation, organization scope, permission changes and revocation/reconnect remain external acceptance. |
| GH-005: managed secrets | Application configuration and locator key handling exist. Managed storage and deployed key rotation still need operational evidence. |
| ING-001–008 | Commit pinning, bounded archive parsing, safe paths, exclusions, `.repofyignore`, sensitive-data screening, no repository execution and cleanup/sweeping have implementations and adversarial/process checks. Deployment must establish actual volume, RSS, telemetry and outage cleanup behavior. |
| ING-009–010 | Authorized optional metadata collectors exist; browser delivery is finding 2. Repository execution remains outside basic analysis as required. |
| CONS-003/006 | Owner-only reports, encrypted locators, fresh location authorization, account export and deletion are implemented. Backup/provider retention requires deployment evidence. Employer consent and per-claim sharing belong to later features. |
| Versioning and compatibility | Additive contracts, migrations and immutable snapshot/run/report dependencies are useful foundations. Deploy migrations/contracts before compatible API/worker/frontend code; legacy account export now depends on the Feature 1 export RPC. |
| Concurrency, recovery and billing | Real PostgreSQL tests cover independent claimants, stale leases, revoked/deleted work, immutable publication and settlement rollback/replay. Production Feature 1 uses internal free analysis; test-ledger correctness is not a shipped commercial entitlement system. |
| Performance and scale | Parser/time/size budgets, pagination, snapshot reuse and model reservations exist. The small synthetic load does not establish deployed p50/p95, representative completion, real provider costs or multi-worker capacity. |
| Maintainability | Domain modules and shared runtime schemas create useful boundaries. TypeScript policy, SQL validators, registered versions and UI interpretation must remain aligned. Detector-to-report qualification is especially important because passing layer tests can coexist with an unusable assessment. |
| Security and dependencies | No additional Critical source-disclosure, cross-owner-access or duplicate-settlement defect was demonstrated in inspected paths and fresh tests. Both production-only npm audits returned zero reported vulnerabilities; this is an advisory-graph result, not a general security guarantee. |
| UI and accessibility | Evidence navigation, labels, focus/return, status messaging, automated accessibility and mobile overflow have checks. Fresh role/improvement mobile captures were inspected. Human assistive-technology acceptance remains open. |

Good foundations worth preserving include the separation of immutable content from mutable access, source-free model input and deterministic claim rendering, real database concurrency tests, privacy-safe saved reads during provider outages, and explicit uncertainty instead of fabricated contribution or readiness claims.

**Release acceptance remains incomplete.** The [recorded decision](/Users/rezwansheikh/VSC/Repofy/repofy/docs/benchmarks/run16-release-decision.json:4) is HOLD with nine pending gates. Fresh local tests do not close them:

| Gate | What is still required |
| --- | --- |
| Current-version human claim-boundary review | New judgments bound to the current implementation and frozen rendered output. Older approvals are marked stale; current human support and unsupported-major-claim rates are null. |
| Independent calibration | A second independent engineering review, recorded role expertise, representative implemented/weak/unknown portfolios, empirical strength/confidence/rubric evaluation and improvement usefulness. |
| Live GitHub | A real development-App installation, selected private/organization access, exact-commit archive, optional permissions, signed deliveries and revoke/reconnect smoke. |
| Live model | Successful pinned-model request, validated schema/usage and confirmed provider handling. The saved HTTP 404 is historical; this review made no live model call and does not establish current availability. |
| Deployment operations and privacy | Migration compatibility, supervision, managed secrets, rotation, native resource bounds, cleanup through outages, backups/deletion, provider retention and incident recovery. |
| Representative capacity and cost | Realistic deployed workloads under supported repository limits, provider/network latency, completion rate, maximum-byte behavior and actual model cost. |
| Manual assistive technology | Human screen-reader traversal of the complete selection/progress/report/evidence/focus/comparison/feedback journey. |
| Hosted existing-app regression | Dedicated development-account verification of auth/explorer/advice/credits/export/deletion. |
| Required CI and protection | Remote CI pass and required branch-protection configuration. Read-only GitHub CLI queries returned no PRs or workflow runs for this branch during this review. |

The recorded/fresh automated corpus result is 24 expected detector true positives, zero false positives and one documented false negative; 58/58 rendered major claims have valid evidence membership. Reference integrity does not establish semantic support. The PRD's ≥90% human-support, <2% unsupported-major-claim and ≥95% completion targets remain unestablished for representative production use. Thirteen successful synthetic workload jobs are useful integration evidence, not a population completion estimate or live-provider qualification.

**Fresh verification.** All 22 local checks passed using Node 22.23.2. The release-verifier sequence was run with benchmark/load recording disabled and logs/verification JSON redirected outside the repository. Shared-contract tests were run separately as the first check; the remaining 21 checks ran in sequence. The implementation digest remained unchanged throughout: `80914953202eedd3aee9bacb177856f871ad5308e2638ad75d426362e08d2ce8`, matching the checked-in verification's implementation binding.

| Check | Fresh result |
| --- | --- |
| Shared contracts build, typecheck and tests | 84 tests passed |
| Backend typechecks and unit/integration coverage | 1,528 tests passed across 109 files |
| Disposable real PostgreSQL migrations, ownership and concurrency | 125 tests passed |
| Ingestion, worker, extraction, detector, coverage and aggregation process verification | All passed |
| Rubric manifest/SQL parity, frozen benchmark and integrated synthetic workload | All passed |
| Frontend lint, typecheck, production build and coverage | 585 tests passed across 88 files |
| Production-build readiness HTTP boundaries | 8 passed |
| Repository-selection browser journeys | 2 passed |
| Private report/worker/PostgreSQL browser journeys | 5 passed |
| Additional review probes | Reproduced role unavailability, zero satisfied required role criteria, mapping depth and disabled browser metadata |
| Production dependency audits | Backend 0 reported vulnerabilities; frontend 0 |

Total: **2,322 contract/unit/integration/PostgreSQL tests plus 15 HTTP/browser checks**. These totals include existing-app regressions. Both configured coverage gates passed; coverage is not a PRD completion percentage. The browser harness emitted `MaxListenersExceededWarning` messages while passing; this review did not establish a persistent memory leak from those per-response warnings. No live model, real GitHub installation, hosted account, deployed capacity or human accessibility pass is claimed.

Finding count: **0 Critical, 1 High product/implementation gap, 1 Medium workflow gap**, plus nine separately tracked release gates. The known detector omission does not change the two principal completion findings.

**Missing acceptance evidence to add.**

1. A real extraction-to-report case that satisfies required rubric requirements for each initial role, plus weak and unknown counterexamples. Keep hypothetical arithmetic tests, but do not treat them as proof that the analyzer can generate their inputs.
2. Browser metadata controls and preservation across rescans, including scope-sensitive replay, absent permissions, provider errors and exact-commit CI.
3. Representative project improvements that a reviewer considers useful, with plausible effort and a rescan showing the expected new evidence without changing historical reports.
4. Current-version human claim judgments and the live/operational/accessibility checks listed above. Synthetic provider success cannot replace these acceptance checks.

**Recommended completion order.** First resolve the detector/confidence/rubric incompatibility and qualify a useful role outcome. Then expose and preserve optional metadata, validate improvements on representative portfolios, and close the current-version human and external gates. Keep the existing uncertainty and privacy safeguards throughout. Treat this branch as an advanced private-evidence implementation with unfinished assessment acceptance, rather than assigning a completion percentage based on file count, completed runs or passing tests.
