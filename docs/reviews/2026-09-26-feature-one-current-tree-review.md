**Feature 1 current-tree PRD review — September 26, 2026**

**Follow-up:** the later [role and scope remediation](2026-09-26-prd-role-and-scope-fixes.md)
addresses the two implementation findings below with detector v2 and aggregation
v3. This review remains a record of the earlier working tree; its release-acceptance
requirements are not automatically qualified by that remediation.

**Verdict: REQUEST CHANGES before declaring Feature 1 complete. Keep rollout on HOLD.** The branch has a substantial private evidence platform and an integrated developer workflow. The latest work resolves browser metadata selection and makes some required role criteria attainable. Remaining work includes detector coverage, scoring behavior on ordinary repository contents, and current-version release acceptance.

**Scope.** Reviewed `feature/project-evidence-readiness` at `8596ac8b99583e4f9e1f67e228c56095a7eda0d0`, including its existing uncommitted and untracked implementation changes, against local `main`/`origin/main` at `3dd07620fc2412e6570beedb035d9a919a8df660`. The committed branch contains eight commits; the tracked working-tree comparison spans 450 files. This review covers PRD Feature 1, ANA-001–019, supporting CORE/GH/ING/CONS requirements, and relevant quality, privacy, performance, accessibility and release requirements. ANA-020 and Features 2–6 remain intentional exclusions.

The earlier September 25/26 reports are historical context. Findings below reflect the latest aggregation v2, metadata UI, migrations and tests. No application source, migration, provider configuration, rollout flag or remote repository setting was changed. This report and its supporting evidence are new review artifacts.

**Finding 1 — High: The initial role set still exceeds what the analyzer can demonstrate.**

Requirements: ANA-006/009; PRD §§7.2–7.3 and 9.6.

The [detector registry](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/detectors/registry.ts:63) maps 16 implementation patterns to 14 of the 34 capabilities. Seven additional capabilities have only structural/presence mappings; 13 have no positive aggregation mapping. These include frontend state, all three mobile capabilities, architecture boundaries, failure testing, secret management, AI context/evaluation/safety and observability.

This is a structural acceptance gap, beyond pending calibration. Every required rubric component must meet its own strength, confidence, implementation and corroboration minima in [evaluateRequirement](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/rubrics/policy.ts:25). Under the current registered mappings:

- All six required **Mobile** requirements are unattainable. Three need unmapped mobile capabilities; testing needs unmapped failure testing; security needs unmapped secret management; interaction includes accessibility whose maximum permitted strength is too low.
- At least five of six required **Frontend** requirements are unattainable for the same mapping/ceiling reasons. The remaining interaction requirement also fails independent corroboration in the current source-based acceptance fixture.
- Accessibility has a base strength of 0.40 and at most one enabled 0.10 corroboration bonus. Its optimistic ceiling is 0.50, below the unchanged 0.55 required minimum. This observation should remain narrow; increasing its score would not add the missing evidence.
- Backend, Full-Stack and AI Application now have an attainable recovery requirement. Their other missing compound capabilities still constrain the role result.

Fresh ingestion → extraction → aggregation probes using the checked-in `rolePortfolio()` fixture produced:

| Role | Required criteria satisfied | Provisional weighted coverage | Unknown requirement weight |
| --- | ---: | ---: | ---: |
| Backend | 1 / 6 | 10.40% | 42% |
| Frontend | 0 / 6 | 5.20% | 60% |
| Full-Stack | 1 / 7 | 5.50% | 52% |
| Mobile | 0 / 6 | 5.20% | 82% |
| AI Application | 1 / 6 | 6.50% | 64% |

These are invented fixture results, not representative portfolio scores or theoretical maximum role scores. The mapping/ceiling analysis establishes the impossible required components independently of the fixture. The [new acceptance test](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/tests/unit/domain/bounded-role-coverage.test.ts:18) appropriately asserts unknown mobile capabilities and unmet requirements; a passing test does not establish a usable Mobile assessment.

The [availability projection](/Users/rezwansheikh/VSC/Repofy/repofy/packages/contracts/src/role-availability.ts:27) now returns `provisional / calibration_pending` for the registered v2 combination, and the UI labels this honestly. It still has no qualified `available` combination. [ADR 0017](../adr/0017-bounded-role-evidence-coverage.md) explicitly acknowledges this boundary. This finding concerns the unfinished PRD outcome, not an allegation that the branch currently claims calibrated readiness.

**Completion condition:** expand supported detectors and meaningful corroboration for the missing role-critical capabilities; validate representative implemented, weak and unsupported portfolios separately for all five roles; qualify confidence/rubrics and improvement usefulness with independent review. Register new immutable versions. Preserve unknowns and existing report semantics; merely changing the availability label or lowering minima would not establish the missing evidence.

**Finding 2 — High: A harmless excluded file removes satisfied required criteria without changing the evidence.**

Requirements: ANA-006/009/016 and ING-003; PRD §§9.6 and 16.5.

[coverageFor](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts:27) adds the repository's entire excluded-file count to every capability's denominator. The [v2 Moderate label](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts:195) then requires `fraction === 1` for every selected snapshot and rejects `security_exclusions` among the reasons. [Mandatory exclusions](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/ingestion/exclusions.ts:19) include `.repofyignore` itself, even when it is empty, along with binary assets and `.env.example`.

I independently reprocessed the same portfolio with each of these additions. All variants retained the same 16 evidence items and no aggregation validation errors:

| Added file | Recovery strength / numeric confidence | Recovery label | Backend coverage | Required criteria satisfied across all roles |
| --- | --- | --- | ---: | ---: |
| None | 0.65 / 0.55 | Moderate | 10.40% | 3 |
| Empty `.repofyignore` | 0.65 / 0.55 | Low | 3.25% | 0 |
| `public/logo.png` | 0.65 / 0.55 | Low | 3.25% | 0 |
| `.env.example` containing only `PORT=3000` | 0.65 / 0.55 | Low | 3.25% | 0 |

Full-Stack coverage also falls from 5.50% to 0%, and AI Application from 6.50% to 0%. The PNG probe exercises the extension exclusion with a synthetic placeholder; no image decoding is involved. Most decisively, the empty ignore file does not hide any source, yet merely adopting the product's own ignore mechanism removes every satisfied required criterion in this fixture.

This behavior follows the deliberate conservative policy in ADR 0017; it is not a TypeScript/SQL disagreement. It remains a product scoring problem: confidence in unchanged bounded observations is coupled to unrelated packaging files. Comparisons correctly warn about incomplete scope and withhold role deltas, but that warning does not repair the report's changed requirement classifications.

**Completion condition:** version a policy that distinguishes known non-source/policy exclusions from missing or unassessed relevant source, while retaining counts and uncertainty. Keep lower confidence for genuinely unresolved imports, parser failures, omitted relevant source, invalid evidence and exhausted budgets. Require metamorphic tests showing which irrelevant repository additions leave evidence classifications stable, and which real scope losses must reduce confidence. Update SQL recomputation and TypeScript together; do not remove source-screening exclusions to improve scores.

**Progress against the PRD.** “Implemented locally” means code paths and local verification exist. It does not mean production qualification. The table tracks user outcomes rather than completed implementation-run labels.

| Requirement | Current assessment | Supporting behavior and remaining boundary |
| --- | --- | --- |
| ANA-001 — Authorized selection | Implemented locally | GitHub App discovery, per-repository saved selection, authorization attestation and server ownership checks. Real private/organization App qualification remains open. |
| ANA-002 — Exact repository/branch/SHA | Implemented locally | Durable pins, encrypted branch/locators, snapshot membership and retry/branch-movement checks. |
| ANA-003 — Async idempotent jobs | Implemented locally | Separate supervised worker, claims/leases, heartbeats, bounded retries, cancellation, replay-safe publication and settlement. Deployed operation is unqualified. |
| ANA-004 — Inventory | Implemented within bounded scope | Files, exclusions, languages, manifests, tests, configuration and achieved coverage. Broad PRD “deep support” remains larger than the current pattern set. |
| ANA-005 — Structured evidence sources | Implemented locally; browser gap resolved | Source/config/tests/docs plus opt-in commit/PR/check/status/Actions metadata now reachable from the browser. Optional denied/unavailable sources remain explicit. |
| ANA-006 — Mapping/confidence | Partial acceptance | Versioned deterministic mapping, deduplication and traces exist; findings 1–2 and empirical calibration remain. |
| ANA-007 — Supported claims | Safeguards implemented; semantic acceptance pending | Closed evidence references, deterministic statements, capability boundaries and SQL/publication validation. Current human claim-support target is unestablished. |
| ANA-008 — Three groupings | Implemented locally | Repository, capability/category and role-requirement evidence navigation with owner-scoped pagination. |
| ANA-009 — Five role templates | Partial product outcome | Five rubrics calculate; v2 is provisional. Required Mobile/Frontend coverage is structurally constrained; finding 1. |
| ANA-010 — Honest evidence language | Implemented locally | Strength/confidence, not-observed/not-assessable and provisional availability are distinct. No hire/reject or seniority output is introduced. |
| ANA-011 — Prioritized plan | Mechanism implemented; usefulness unqualified | Role relevance, gap, proof, confidence and effort traces exist. Proposals use closed templates; representative usefulness and actual proof gain need review. |
| ANA-012 — Improvement details | Implemented with location limits | Rationale, proposed proof, acceptance criteria, effort, roles and relevant repositories. No source change location is established; the PRD makes files conditional on availability. |
| ANA-013 — Explain capability | Implemented locally | Expandable calculation, source/base/corroboration citations and coverage limits. |
| ANA-014 — Verification/privacy distinctions | Implemented for owner-only scope | Public/private evidence labels, unverified/proposed text and separately authorized location lookup. Candidate content authoring and employer sharing remain later surfaces. |
| ANA-015 — Role focus | Implemented locally | Saved preference reorders capabilities, gaps, roles and improvements without editing the immutable report or calling a model. |
| ANA-016 — Rescan/compare | Implemented locally, subject to finding 2 | New commit pins, compatible reuse, metadata-aware replay, unchanged baselines and qualified evidence differences. Latest browser rescan preserves original metadata choices. |
| ANA-017 — Finding feedback | Implemented locally | Accurate/inaccurate/unclear/irrelevant, bounded comments, revisions, idempotency, controlled review, deletion and export. |
| ANA-018 — Provenance signals | Implemented locally when enabled | Fork/template, generated/vendor, possible bulk-root and bounded history signals. Browser metadata now enables history-dependent context. Live GitHub qualification remains open. |
| ANA-019 — Contribution confidence | Context-only boundary | Explicit Unknown and null modifiers for every assessment. ADR 0015 deliberately avoids an uncalibrated authorship estimate. A calibrated contribution-confidence assessment is not delivered. |
| ANA-020 — GitHub issue creation | Intentionally deferred P2 | Separate write permission and issue creation are outside this branch's agreed implementation scope. |

The workflow is substantially built. The remaining Feature 1 work is concentrated in what the evidence can substantiate, how robustly it is scored, and whether measured acceptance supports exposing it to users. Test totals and implementation-run counts are not a product completion percentage.

**Changes that the latest remediation successfully delivers.**

- [Metadata controls](../../repofy-frontend/src/components/readiness/metadata-options.tsx) expose explicit opt-in choices and explain each read permission. Saved permission details are advisory; collectors reauthorize current access.
- Initial analyses and rescans include those choices in their replay scope. Session persistence preserves choices through uncertain responses/remounts. The owner report projection retrieves the original job options, including requests that could not be fulfilled by the provider.
- Synthetic browser acceptance uses actual HTTP routes, PostgreSQL, the worker and authorized collectors. It covers truncated commit history, exact-commit PR/CI metadata, history-derived provenance, preserved choices, denied PR permissions and unavailable CI without discarding static source evidence.
- Aggregation `2.0.0`/`2.1.0` permits Moderate confidence in qualifying bounded observations, keeps v1 records readable and preserves pinned supported queued policies. Old and incomplete/incompatible comparisons withhold role deltas. The new source fixture demonstrates a recovery-evidence gain while preserving the baseline.

**Shared foundations and review dimensions.**

| Area | Assessment and practical boundary |
| --- | --- |
| CORE-001–003 / authentication and authorization | Verified GitHub identity is distinct from profile naming. Active sessions, owner checks, installation/repository intersections and service-role RPC guards are implemented. Inspected/tested owner boundaries did not reveal a new cross-user access defect. |
| CORE-004–005 / audit and rollout | Intent/audit paths exist for selection, deletion, revocation, rescans and feedback. Intake requires feature flags, an owner allowlist and synthesis configuration. Saved reads and maintenance remain independent of intake. |
| GH-001–004, GH-006–009 | Read-only selected-repository token minting, attestation, verified webhooks, access revisions and revocation checks are substantial. Live installation/organization/permission/reconnect behavior still needs acceptance evidence. |
| GH-005 / managed secrets | Injected private keys, authenticated locator encryption, repository-scoped keyed fingerprints and retained read-key rotation support exist. Actual managed storage/rotation remains deployment work. |
| ING-001–008 / source handling | Pinned downloads, archive/path guards, bounded parsing, mandatory exclusions, secret scanning, no repository execution, disposal and independent crash sweeping have adversarial and process checks. Finding 2 concerns interpretation of exclusions, not removal of the security boundary. |
| ING-009–010 | Optional metadata is independent and SHA-related. Standard analysis does not execute repository code; a verified-build subsystem remains out of scope. |
| CONS-003/006 / privacy and retention | Owner-only reports, current-visibility projections, fresh location authorization, source-free model input, telemetry restrictions and export/deletion are implemented. Deployed backup/provider retention is unverified. |
| Correctness and reproducibility | Immutable artifact chains, explicit version references, traceable arithmetic and SQL recomputation are strong foundations. Findings 1–2 concern the supported outcome and policy semantics despite internally consistent computation. |
| Breaking changes and deployment | APIs/contracts/migrations are additive. Shared contracts and migrations must precede matching API/worker/frontend builds; existing account export now depends on the Feature 1 export RPC. Drain incompatible queued jobs before rollback. |
| Reliability and billing | Real PostgreSQL cases exercise competing claims, stale workers, ownership, revocation/deletion, publication and atomic settlement. Shipped Feature 1 policy is internal/free; test credit-ledger coverage is not a commercial entitlement rollout. |
| Performance and scalability | Bounded detectors/parsers, pagination, snapshot reuse, model reservations and independent supervision exist. Synthetic loopback timing is not a representative deployed p95/completion/cost measurement. |
| Architecture / maintainability | Domain modules and shared runtime schemas provide boundaries. Policy semantics are duplicated across TypeScript, SQL, contracts and UI; parity checks and immutable version changes are essential. No style-only rewrite is warranted by this review. |
| Error handling | Failure classes, safe response envelopes, optional metadata limitations and source-free errors are present. Saved reports do not need an available model provider. |
| Dependencies | Fresh production-only npm audits returned zero reported advisories for both apps. This is an advisory-database result, not proof that all dependencies are safe. |
| UX / accessibility | Automated tests cover navigation, accessible roles, keyboard focus, privacy labels, axe and mobile overflow. Human screen-reader qualification remains open. |
| Tests | Meaningful contract, detector counterexample, authorization, database concurrency, worker-process and browser tests exist. The main missing evidence is representative product acceptance, not another count of implementation-mirroring unit tests. |

The broad-support boundary remains important: implementation detection is capped at 256 files / 2 MiB, with 256 KiB structural parser inputs and explicit reduced-scope outcomes, inside larger ingestion limits. TypeScript/JavaScript/React/Express use a bounded static pattern language; Next.js server semantics are not comprehensively assessed; Python/Java are baseline; native-mobile and AI-runtime depth is unavailable. These limitations are disclosed but still constrain the PRD's initial role promise.

Improvement ranking likewise remains a policy estimate: `expectedProof` is 0.5 for assessable gaps, template effort is fixed, and `permittedLocations` is empty. The cards provide useful traceability and proposed acceptance criteria. No representative evaluation yet establishes personalized usefulness or expected score improvement. Unknown coverage correctly receives zero ranking confidence.

**Release acceptance is still blocked.**

Running `npm run release:decision` in this review returned exit 1 with **“Benchmark predates current domain implementation.”** Historical `run16-*` release artifacts are bound to the earlier source. I preserved them and wrote fresh verification separately; the new tests do not silently recertify historical human approvals.

The recorded HOLD lists nine pending gates. Their current implications are:

| Gate | Remaining evidence |
| --- | --- |
| Current-version human claim review | Source/rendering-bound judgments; the fresh regression benchmark still reports human claim support, unsupported-major-claim rate and role calibration as null. |
| Independent calibration | A second independent engineering review, role expertise, representative portfolios, confidence/strength/rubric evaluation and improvement usefulness. |
| Live GitHub | Development-App selected public/private/organization repositories, exact-commit archive, optional permissions, signed deliveries and revoke/reconnect. |
| Live model | Successful pinned-model request, output/schema/usage validation and provider-handling review. This review made no live/paid model call; the earlier HTTP 404 is historical. |
| Deployment operations/privacy | Remote migration compatibility, supervision, resource bounds, managed keys, outage cleanup, deletion/backups, provider retention and incident recovery. |
| Representative capacity/cost | Supported-size repositories, provider/network latency, concurrent demand, actual model cost and production-like completion. |
| Human assistive technology | Screen-reader traversal of selection → progress → report → evidence → focus → comparison → feedback. |
| Hosted existing-app regression | Dedicated development-account auth/explorer/advice/credits/export/deletion verification. |
| Required CI/protection | Fresh read-only GitHub queries returned no PRs or workflow runs for this branch. Classic required-status-check protection returned “Branch not protected”; effective rules for `main` returned `[]`. Configure required checks and obtain remote CI results before relying on a merge/release gate. |

The workflow itself defines a fail-closed `feature-one-gate`, but this is not currently enforced by protection on `main` according to the queried repository state. No remote setting was changed. Full public developer-product release also needs the later profile disclosure gates; this Feature 1 branch cannot satisfy those later surfaces.

**Fresh verification.**

All **22 local verification checks passed**, using Node 22.23.2. The existing verifier sequence ran sequentially with benchmark/load recording disabled and its output redirected outside the repository. Implementation digest stayed unchanged throughout: `af3349ba7041aaeba5e6f3ff27de236e7a8eee27daa2115fc25efb98959b893c`.

| Check | Fresh result |
| --- | --- |
| Shared contracts typecheck/build/tests | 85 tests passed |
| Backend typechecks and tests with coverage | 1,536 tests passed across 110 files |
| Disposable real PostgreSQL migrations/ownership/concurrency | 127 tests passed |
| Ingestion, worker, extraction, detector, coverage and aggregation process verification | All passed |
| Rubric manifest/seed parity | Passed |
| Frozen synthetic regression corpus | 24 true positives, 0 false positives, 1 documented false negative; 58/58 major claim references valid |
| Integrated synthetic workload | 13/13 jobs completed; no terminal workspaces retained |
| Frontend lint/typecheck/production build/tests with coverage | 591 tests passed across 89 files |
| Production-build readiness HTTP boundaries | 8 passed |
| Repository-selection browser journeys | 2 passed |
| Report/worker/PostgreSQL browser journeys, including metadata | 6 passed |
| Review-specific exclusion perturbations | Reproduced finding 2 for all three added-file variants |
| Production-only dependency audits | 0 reported vulnerabilities in either app |
| Release decision using saved artifacts | **Exit 1: stale benchmark source binding** |

Total: **2,339 contract/unit/integration/PostgreSQL tests plus 16 HTTP/browser checks**. Backend line/branch coverage was 90.98% / 86.07%; frontend was 84.53% / 76.03%. Both configured coverage gates passed. These totals include existing-app regressions.

The benchmark's one known false negative is `R16-Q01`, the concise expression-body route callback. The fresh human support, unsupported-major-claim and role-calibration metrics remain null. Reference integrity and synthetic 13/13 completion do not establish the PRD's semantic-support or representative production completion targets.

Mobile metadata, role and improvement captures were inspected. Automated layout/accessibility checks passed; this is not a human screen-reader pass. The browser harness emitted repeated `MaxListenersExceededWarning` messages while passing. This review did not establish a persistent memory leak from those response-listener warnings.

[Machine-readable review evidence](2026-09-26-feature-one-current-tree-evidence.json) records the 22 commands, exit codes, source binding, measured results, probe method and remote read-only observations. The older release artifacts were not overwritten.

**Highest-value remaining acceptance work, in order.**

1. Resolve role-critical mapping/corroboration gaps using representative positive and negative portfolios. Demonstrate meaningful attainable criteria for each initial role, not merely a nonzero supporting-role percentage.
2. Revisit exclusion handling through a new policy version. Add empty-ignore and non-source-asset invariance checks alongside genuine incomplete-source cases, plus TypeScript/SQL parity and rescan checks.
3. Review improvement usefulness on real authorized projects and demonstrate before/after evidence gains while historical reports stay immutable. Qualify ANA-019 separately if a contribution-confidence assessment is still intended.
4. Regenerate release artifacts against the final implementation, obtain current human judgments, complete live provider/operational/accessibility/hosted acceptance, and enforce the required CI gate.

**Finding totals:** 0 demonstrated Critical defects; 2 High product/scoring completion gaps. Release gates and explicitly documented contribution/coverage limits are tracked separately. There is substantial good engineering here: strict evidence membership, private-by-default reads, no source execution, deterministic publication, real concurrency tests and explicit uncertainty should be preserved during completion work.
