# Run 12 handoff — Validated narratives and improvements

**Status: implemented and locally verified; successful live-model verification remains blocked.** September 20, 2026. The user agreed with all four statement-boundary examples (4/4). No deployment flags, remote migrations or customer billing policy were changed.

## Delivered

The complete worker composition now runs real extraction, Run 11 aggregation, the bounded OpenAI Responses adapter, deterministic narrative rendering and semantic validation. The model selects approved statements and improvement templates; it cannot author arbitrary claims, change computed scores, supply locators or decide access/billing. Positive statements retain exact detector limitations, scoped confidence and authorship uncertainty. Unsupported valid-ID claims, foreign/cross-run citations, metrics, names and confidence changes are rejected before staging/publication.

Improvements preserve Run 03's actual-project behavior, rationale, expected evidence, effort and measurable acceptance criteria. Expected evidence is explicitly future proof. Server ranking exposes relevance, gap, expected proof, confidence and effort factors, with a nonzero effort floor and stable capability-key ties. Unknown coverage produces a coverage-review proposal with priority zero. Repository IDs come from known support/assessed scope; absent file locations remain absent.

The new forward migration persists source-free model metadata, attempt/validation outcomes, immutable policy versions, allowed references and validated report hashes. Atomic database reservations cap one call at $0.05, a logical job at two calls/$0.10, and all Feature 1 generation at $10 per rolling 24 hours. Unknown outcomes retain their reservation and cannot automatically generate again. Budget reservations survive job deletion without retaining account/source fields. Invalid model content has zero raw-text retention. Existing report reads remain provider-independent.

Owner reports use generic repository labels and selected base/corroboration evidence, retain all snapshot coverage and five roles, and add narrative provenance plus improvement ranking traces. The strict generalized future contract excludes prose, identity, citations and locators. No public endpoint or employer artifact was added.

## Interfaces

| Interface | Location |
| --- | --- |
| Selection/provenance/ranking/generalized contracts | `packages/contracts/src/narrative.ts`; additive owner report fields in `readiness.ts` |
| Frozen policy, prompt, model and configuration validation | `repofy-backend/src/domain/synthesis/policy.ts` |
| Actual provider adapter | `synthesis/gateway.ts`: fixed host, strict Responses schema, no tools/redirects, `store:false`, byte/token/deadline limits |
| Semantic preparation, rendering, validation and ranking | `synthesis/narrative.ts`: `prepareNarrative`, `validateSelection`, `renderNarrative`, `validateRendered`, `generalizedNarrative` |
| Fenced worker orchestration | `synthesis/service.ts`: `NarrativeService.synthesize/validate` |
| Full immutable execution policy | `synthesis/composition.ts`; lazy `productionHandlers()` in `jobs/runtime.ts` |
| Migration | `20260920000500_validated_synthesis.sql`; new model RPCs, ledger/policy tables, publication guard and derived-support constraint |
| Provider/data/budget/rollback decision | [ADR 0012](../docs/adr/0012-validated-narratives.md) |
| Human review | [Four agreed cases](../docs/benchmarks/run12-human-review.md); held-out measurement remains Run 16 |
| Live smoke command | Backend `npm run synthesis:smoke`; separate from CI, synthetic facts only, safe metadata output |
| Operations | [Worker operations](../docs/analysis-worker-operations.md) and backend `.env.example` |

## Verification

Node 22 and disposable PostgreSQL 17; existing coverage thresholds unchanged.

| Check | Result |
| --- | --- |
| Backend full suite | 1,121 tests / 91 files; 87.57% statements, 85.21% branches, 89.40% functions, 90.10% lines |
| Frontend full suite | 557 tests / 84 files; 82.09% statements, 76.58% branches, 78.36% functions, 83.03% lines |
| Contracts | 73 passed; build passed |
| Real PostgreSQL | 93 passed, including complete worker publication, service-role deferred constraints, concurrent global reservations and stale-attempt receipts |
| Backend build | Passed |
| Frontend production build/typecheck/lint | Passed; existing unused `vi` warning remains, with zero lint errors |
| Human boundary review | 4/4 agreed; no held-out precision claim |
| Whitespace and new-file visibility | Passed |
| Live provider smoke | Attempted; **not passed**. Current credential cannot access the pinned model. |

New cases exercise malicious repository instructions, source/name exclusion, unsupported statements with valid citations, actual foreign-run references, altered rendered text/metrics, malformed/oversized/refused/incomplete responses, transport and HTTP timeouts, bounded 429 retries, budget exhaustion/concurrency, deterministic multi-repository ties, unknown coverage, owner isolation, export/deletion and reads during provider failure. A real worker runs the actual extraction/aggregation/adapter/validator/publication path against PostgreSQL with an injected synthetic HTTP provider, without production data or credentials.

## Live-provider gate

[The smoke record](../docs/benchmarks/run12-provider-smoke.json) records the actual rejected request without its response text or secrets. A read-only access check returned 404 for `gpt-4.1-mini-2025-04-14`. The available standard model listing contained only the `gpt-5.2` alias; the documented GPT-5.2 snapshot also returned 404. An alias was not substituted for a frozen model version. The first smoke used the development $0.04 reservation; final bounds now reserve $0.05 and allow 8,192 output tokens to cover the full capability/gap selection.

Provider API/schema/pricing/retention behavior was verified against the primary documentation linked in ADR 0012. This verifies the implementation contract, not successful model availability or account privacy settings. A deployment credential with pinned-model access and a successful `synthesis:smoke` run are still required. `store:false` does not establish ZDR. Synthesis remains disabled by default, and client readiness availability remains gated pending Run 13/16 acceptance.

## Run 13 handoff

Render the validated report's fields directly. Use Run 11 aggregation for detailed calculation traces and paginated evidence; the report deliberately includes only the selected base and linked corroboration. Derived structural/test capability mappings are in aggregation support and assessment citations, not necessarily in the sealed observation's original capability array. Preserve unknowns, limitations, future-proof labels, separate strength/confidence and ranking terms. Do not derive new claims in UI components or silently regenerate reports on reads.

Report reads, owner export/deletion and Run 07 cancellation/settlement remain available when generation is disabled. Keep model/prompt/policy versions pinned for existing jobs. A successful staged draft resumes validation/finalization without a model call; an uncertain paid outcome fails closed. Apply the forward migration and verify the provider/data-handling, UI, live GitHub and release gates before enabling any allowlist rollout. Runs 13–16 remain outstanding.
