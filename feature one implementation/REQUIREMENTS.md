# Feature 1 requirement ownership and completion map

This is the current ownership and completion map for [PRD v1.0](../Repofy_PRD_v1.0.md). Runs 01–15 are implemented and locally verified for their scoped private Feature 1 behavior; their individual handoffs preserve the historical evidence and limitations. Run 16's [release acceptance matrix](../docs/benchmarks/run16-release-evidence.md#requirement-acceptance-matrix) maps **every ANA-001–019 and relevant CORE/GH/ING/CONS requirement** to implementation entry points, automated checks, manual/external evidence, limitations and responsible roles.

Run 15 feedback, controlled review, neutral provenance and contribution uncertainty are complete locally; its A–E review agreed 5/5. Run 16 implements frozen evaluation, integrated workload/recovery/browser verification and a fail-closed release decision. The first new review agrees with all 24 claim/unknown cards and all 30 hypothetical role boundaries. The **release milestone remains HOLD** pending the second independent engineering review/empirical calibration, live GitHub and pinned-model success, deployed operations/privacy/capacity, human assistive technology, hosted-account regression and required CI protection. Local implementation is not external release approval. See the [decision](../docs/benchmarks/run16-release-decision.json) and [handoff](16-handoff.md).

## Feature 1 functional requirements

| Requirement | Priority | Main implementation runs | Required evidence of completion |
|---|---|---|---|
| ANA-001: select authorized repositories | P0 | 04, 05, 07, 13 | Real authorized picker/start flow; forged and cross-user repository IDs rejected |
| ANA-002: exact repository, branch, commit | P0 | 02, 06, 07 | Stored immutable identity; branch movement and retry tests |
| ANA-003: asynchronous idempotent job | P0 | 02, 07, 13 | Durable worker, progress, restart/duplicate tests, correct settlement |
| ANA-004: inventory files/languages/frameworks/tests/CI/metadata | P0 | 06, 08, 10 | Known inventory fixture counts, exclusions and achieved-coverage manifest |
| ANA-005: structured evidence across source types | P0 | 01, 02, 08, 09, 10 | Code/config/test/docs/commit/PR/CI evidence with valid snapshot provenance |
| ANA-006: versioned capability mapping and confidence | P0 | 03, 09, 11 | Deterministic maps/aggregation and independent strength/confidence tests |
| ANA-007: supported or clearly unverified major claims | P0 | 01, 02, 11, 12, 13 | Structural and semantic validation, citation navigation, no unsupported finalization |
| ANA-008: repository/capability/role grouping | P0 | 11, 13 | All three evidence navigation views with owner-scoped membership checks |
| ANA-009: initial role coverage | P0 | 03, 11, 13 | All five role rubrics and independently checked coverage calculations |
| ANA-010: evidence language, no definitive employability claims | P0 | 03, 10, 11, 12, 13 | Honest unknown states; no hire recommendation or unsupported seniority |
| ANA-011: prioritized improvements | P0 | 03, 11, 12, 13 | Explainable role/gap/proof/confidence/effort ordering on meaningful examples |
| ANA-012: complete improvement details | P0 | 01, 12, 13 | Rationale, expected proof, acceptance criteria, effort, permitted locations when known |
| ANA-013: expandable reasoning | P0 | 11, 12, 13 | Calculation/support trace accessible from every capability |
| ANA-014: public/private/unverified distinctions | P0 | 01, 02, 12, 13 | Typed distinctions and visible labels without unintended public access |
| ANA-015: target-role reordering | P1 | 14 | Role selection reorders relevant content without rewriting immutable reports |
| ANA-016: rescan and evidence comparison | P1 | 07, 14 | New-SHA analysis, immutable baseline, gained/lost/changed evidence, scope/version caveats |
| ANA-017: finding feedback | P1 | 15 | Four choices, bounded comments, ownership checks, and controlled review workflow |
| ANA-018: provenance signals | P1 | 08, 09, 15 | Fork/template/generated/bulk-commit/uncertain-history fixtures and limitations |
| ANA-019: contribution confidence | P1 | 11, 15 | Transparent, calibrated uncertainty without definitive authorship/ownership claims |
| ANA-020: create GitHub issue with separate write permission | P2 | Deferred, outside 16 runs | Requires a later plan, additional explicit write authorization, and issue preview/creation flow |

Run 16 verifies the integrated acceptance of ANA-001–019. Supporting changes in multiple runs do not mean a requirement is complete before the final user behavior exists.

## Shared platform support

| Requirement | Owner runs | Feature 1 boundary |
|---|---|---|
| CORE-001: existing account and verified GitHub identities | 02, 04 | Preserve auth; explicit verified identity links for repository authorization |
| CORE-002: verified identity separate from display name | 01, 04 | Stable provider IDs; profile text is not authority |
| CORE-003: server authorization | 01, 02, 04–16 | User/repository/job/report/evidence ownership everywhere; workspace roles are later Feature 5 |
| CORE-004: explicit intent and audit | 02, 05, 07, 13–15 | Selection, revocation, deletion, rescans, and feedback; no sharing submission is built |
| CORE-005: feature flags | 01, all integrations | Backend enforcement and safe UI visibility; maintenance jobs continue while intake is off |
| GH-001: GitHub App for private repositories | 04 | Installation integration is separate from login |
| GH-002: minimum read-only permissions | 04, 08 | Optional PR/CI permissions documented; no issue-write scope |
| GH-003: individually selected repositories | 04, 05 | Installation scope plus application selection/eligibility checks |
| GH-004: short-lived tokens only in memory | 04, 05, 06, 07 | On-demand tokens; no persistence in jobs, caches, telemetry, or browser |
| GH-005: private key in managed secret/key service | 04, 16 | Configuration, deployment, rotation, and real setup verification |
| GH-006: verified access-change webhooks | 05 | Raw-byte signature verification, duplicate-safe effects, stale event reconciliation |
| GH-007: block scans after revocation | 05, 06, 07, 13, 14 | Grant revisions, fresh checks, canceled retrieval, restricted refetch |
| GH-008: candidate authorization attestation | 05, 07 | Recorded text/version/time; server-enforced before scanning |
| GH-009: organization-authorized repositories | 04, 05 | Verify installation/user/repository relationship and show organization context |
| ING-001: commit pinning | 02, 06, 07 | No branch-head drift or cross-SHA metadata attribution |
| ING-002: isolated ephemeral snapshot storage | 06, 07 | Per-attempt bounded workspace and independent cleanup |
| ING-003: exclusions and .repofyignore | 06, 08 | Mandatory security exclusions cannot be overridden |
| ING-004: secrets/sensitive data filter before model | 06, 08, 12 | Scanner fail-closed boundary and minimal model input |
| ING-005: configurable processing limits | 06, 07, 10, 16 | Size/count/timeout/memory safeguards and explicit reduced scope |
| ING-006: no repository execution | 06, 08, 09, 10 | No install/build/test/config execution in standard analysis |
| ING-007: raw snapshot deletion | 06, 07, 13, 16 | Terminal cleanup, crash sweeper, cancellation, deletion, operational proof |
| ING-008: no raw source/tokens in logs | All data-processing runs, 16 | Sentinel tests across logs, errors, analytics, provider metadata, and artifacts |
| ING-009: separate commit/PR/CI metadata | 08, 15 | Optional read permissions, bounded history, SHA relationship, provenance use |
| ING-010: future isolated verified-build subsystem | Deferred | Exclusion respected; no execution subsystem is introduced |
| CONS-003: hidden private identifiers unless disclosed | 01, 02, 12, 13, 16 | Internal and owner/generalized projection contracts; external sharing deferred |
| CONS-006: analysis/account deletion | 02, 07, 13, 15, 16 | Deletion/cancellation, cache/feedback cleanup, export, documented retention |

CONS-001, CONS-002, CONS-004, CONS-005's employer-submission retention, and CONS-007's per-claim sharing controls require later sharing/hiring work. Feature 1 respects the private-by-default boundary and builds reusable versioning/policies, but does not claim those employer workflows are complete.

## Cross-cutting scope without stable requirement IDs

| PRD area | Owner runs | Required output |
|---|---|---|
| Sections 7.2–7.3: language tiers and five roles | 03, 08–11, 13 | Versioned support matrix; all roles; honest shallow-language states |
| Section 15.5: versioning/audit | 01, 02, 07–15 | Immutable dependency chain and safe audit metadata |
| Section 16: Evidence Graph and claim validation | 01–03, 08–12 | Membership integrity, deduplication, supported claim scope |
| Section 18.3: model-call records | 12 | Provider/prompt/input/schema/version, tokens/cost/latency/validation |
| Section 18.5: benchmark | 03, 06, 08–12, 15, 16 | Early fixtures, held-out human evaluation, measured results |
| Section 19.4: durable processing | 07 | Separate worker process, leases/fencing, attempts, recovery |
| Section 21: API conventions | 01, 05, 07, 13–15 | Compatible envelopes/codes, async resources, idempotency, authorization |
| Sections 22.1–22.4: security/privacy | 02, 04–13, 16 | Private-repository threat model, safe ingest, provider handling, isolation |
| Section 22.6: deletion/retention | 02, 06, 07, 13, 15, 16 | Raw cleanup target, active-result deletion, backup/provider policy disclosures |
| Sections 23.1–23.3: performance/limits/reliability | 06, 07, 10, 16 | Measured supported workloads and failure recovery |
| Section 23.4: accessibility | 05, 07, 10, 13–16 | Keyboard/screen-reader/text equivalents and core-flow review |
| Sections 23.5–23.6: telemetry/cost | 07–16 | Source-free stage metrics, budgets, versioned reuse |
| Section 24: developer/quality metrics | 05, 07, 12–16 | Selection/start/completion/report/evidence/improvement/rescan/feedback events |
| Section 25: entitlements | 05, 07, 14, 16 | Server-side repository/analysis limits and documented charge policy; no full plan redesign |
| Sections 27–28: definition of done | Every run | Requirements, scoped checks, migration/recovery notes, flags, handoff |
| Section 29: evidence language/error UX | 01, 05, 07, 10, 12–15 | Honest confidence, not-observed/not-assessable states, actionable recovery |
| Section 32: release gates | 16 plus later feature work | Feature 1 evidence; full public-profile/employer gates remain separate |

## Integration checkpoints

1. After Run 03: synthetic evidence and all five rubric definitions persist under authorization/version constraints.
2. After Run 07: an authorized selected repository reaches real safe ingestion through durable processing; later analysis stages remain explicitly incomplete.
3. After Run 11: deterministic evidence, capability assessments, and role coverage exist with honest coverage limits.
4. After Run 13: **locally verified** with one and several repositories through the actual API/worker/PostgreSQL and private UI, including validated explanations, improvements, evidence navigation, access checks and deletion. External rollout is still gated; see [verification and limitations](13-handoff.md).
5. After Run 15: rescan/role focus/feedback/provenance P1 functionality is integrated and locally verified. Required A–E fairness review agreed 5/5. Broader calibration and live integration remain separate.
6. After Run 16: **HOLD** is the recorded rollout decision. Local implementation/verification and the first new human review are recorded; the release evidence lists explicit external blockers. Feature 1 is not declared release-complete.

## Handoff template

Use this in the implementation summary for each run:

| Field | Record |
|---|---|
| Status | Not started / in progress / complete / blocked by named dependency |
| Requirements completed | IDs and user behavior actually delivered |
| Changed interfaces | API contracts, database tables/functions, worker stages, UI routes |
| Versions and decisions | ADRs, rubric/detector/schema/model versions, effective limits |
| Verification | Commands/results, meaningful fixtures, manual/provider/human checks |
| Privacy and authorization | Tested boundaries and any unresolved issues |
| Migration and recovery | Apply order, compatible rollback, cleanup/settlement behavior |
| Feature flags | Actual values/defaults and scope of exposure |
| Remaining dependencies | External configuration, pending handlers, decisions, known limitations |
| Next run | Stable interfaces and required follow-up |

Completion must be based on actual behavior and verification. A passing mock, a new table, or a declared endpoint alone does not fulfill a user-facing requirement.
