**Feature 1 branch review — September 26, 2026**

**Verdict: REQUEST CHANGES.** Feature 1 has a substantial, integrated implementation, but it is not yet PRD-complete or ready for rollout. Two reproduced detector defects publish unsupported verified claims and preserve inflated role coverage. Improvement file targeting remains incomplete. Independent product qualification and live/deployed acceptance remain outstanding.

Reviewed `feature/project-evidence-readiness` at `7a3f97b`, against `main` at `3dd0762`: nine commits, 475 changed files, 78,564 insertions and 3,328 deletions, including substantial generated data and documentation. The working tree was clean. This review traced all ANA requirements and the relevant shared foundations, inspected implementation and tests across the workflow, and ran fresh local verification. Earlier reviews were context, not evidence that current code passes. No application code, historical release evidence, deployment configuration or remote settings were changed.

The source of truth is [PRD section 9](../../Repofy_PRD_v1.0.md), with sections 7, 15–18, 20–23, 28–29 and 32 for supporting requirements. Features 2–6 are outside this review's completion denominator. ANA-020 is explicitly deferred P2 scope.

**1. High — unreachable JSX children still establish a verified accessible form.**

Location: [role-rules.ts](../../repofy-backend/src/domain/detectors/role-rules.ts), lines 62–76. Requirements affected: ANA-005, ANA-006, ANA-007, ANA-009 and the claim-validation rule in section 16.6.

The detector gathers descendants of a returned form and accepts matching labels, inputs and submit buttons without checking whether those individual nodes are reachable. The final `emit` checks the form node, which remains reachable even when a required child cannot render. `ControlFlow.reachable` already understands literal false short circuits, but the child checks do not use it.

Reproduction using the checked-in Frontend portfolio, changing only `Form.jsx`:

```tsx
// Replace the existing label with this expression:
{false && <label htmlFor="name">Name</label>}
```

The same defect reproduces when the input or submit button is independently wrapped in `false &&`. Real ingestion, extraction, aggregation 3.0.0, rendering and `validateRendered` accept all three cases. Accessibility/interaction strength remains **0.65 / Strong**, confidence remains **Moderate**, and Frontend coverage remains **55.25%**, equal to the working fixture. The published verified claim still states: “A form connects a labelled controlled input and a named submit action.”

This is a counterexample to the claimed static wiring, not a request to prove general accessibility or execute the repository. An unreachable label cannot supply that wiring. A source test referring to the component still adds corroboration; the existing disclaimer that tests were not executed does not validate the unsupported base observation.

Fix: require reachable participating controls and label nodes, and establish their relationship within a compatible rendered branch before emitting the compound observation. Add positive and negative cases for literal short circuits, ternaries and mutually exclusive controls. Carry the correction through a new immutable analyzer/policy version; do not rewrite historical reports.

**2. High — mutated allowlists still qualify as a literal AI dispatch guard.**

Locations: [role-rules.ts](../../repofy-backend/src/domain/detectors/role-rules.ts), lines 206–215; [project.ts](../../repofy-backend/src/domain/detectors/project.ts), lines 114–139. Requirements affected: ANA-005, ANA-006, ANA-007, ANA-009 and section 16.6.

`model_action_guard` resolves a `const` array to its original literal initializer. The binding tracker invalidates assignments and some object mutation helpers, but misses array mutation calls and prototype replacement. Consequently, the detector treats a list extended by untrusted input, or an `includes` check that always succeeds, as a literal allowlist guarding dispatch.

Two independent changes to the AI Application fixture reproduce this:

```ts
// Inside the existing generateObject options, append caller input to the list:
model: (allowed.push(prompt), 'fixture-model')

// Alternatively, before choose(), replace the array's membership implementation:
Object.setPrototypeOf(allowed, { includes() { return true; } });
```

Both retain **0.65 / Strong** `ai_safety`, **Moderate** confidence and **54.60%** AI Application role coverage, equal to the baseline. Rendering validation accepts the verified claim that the model-selected action is checked against a literal allowlist before dispatch. As a control, overriding `includes` with `Object.defineProperty` correctly removes the finding and lowers coverage to 46.80%; the missing mutation paths cause the inconsistency.

The input-extension case is ordinary mutation of the purported policy data. The prototype case demonstrates a complete bypass visible in the same source. Broad caveats about runtime safety cannot establish the narrower literal-membership claim when its precondition is absent.

Fix: conservatively invalidate a resolved allowlist on mutating methods, relevant prototype changes, aliases and untracked escapes, or restrict support to a form whose immutability can be established. Add detector-through-report regression cases. Keep uncertain cases unassessed rather than awarding guard evidence.

**3. Medium — improvement plans always omit file targeting.**

Locations: [narrative.ts](../../repofy-backend/src/domain/synthesis/narrative.ts), lines 115–126; [reader.ts](../../repofy-backend/src/domain/readiness/reader.ts), lines 20–29; [report-assessments.tsx](../../repofy-frontend/src/components/readiness/report-assessments.tsx), lines 109–116. Requirements affected: ANA-011 and especially ANA-012.

Improvement objects always receive `permittedLocations: []`; the read projection clears that field again, and the UI always says a change location has not been established. This also happens when an improvement addresses a weak observed capability with retained file evidence and a successful current permission check. The user can manually navigate through the evidence explorer, but the improvement itself never supplies the PRD's relevant files “when available.”

Rationale, expected proof, acceptance criteria, role associations, effort and transparent priority factors are implemented. File-specific actionable guidance remains partial. The ranking uses fixed proof/effort policy estimates, which are disclosed and are not by themselves a defect; representative usefulness has not been demonstrated.

Fix: associate applicable improvements with relevant retained evidence/file references and resolve display through the existing owner authorization boundary. Distinguish a relevant existing file from a verified recommendation to edit it. Keep locations absent where no reliable association exists. Test the authorized, revoked and no-location cases without sending raw private paths to the model.

**4. Low — the primary operations runbook gives an outdated migration cutoff.**

Location: [analysis-worker-operations.md](../analysis-worker-operations.md), line 7. The first deployment step stops at the September 25 migration, while current intake defaults to aggregation 3.0.0/3.1.0 and detector 2.0.0. Their registry/validation and report-metadata migrations are September 26 additions. [ADR 0019](../adr/0019-role-observations-and-excluded-scope.md) gives the current order, but the primary deployment instruction should point to it and the current migration set. Resolve this before deployment to avoid running new handlers against an older registration/validation schema.

**Progress against every Feature 1 requirement.**

“Implemented” below means present and verified within the local synthetic scope; it does not mean deployed or independently qualified. Upstream detector findings affect the trustworthiness of otherwise implemented downstream views.

| Requirement | Current status | Evidence and remaining boundary |
| --- | --- | --- |
| ANA-001 — Authorized repository selection | Implemented | GitHub identity/installation/repository intersection, private/organization attestation, saved selections and configurable repository cap. Browser and server authorization cases pass. Live App qualification remains open. |
| ANA-002 — Exact repository/branch/SHA | Implemented | Durable pins contain provider repository ID, branch and SHA before extraction. Retry and reuse preserve identity. |
| ANA-003 — Async, idempotent, visible/retryable jobs | Implemented | Separate supervised worker, durable leases/stages, retry classes, cancellation, maintenance and transactional publication/settlement. Real PostgreSQL concurrency checks pass. Current production composition is internal/free. |
| ANA-004 — Inventory and exclusions | Implemented within declared bounds | Files, languages, framework/dependency declarations, tests, configuration and exclusions are recorded. Structural and semantic depth are deliberately different; see scope limits below. |
| ANA-005 — Structured evidence across sources | Implemented, with correctness defects | Code/config/test/docs and separately authorized commit/PR/CI collectors exist. Browser metadata choices persist. Findings 1–2 show false positive source observations. |
| ANA-006 — Versioned capability mapping/confidence | Partial correctness | Versioned taxonomy, deduplication, linked corroboration, scoring traces and SQL recomputation exist. Invalid underlying observations can still earn Strong/Moderate outputs. |
| ANA-007 — Supported displayed claims | Not fully satisfied | Reference membership and deterministic narrative validation pass. Both reproduced false claims have valid references and survive validation; valid references do not establish semantic support. |
| ANA-008 — Repository/category/requirement grouping | Implemented | Project sections, 14-category capability map and filtered/paginated evidence explorer with role requirement filters. |
| ANA-009 — Five role coverage calculations | Provisional | All five rubrics calculate weighted coverage and retain unknown weight. Every required criterion is attainable on authored v3 fixtures. Independent calibration and representative accuracy remain unqualified; findings 1–2 affect scores. |
| ANA-010 — Evidence language | Implemented | Strength/confidence/unknown distinctions, provisional-role explanations and no definitive employability claims in the Feature 1 flow. |
| ANA-011 — Prioritized improvements | Implemented templates; quality partial | Gap/role linkage, deterministic priority factors and explained ranking exist. Recommendations draw from fixed alternatives. File targeting and representative usefulness remain open. |
| ANA-012 — Rationale/proof/criteria/files/effort | Partial | All listed fields except meaningful file targeting are delivered; finding 3. Proof gain and effort are explicit policy estimates. |
| ANA-013 — Explainable capability drill-down | Implemented | Base observation, corroboration, confidence calculation, coverage, detector/version, SHA and permission-checked path/line inspection. |
| ANA-014 — Public/private/unverified distinction | Implemented | Owner-only reports distinguish public/private evidence and unverified proposals. No employer/public artifact is created. There is no general candidate-claims editor in this scope. |
| ANA-015 — Target-role ordering | Implemented | Saved role focus reorders capabilities, relevant improvements and gaps without mutating the immutable report. |
| ANA-016 — Rescan and compare | Implemented | New SHA snapshots, unchanged-source reuse checks, gained/lost/changed/relocated/uncertain observations and historical immutability. Incompatible or incomplete scopes withhold role deltas. |
| ANA-017 — Finding feedback | Implemented | Accurate/inaccurate/unclear/irrelevant choices, bounded private comments, revision/idempotency checks and controlled review dispositions. |
| ANA-018 — Provenance signals | Implemented, bounded heuristics | Fork/template/generated/vendor/history/identity signals and possible bulk initial commit. Optional metadata and feature configuration govern availability; limitations are explicit. |
| ANA-019 — Contribution confidence | Conservative display only | Every contribution assessment remains Unknown with null modifiers. ADR 0015 intentionally supplies context without calibrated attribution. Do not describe this as an assessed contribution-confidence model. |
| ANA-020 — Create GitHub issues | Deferred P2 | Separate write authorization and issue creation are outside the agreed Feature 1 implementation slice. Not a new regression or a P0 completion requirement. |

The user journey is substantially delivered: selection → asynchronous analysis → private evidence report → role focus/improvements → feedback/rescan/comparison. A defensible completion percentage cannot be derived from test totals or completed implementation runs. The remaining work affects the central evidence guarantee, not merely finishing a page or endpoint.

**Latest progress confirmed, rather than repeating superseded findings.**

The current branch registers 34 implementation patterns, including 18 additions, and policies 3.0.0/3.1.0. Fresh role tests and the worker/PostgreSQL/browser journey confirm all 31 required criteria across the five roles are attainable on their authored sources. The previous “required criteria cannot be reached” issue is no longer an accurate blanket finding.

The exclusion fix also passes: adding an empty `.repofyignore`, passive image or `.env.example` preserves measurements; genuine missing source retains uncertainty. Metadata controls now expose commits, pull requests and CI choices, retain them across initial analyses/rescans, and show recorded collection outcomes. These improvements are meaningful, while the new counterexamples show why attainable scores still need precision qualification.

**Supporting foundations and review coverage.**

| Review area | Assessment |
| --- | --- |
| Correctness and product behavior | All requirement paths traced. Findings 1–3 are the material unresolved implementation issues demonstrated here. No additional claim of exhaustive detector correctness is made. |
| Authorization/security/privacy | Server-side owner/grant/session checks, selected installation access, signed webhook handling, encrypted locators and fresh location permission checks are substantial. No new cross-owner read or source disclosure was demonstrated in inspected paths or fresh checks. Findings about AI safety concern evaluated repository claims, not a demonstrated bypass of Repofy's own authorization. |
| Ingestion and source handling | SHA-pinned archives, traversal/symlink guards, default/user exclusions, SQL data screening, secret filtering, parser limits, no repository execution and independent workspace cleanup are implemented and tested. Live infrastructure retention still requires qualification. |
| Breaking changes/data integrity | Additive API/contracts and migrations; policy-pinned jobs and immutable reports remain readable. Real database tests cover fences, publication, revocation, deletion and older policies. Schema-before-code deployment matters; finding 4. |
| Performance/scalability | Bounded parsing/detection, evidence pagination, snapshot reuse and worker supervision are present. Synthetic loopback timings cannot establish deployed capacity, provider latency or the PRD's population completion target. |
| Architecture/design/DRY | Shared runtime contracts and domain boundaries are useful. TypeScript/SQL/contract/UI policy duplication is a maintenance risk; current parity checks are valuable. Corrections need versioned, coordinated changes rather than an unversioned scoring patch. |
| Readability/maintainability | Detector predicates are compact and complex. Missing compound-node and mutation preconditions in findings 1–2 deserve named helper boundaries and adversarial examples. No style-only rewrite is required. |
| Error handling/resilience | Safe error envelopes, idempotent mutation identities, heartbeat/recovery, known-vs-uncertain model outcomes and provider-independent saved reads are implemented. |
| Dependencies/infrastructure | Fresh production-only npm audits report zero advisories in each app. Worker and migration process checks pass. Required remote CI enforcement is absent in the queried repository state. |
| Framework/UX/accessibility | Build, lint, typechecks, keyboard/axe/browser checks pass. Inspected mobile role/improvement captures show the provisional and proposal labels. Human assistive-technology acceptance remains open. |
| Test quality | Real PostgreSQL and integrated browser/worker tests cover meaningful boundaries. New detector counterexamples are missing. The frozen release benchmark explicitly remains a legacy regression, not evaluation of the current 18 added patterns and v3 scoring. |

The PRD's initial “deep support” promise remains broader than implemented depth: the [coverage manifest](../../repofy-backend/src/domain/coverage/manifest.ts) labels bounded TS/JS/React/Express patterns, baseline Next.js/config/database interpretation, baseline Python/Java, and unsupported native runtime/AI runtime evaluation. The implementation pass is capped at **256 files / 2 MiB**, with **256 KiB** structural parser inputs, inside larger ingestion limits. These boundaries are disclosed and safer than pretending full coverage, but representative supported-project acceptance is still needed before claiming the broader PRD outcome.

**Release evidence remains insufficient.**

Fresh `npm run release:decision` exits **1**, reporting **“Benchmark predates current domain implementation.”** Historical release artifacts were deliberately preserved. Running local verification without recording over them does not renew human approval.

The benchmark invokes the legacy `coverageFixture(sample.files)` path and 1.x aggregation ([benchmark.ts](../../repofy-backend/scripts/release/benchmark.ts), lines 55–78). Its 24 true positives / 0 false positives / 1 known false negative do not measure the expanded production detector bundle. Current human claim support, unsupported-major-claim rate and role calibration are **null**. The two findings in this review are targeted counterexamples, not an estimate of a population false-positive rate.

Remaining acceptance work is recorded in [external gates](../benchmarks/run16-external-gates.json):

- Current-version human claim review, an independent engineering/role review, representative portfolios, confidence/rubric calibration and improvement usefulness.
- Successful live GitHub selected public/private/organization access, optional metadata permission, exact-commit download, signed revocation and reconnect acceptance.
- Successful pinned-model request with output/schema/usage and provider-handling review. The recorded HTTP 404 is historical; this review made no live or paid model call and does not assert today's provider availability.
- Deployed migration compatibility, supervision/resources, managed keys/rotation, outage cleanup, deletion/backups, provider retention and incident recovery.
- Representative capacity, latency, completion and actual cost measurements.
- Human screen-reader review and dedicated hosted existing-app regression.
- Remote CI results and required check enforcement. Fresh read-only GitHub queries returned no PRs or workflow runs for this branch; `main` classic required-status protection returned “Branch not protected,” and effective branch rules returned `[]`. The checked-in `feature-one-gate` is therefore not an enforced merge protection in the queried state.

The full developer-product launch also has later profile-disclosure gates. Their absence should not be counted as unfinished Feature 1 code, and completing Feature 1 alone cannot satisfy those later release obligations.

**Fresh verification results.**

All **22** checks from the local verification sequence passed on Node **22.23.2**. The sequence ran sequentially; benchmark/load recording was disabled and verification output redirected outside the repository. No historical approval artifact was overwritten. Implementation digest stayed unchanged:

`047d29cece3090555f194fda048dc6784e4b08489afcb733af5f9d16830d9596`

| Verification | Result |
| --- | --- |
| Contracts typecheck/build/tests | 85 passed |
| Backend application/release typechecks and tests | 1,636 passed across 112 files |
| Disposable real PostgreSQL migrations/authorization/concurrency | 129 passed |
| Ingestion/worker/extraction/detector/coverage/aggregation process checks | All six passed |
| Rubric manifest/seed parity | Passed |
| Frozen legacy regression benchmark | 24 TP, 0 FP, 1 documented FN; 58/58 major-claim references valid |
| Synthetic integrated workload | 13/13 completed; zero terminal workspaces retained |
| Frontend lint/typecheck/build/tests | 591 passed across 89 files |
| Production HTTP boundaries | 8 passed |
| Selection browser journeys | 2 passed |
| Report/worker/PostgreSQL browser journeys | 7 passed, including metadata and v3 role/asset rescan |
| Review-specific detector-through-narrative probes | Five adverse variants reproduced findings 1–2; all were incorrectly accepted by existing validation |
| Production-only dependency audits | Zero reported vulnerabilities in both apps |
| Branch diff whitespace check | Passed |
| Release decision using saved evidence | Exit 1: stale benchmark binding |

Total: **2,441 contract/unit/integration/PostgreSQL tests plus 17 HTTP/browser checks**. Backend line/branch coverage: **91.32% / 87.01%**. Frontend: **84.53% / 75.97%**. Both configured coverage gates pass. Browser logs contain repeated `MaxListenersExceededWarning` messages; this review did not establish a persistent production memory leak from them.

[Machine-readable evidence](2026-09-26-feature-one-branch-review-7a3f97b-evidence.json) includes the verification commands, timing/exit status, source digest, log hashes, synthetic measurements, reproduced claims and read-only remote observations.

**Recommended completion order.**

1. Correct findings 1–2 and add regressions that prove both detector rejection and absence of the verified claim/score contribution. Cover all participating JSX branches and allowlist mutation/escape paths, not just the exact strings above.
2. Add a versioned evaluation corpus for the actual production detector/aggregation combination. Include independent realistic portfolios, weak/tutorial examples and counterexamples for every added pattern. Keep legacy regression results separately labeled.
3. Complete relevant-file improvement targeting and evaluate whether the recommended work produces useful before/after evidence on authorized projects. Preserve report immutability and permission checks.
4. Qualify the narrower role/provenance/language promises, refresh source-bound human evidence, reconcile deployment instructions and complete the live/operational/accessibility/remote CI gates before enabling rollout.

Finding totals: **0 demonstrated Critical defects; 2 High correctness defects; 1 Medium product gap; 1 Low documentation issue.** Release acceptance boundaries are separate. Preserve the strong foundations already present: private-by-default reports, explicit unknown states, no source execution, strict evidence membership, versioned policies and real concurrency verification.
