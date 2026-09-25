# PRD progress review — September 25, 2026

Follow-up: [implementation and verification of the requested fixes](2026-09-25-prd-progress-remediation.md). The findings below describe the reviewed state before those changes.

**Verdict: REQUEST CHANGES; retain the rollout HOLD.** This branch delivers a substantial local implementation of the shared evidence foundation and Feature 1. It does not yet meet the PRD's product or release definition of done. The most important product gap is that the analyzer and role rubrics cannot produce positive coverage for any required role requirement. Features 2–6 remain future work.

**Scope:** `repofy`, branch `feature/project-evidence-readiness`, HEAD `7fed2e1`, compared with `main` at `3dd0762`, including the September 25 uncommitted changes and new migration. The tracked branch/worktree diff contains 442 changed files; the untracked regression test and migration were also included. This is a requirements-driven review of the branch, focused implementation paths, migrations/authorization boundaries, tests, and release evidence. It is not a claim that every changed line received equal scrutiny. The sibling `repofy-engine` repository is outside this review. No application code, flags, deployments, or remote resources were changed.

The controlling specification is [PRD v1.0](/Users/rezwansheikh/VSC/Repofy/repofy/Repofy_PRD_v1.0.md), read alongside the branch's ADRs and [requirement map](</Users/rezwansheikh/VSC/Repofy/repofy/feature one implementation/REQUIREMENTS.md>). Deliberately deferred product surfaces are distinguished below from implementation defects and unverified release gates.

## Findings

### 1. High — Required role coverage is unreachable with the current analyzer policy

**Requirements:** ANA-006, ANA-009, ANA-011; PRD §§9.2, 9.6, 17, 18.5.

**Locations:** [achieved coverage](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/achieved.ts:74), [confidence classification](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts:189), [requirement evaluation](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/rubrics/policy.ts:45), and [role contributions](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/roles.ts:21).

Behavioral capability coverage is always `partially_assessable`, even when a supported positive pattern is detected. Aggregation only permits a Moderate label when every selected capability scope is `assessable`. Consequently, behavioral evidence always has Low confidence. All **31 required requirements across the five rubrics require Moderate confidence**, and an unmet requirement contributes zero to coverage.

This is not merely an unfortunate score for a weak repository: the current production rules cannot satisfy any required role requirement. Full-Stack also has no attainable supporting requirement, so its numerical coverage cannot rise above zero. Other roles can receive small contributions from peripheral supporting requirements.

A fresh probe used the existing `implementationRepository()` fixture, which contains all 16 detectors' positive examples, through real ingestion/extraction, aggregation, and narrative preparation:

| Role | Observed coverage | Optimistic current-policy upper bound | Requirement able to contribute |
|---|---:|---:|---|
| Backend | 2.75% | 3.25% | Performance/resources |
| Frontend | 4.40% | 5.20% | Performance/resources |
| Full-Stack | 0% | 0% | None |
| Mobile | 4.40% | 5.20% | Performance/resources |
| AI Application | 3.60% | 4.40% | Data modeling |

The upper bounds generously allow a +0.10 linked-test bonus on every supported detector, even where such a link may not be realizable. They are bounds, not measured achievable scores. The fixture's 55 evidence items and 15 positively assessed capabilities still produce these results.

[ADR 0011](/Users/rezwansheikh/VSC/Repofy/repofy/docs/adr/0011-evidence-aggregation.md) explicitly documents the conservative confidence policy. This finding concerns the resulting PRD readiness gap, not an undocumented arithmetic regression. Showing limitations is correct, but the role output currently cannot discriminate the core engineering capabilities the rubrics are intended to measure.

**Action:** Calibrate the detector/coverage/confidence policy and the attainable role requirements together, then issue new immutable versions. Until an honest, useful role measurement is supported, present the relevant role assessment as limited/unavailable rather than treating these near-zero scores as a completed readiness product. Do not simply inflate confidence or lower thresholds to make percentages look better.

**Missing acceptance test:** A representative repository must pass a required role requirement through the actual detector → achieved coverage → aggregation → rubric chain. The existing hypothetical role vectors can inject confidence levels that the current extraction pipeline cannot produce.

### 2. Medium — Data-bearing SQL still crosses the schema-only extraction boundary

**Requirements:** ING-003/004; PRD §22.2; the branch's explicit schema-only SQL policy.

**Locations:** [DML screening](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/ingestion/exclusions.ts:47), [final DML checks](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/ingestion/exclusions.ts:97), and [extractor admission](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/ingestion/service.ts:154).

The denylist does not recognize CockroachDB `UPSERT INTO`, or SQL Server `MERGE` when its optional `INTO` keyword is omitted and its insert clause has no target name. Both are documented data-writing forms. See [Cockroach Labs' UPSERT examples](https://www.cockroachlabs.com/blog/sql-upsert/) and [Microsoft's MERGE syntax](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql?view=sql-server-ver17).

The following synthetic inputs both return `false` from `containsSqlData`:

```sql
CREATE TABLE customer_records (id INT PRIMARY KEY, note TEXT);
UPSERT INTO customer_records VALUES (1, 'SYNTHETIC_PRIVATE_CUSTOMER_NOTE');
```

```sql
CREATE TABLE records (id INT, note varchar(200));
MERGE records AS t
USING (VALUES (1, 'SYNTHETIC_PRIVATE_CUSTOMER_NOTE')) AS s(id, note)
ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, note) VALUES (s.id, s.note);
```

Passing these as `schema.sql` and `migrations/002.sql` through `extractionFixture` produced **2 eligible files, 0 excluded files, and 2 schema observations**. Both raw values were readable through the supposedly filtered extractor capability. This also reproduces with the uncommitted security policy `1.1.3`.

**Impact boundary:** The raw sentinel did **not** appear in the resulting evidence bundle. This review has not demonstrated disclosure to the model, reports, or another user. The defect is admission of data-bearing SQL into a boundary explicitly intended to exclude it.

**Action:** Extend the lexical screening for these forms, including stored bodies and comments, or restrict schema admission to explicitly understood statement forms. Version the corrected ingestion policy so a corrected scan cannot reuse an artifact admitted by the old policy.

**Missing tests:** Denial at `SafeSnapshotContext.files/readText`, plus positive schema-only controls, for both SQL forms. Testing only the regex return value would miss an ingestion wiring regression.

### 3. Medium — Improvement cards hide which gap each recommendation addresses

**Requirements:** ANA-011/012; PRD §9.7.

**Locations:** [improvement rendering](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/report-assessments.tsx:80), [template-based proposals](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/synthesis/narrative.ts:119), and [unverified claim rendering](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/report-shared.tsx:40).

The backend retains `capabilityIds`, `gapIds`, and `roleIds`, but the visible card presents the generic template title/rationale and numeric priority without the capability or gap label. Different gaps therefore render as the same task. The all-positive probe produced 29 recommendations, including visually indistinguishable cards for:

- `ai_context`, `ai_evaluation`, and `frontend_state`;
- `ai_safety`, `architecture_boundaries`, `security_secrets`, and `testing_failures`;
- `security_authorization` and `security_input_handling`.

These groups match in the card's title, rationale, acceptance criteria, proof, effort, priority, priority reasons, and repository list. The hidden IDs are what distinguish them. A candidate cannot tell which specific gap a card addresses in the unfiltered plan.

All 29 proposals also have empty `permittedLocations`. The owner reader deliberately clears that field, and the UI tells the candidate to inspect supporting evidence, but the rationale is unverified and therefore renders no supporting-evidence button. This is an additional limitation of ANA-012's actionable-location experience; a safe existing evidence location is not automatically proof that it is the correct place to make the proposed change.

**Action:** Display the capability/gap and relevant role labels, provide a direct path to the corresponding evidence/scope, and combine repeated template tasks where that preserves their distinct gap associations. Resolve any actually known file locations on demand through the existing owner-authorized location API; source names do not need to enter the model input.

**Missing test:** Render two distinct gaps using the same template and assert that users can identify each gap and navigate to its associated evidence or coverage limitation.

### 4. High, inherited — The PR CI workflow lacks the permission its change detector requires

**Requirements:** PRD §§27.1, 28.5; Run 16 required CI gate.

**Locations:** [workflow permissions](/Users/rezwansheikh/VSC/Repofy/repofy/.github/workflows/ci.yml:31), [change detector](/Users/rezwansheikh/VSC/Repofy/repofy/.github/workflows/ci.yml:54), and [blocking gate](/Users/rezwansheikh/VSC/Repofy/repofy/.github/workflows/ci.yml:288).

The workflow grants only `contents: read`. `dorny/paths-filter@v3` uses the pull-request files API for `pull_request` events and requires `pull-requests: read`, which is not granted globally or on the `changes` job. The action documents this requirement in its [supported workflows](https://github.com/dorny/paths-filter/tree/v3#supported-workflows).

The new Feature 1 gate depends on `changes`; it cannot establish successful PR verification if change detection is denied. This permission omission already exists on `main`, so it is **not attributed to a new branch regression**. It remains directly relevant to claiming this branch has a working required PR gate.

**Action:** Grant `pull-requests: read` to the change-detection job, run the workflow on a real PR, and verify required-check configuration. Local checks do not exercise this GitHub authorization boundary. Read-only CLI queries found no open PR or workflow run for this branch at review time; no remote failure was claimed or fabricated.

## Progress against the complete PRD

| Product surface | Assessment | What remains |
|---|---|---|
| Shared evidence foundation / Milestone 0 | Substantially implemented for the private Feature 1 slice | Live qualification, calibration, and the later surfaces' concrete consent/disclosure/workspace behavior |
| Feature 1: Project Evidence and Role Readiness | Broad local implementation; product usefulness and release acceptance incomplete | Findings above; realistic attainable role assessment; live and operational gates |
| Feature 2: Verified Profile, PRO-001–015 | Not delivered by this branch | Profile creation, immutable publish versions, private/unlisted/public visibility, preview, disclosure, revoke/rotate, export |
| Feature 3: Job-Specific Optimization, JOB-001–016 | Not delivered by this branch | Pasted-job parser, editable rubric, requirement matching, project selection, truthful talking points, saved jobs |
| Feature 4: Repo Defense, DEF-001–018 | Not delivered by this branch | Practice/Verified sessions, evidence-linked questions, autosave, adaptive follow-ups, grading, preview and sharing |
| Feature 5: Hiring Assessment, HIRE-001–023 | Not delivered by this branch | Workspaces/roles, invitations, consent, candidate preview/submission, employer authorization and reports |
| Feature 6: Interview Prep, INT-001–014 | Not delivered by this branch | Duration-bound guides, questions/signals/follow-ups, versioning, print/export and disclosure checks |

Those later features are deliberate milestone deferrals, not reasons to expand this PR. Existing GitHub profile exploration, the generic advisor, and legacy evaluation/comparison screens do not satisfy the new PRO/JOB/DEF/HIRE/INT workflows. The branch is best described as a **Milestone 1 implementation awaiting qualification and product corrections**, not a nearly finished six-surface product. A single overall completion percentage would obscure the reusable foundation and the five absent user journeys.

## Feature 1 requirement assessment

“Implemented locally” means a real local path and relevant automated checks exist. It does not mean live-provider, production, calibration, or accessibility acceptance has passed.

| ID | Assessment | Evidence and remaining limitation |
|---|---|---|
| ANA-001 | Implemented locally | Authorized discovery/selection, attestation, forged/cross-owner rejection; live App installation and organization access unverified |
| ANA-002 | Implemented locally | Repository/branch/SHA pinning, encrypted branch retention and immutable snapshot identity; branch-movement and persistence tests |
| ANA-003 | Implemented locally | Separate worker, durable stages, idempotency, leases, retries/recovery, atomic publication/settlement and progress UI; deployment recovery unverified |
| ANA-004 | Implemented within bounded scope | Inventory, exclusions, dependencies, structural parsers and achieved coverage; broad “deep support” is not yet established |
| ANA-005 | Implemented within bounded scope | Code/config/test/docs/history/PR/CI observations; many sources provide presence/context only, and real optional provider scopes are unverified |
| ANA-006 | Partial product acceptance | Versioned deterministic aggregation and separate strength/confidence exist; empirical calibration and useful attainable role confidence remain open |
| ANA-007 | Strong local implementation | Membership, scope and closed narrative selection are checked; current human semantic-support metrics remain unavailable |
| ANA-008 | Implemented locally | Repository, capability/category and role-requirement navigation, with owner-scoped evidence pagination |
| ANA-009 | Partial | All five rubrics calculate and render, but none of their required requirements can currently contribute; see finding 1 |
| ANA-010 | Implemented locally | Evidence language, unknown/not-observed distinctions and no hire/seniority claim; numerical role usefulness still limited |
| ANA-011 | Partial | Deterministic role/gap/proof/confidence/effort ranking exists; cards lose specific gap identity and usefulness is uncalibrated |
| ANA-012 | Partial | Rationale, proposed proof, acceptance criteria, effort and repository associations exist; gap context and actionable location behavior need work |
| ANA-013 | Implemented locally | Expandable calculation, scope, selected evidence and corroboration traces |
| ANA-014 | Implemented for owner reports | Public/private/unverified labels, private-by-default projections and fresh location checks; no candidate-authored evidence-entry or external sharing product |
| ANA-015 | Implemented locally | Persisted role focus reorders recorded capabilities/improvements without rewriting the report or invoking the model |
| ANA-016 | Implemented locally | New-SHA rescans, authorized compatible reuse, immutable baseline, history and qualified comparisons; real revoke/reconnect still unverified |
| ANA-017 | Implemented locally | Four choices and private comments on capability/evidence UI, revision/idempotency fences, controlled review, retention/export/deletion; reviewer operations need qualification |
| ANA-018 | Implemented as bounded context | Fork/template/generated/vendor/bulk-history/identity-association signals; missing context remains unknown |
| ANA-019 | Honest unknown-only implementation | Contribution confidence and modifiers remain null. This meets the uncertainty boundary; it is not calibrated attribution or an authorship assessment |
| ANA-020 | Correctly deferred P2 | No issue creation or write permission workflow |

The main entry points inspected were the [worker](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/jobs/worker.ts), [GitHub authorization service](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/github-app/service.ts), [ingestion](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/ingestion/service.ts), [extraction pipeline](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/extraction/pipeline.ts), [detectors](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/detectors/rules.ts), [aggregation](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/aggregation/engine.ts), [narrative validation](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/synthesis/narrative.ts), [owner reader](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/readiness/reader.ts), [comparison](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/rescans/comparison.ts), and the [report UI](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-frontend/src/components/readiness/readiness-report.tsx).

## Coverage and shared-platform limits

The taxonomy has **34 capabilities**: 14 have implementation-pattern detectors, 7 additional capabilities have structural/presence mappings, and 13 have neither a positive implementation nor structural aggregation mapping in the current engine. The latter are frontend state; mobile lifecycle/navigation/offline; architecture boundaries; failure testing; secret-management capability; diagnostics/health observability; AI context/evaluation/safety; and provenance origin. The separate provenance context panel does not turn `provenance_origin` into a scored capability.

There are 16 implementation detectors. TypeScript/JavaScript/React/Express support is a bounded static pattern set. Next.js server routing remains unsupported; SQL/config/CI/documentation are largely structural; Python and Java are baseline; native mobile and AI runtime capabilities remain unsupported. [The coverage manifest](/Users/rezwansheikh/VSC/Repofy/repofy/repofy-backend/src/domain/coverage/manifest.ts:5) limits implementation inspection to 256 files and 2 MiB, despite ingestion accepting up to 10,000 eligible files. These limits are disclosed and can be reasonable, but they should not be described as completion of the PRD's broad deep-support ambition.

| Shared requirements | Assessment |
|---|---|
| CORE-001/002 | Existing account auth and separately verified GitHub identities are implemented; hosted OAuth remains unverified |
| CORE-003/004 | Owner authorization and audit/mutation controls are exercised locally; workspace roles and employer consent are later work |
| CORE-005 | Flags and owner allowlisting exist, default off; saved reads and maintenance can continue while intake is disabled |
| GH-001–009 | App/client/session/grant/webhook paths implemented with selected-repository scoped tokens and encrypted locators; actual App, secret storage/rotation, organization and revocation behavior need live qualification |
| ING-001/002/005/006/007/008 | Pinning, bounded archive handling, ephemeral workspace lifecycle, no repository execution and source-free output controls exist; deployed RSS/volume, cleanup under outages and logging need proof |
| ING-003/004 | Exclusions and likely-secret scanning implemented, with the reproduced SQL admission gap in finding 2 |
| ING-009 | Bounded, permission-aware metadata collection implemented locally; live permissions/provider behavior unverified |
| ING-010 | Execution subsystem correctly deferred; basic analysis does not execute repository code |
| CONS-003/006 | Private owner projections, location checks, deletion and export implemented; managed backup retention/deletion still unverified |
| CONS-001/002/004/005/007 | Employer consent/preview/immutable submissions, disclosed retention and per-claim sharing are future surfaces; private defaults are not substitutes for those workflows |
| §25 entitlements | Server repository/admission limits exist; production Feature 1 billing is `internal_free_v1`. Test-unit settlement is not a completed commercial entitlement/credit rollout |

## Release gates and quality evidence

The current [release decision](/Users/rezwansheikh/VSC/Repofy/repofy/docs/benchmarks/run16-release-decision.json:5) correctly records nine pending gates:

1. A new human boundary review bound to the current implementation.
2. Independent engineering calibration and usefulness review.
3. Live GitHub App installation, selection, exact-commit archive and revoke/reconnect verification.
4. Successful pinned-model integration and provider-handling review.
5. Deployed worker supervision, migration/rollback, secret handling, cleanup, deletion and recovery drills.
6. Representative deployed capacity, latency, reliability and cost measurements.
7. Human assistive-technology review of the core flows.
8. Hosted existing-app regression.
9. Successful remote CI and required-check protection.

The existing model smoke artifact records a 404 for the pinned model. It establishes a historical failed smoke, not the provider's current availability; no live model call was made for this review. Production composition still requires successful model configuration and synthesis to publish a new report. Saved reports remain independent of provider availability.

The stored benchmark reports 24 true positives, 0 false positives and 1 known false negative on its frozen detector sample, plus 58/58 major-claim reference checks. However, **current human claim support, unsupported-major-claim rate, and role-rubric calibration are null**, and the human approval is stale for the corrected implementation. Historical approvals cannot satisfy the PRD's ≥90% human support and <2% unsupported-claim targets for this version. The 13-job synthetic workload does not establish ≥95% population completion, production p95 latency, or actual provider cost.

The release verifier's recorded implementation digest matches this reviewed working tree: `867c9cb253023729ad8fd5ab39c38acfeae4e26acbf8e57cfb2b0edcc009335c`. This supports the relevance of its existing local artifacts; it does not turn their external pending gates into passes.

## Fresh verification performed

Node **22.23.2** was explicitly used instead of the shell's Node 26 default.

| Check | Result |
|---|---:|
| Shared contracts build, typecheck and tests | 83 tests passed |
| Backend typecheck, build and unit/integration suite | 1,511 tests passed |
| Disposable real PostgreSQL migration/authorization/concurrency suite | 125 tests passed |
| Frontend typecheck, lint, production build and unit suite | 583 tests passed |
| Production-build readiness HTTP boundaries | 8 passed |
| Repository-selection browser journeys | 2 passed |
| Private report/worker/PostgreSQL browser journeys | 5 passed |
| Additional review probes | Confirmed role reachability, SQL admission bypasses and indistinguishable improvement cards |

That is **2,302 contract/unit/integration/PostgreSQL tests plus 15 HTTP/browser checks**. The first selection-browser run used a production build pointing at the normal localhost API instead of the synthetic harness, and failed. Rebuilding with the documented `API_BACKEND_URL=http://127.0.0.1:3191/api` resolved that setup mismatch; both selection journeys and all five report journeys then passed. This was not treated as an application defect.

Fresh desktop and mobile screenshots from the mixed-language report journey were visually inspected. The inspected screens wrap and remain usable at the tested sizes. Automated axe/keyboard checks do not replace the pending human screen-reader review. The report's opening screen devotes substantial space to role-focus/rescan controls before evidence results; moving a concise results summary higher would better serve PRD §29.2.

The existing release process/coverage/load artifacts were inspected and their implementation binding checked; those extra process and load commands were not all rerun. No hosted-account, real GitHub, paid model, production operations or independent human calibration run is claimed.

## What is working well

- Shared runtime contracts and immutable analyzer/rubric/model versions provide a usable foundation for the later surfaces.
- Durable jobs use leases, stale-attempt fencing and atomic settlement/publication; the real PostgreSQL suite exercises concurrency rather than only mock calls.
- Owner authorization, fresh permission checks for locations, encrypted locators and generalized projections provide multiple independent privacy boundaries.
- Narrative generation uses closed selections and deterministic, evidence-bound text, with publication-time validation instead of trusting arbitrary model prose.
- Unknown scope, absence of evidence and contribution uncertainty are explicitly distinguished. Forks/templates do not trigger invented authorship penalties.
- Release artifacts retain stale approvals as historical and preserve HOLD. This is more credible than equating a green synthetic suite with production readiness.

## Recommended next acceptance work

1. Correct the SQL admission gap and the inherited CI permission problem. Exercise the gate on a real PR.
2. Make the analyzer/rubric combination capable of an independently reviewed, useful role assessment. Add attainable-requirement and realistic portfolio/rescan cases before declaring ANA-006/009 complete.
3. Make each improvement identifiable and navigable to its actual gap/evidence; qualify actionable location support and recommendation usefulness.
4. Complete the nine external gates with evidence bound to the corrected version, while retaining private, disabled intake until qualification is complete.
5. Then proceed to Milestone 2's Verified Profile and Job Match using this shared evidence foundation. They are the next product slice, not small remaining tasks inside Feature 1.

Three current-branch findings were identified (one High, two Medium), plus one High inherited CI blocker. No Critical issue or external source disclosure was demonstrated. The remaining release gates and deferred features are tracked separately from that defect count.
