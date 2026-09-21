# Run 12 — Validated report explanations and improvement plans

**Status:** Implemented and locally verified; successful live-model verification remains a rollout gate. Human statement-boundary review agreed 4/4. Live-provider success remains blocked by pinned-model access. See [handoff](12-handoff.md). **Depends on:** Runs 07 and 11. **Requirements:** ANA-007, ANA-010–012, ANA-014 foundations; PRD sections 9.7, 16.6, 18.2–18.5, 22.3, and 23.6.

## Outcome and scope

Create understandable explanations and prioritized improvements from validated structured evidence. The system rejects unsupported claims, fabricated achievements, invalid references, and disclosure violations before a report becomes readable.

This is Feature 1 synthesis only. Do not add job-description matching, resume generation, defense questions, public publishing, or employer reports.

## Read first

- [External engine client](../repofy-backend/src/services/engine.service.ts), [usage logging](../repofy-backend/src/lib/usage-logger.ts), [existing advice builder](../repofy-backend/src/services/advice-builder.service.ts), and [legacy report builder](../repofy-backend/src/services/analyze.service.ts).
- Run 01 model contract/engine boundary, Run 03 allowed capability scopes, and Run 11 assessments/gaps.
- PRD model-call records, hallucination guardrails, and provider-handling requirements.

## External-engine decision

The separate engine implementation is absent from this checkout. Select and document one concrete route: extend an available engine repository with the new contract, or implement a bounded model-gateway adapter in the analysis worker. Do not add an unimplemented URL and mark synthesis complete. Verify provider-specific API/retention behavior against primary documentation at implementation time.

A synthetic adapter supports development and CI. It cannot prove real model integration or claim provider privacy guarantees. Missing credentials may block the real smoke check, but do not prevent building schema validation, domain validators, retries, budgets, and the rest of this run.

## Implementation sequence

1. Define model inputs from approved capability assessments, evidence summaries, allowed evidence IDs, gap descriptors, effective disclosure rules, and immutable version references. Prefer structured observations; raw repository uploads are unnecessary for this task. Any separately justified snippet goes through Run 06 filtering and explicit context limits.
2. Treat documentation, filenames, comments, and repository-authored strings as untrusted data. They cannot override instructions, trigger tools/network actions, alter prices/access, or request source disclosure. Keep model invocation free of repository-directed execution.
3. Define structured output for explanations, claim references, improvement proposals, rationale, expected evidence gained, effort bands, acceptance criteria, and optional authorized locators. Computed role coverage/confidence comes from Run 11 and is never model-recalculated.
4. Implement a gateway with recorded purpose, provider/model ID, prompt version, input hash, allowed references, schema version, safe usage/cost/latency, attempt state, and validation outcome. Apply per-job/global budgets and bounded retries through Run 07. Provider/model selection remains configurable and versioned.
5. Validate both schema and domain semantics: references exist in the included run; a claimed capability is within the approved supported scope; negative gap statements are limited to assessed scope; metrics/outcomes are not invented; locations obey visibility; and secret/private sentinels are absent where prohibited.
6. Do not equate valid evidence IDs with semantic truth. Use structured claim types and conservative approved statement boundaries, with deterministic rendering where feasible. Reject newly introduced capability concepts or unsupported causal claims. Add semantic adversarial fixtures and human benchmark review for paraphrases that still overstate evidence.
7. Rank improvements using the PRD factors: role relevance, gap, expected proof gained, confidence, and effort. Define bounded values and a nonzero effort floor. Keep ranking explainable and stable under ties; do not let the model invent a numeric confidence or ignore a low-quality evidence basis.
8. Require every improvement to strengthen an actual project or relevant proof. Include measurable acceptance criteria, expected evidence change, rationale, effort, and repository/files when known. Missing locations remain absent rather than fabricated. Clearly describe future expected proof so it cannot be mistaken for an existing achievement.
9. Apply a candidate-private output projection and a strict generalized projection contract for future reuse. Do not expose a public endpoint or store an employer artifact. Hidden paths/names must not leak through prose, nested fields, error strings, telemetry, or cache metadata.
10. Persist only validated final output using Run 07's atomic finalization. Keep invalid output quarantined under a documented minimal/redacted retention policy; ordinary logs contain error codes and IDs only. Report reads must work during future provider outages.
11. Define degraded behavior explicitly. A provider outage may preserve an already completed report and allow retry; an optional deterministic explanation fallback requires a documented contract and honest provenance. Invalid generation must never silently become a successful verified report.

## Acceptance criteria

Every positive major claim is supported by permitted evidence and allowed capability scope. Improvements include all PRD fields and do not invent production scale, users, outcomes, or file paths. A model cannot change coverage, access, billing, or snapshot identity. Invalid output never reaches final report storage or UI. All model costs and versions are traceable without retaining raw source in operational logs.

## Verification

Use deterministic synthetic model fixtures for invented evidence IDs, valid IDs attached to unsupported claims, cross-run citations, exaggerated metrics, contradictory confidence, hidden names embedded in prose, malicious README instructions, oversized output, malformed responses, repeated provider timeouts, and budget exhaustion.

Test ranking with known gap/effort examples and verify that toggling repository input order does not change ties unpredictably. Run a small authorized real-provider smoke check separately from CI and record it without source content. Measure human claim-support agreement later in Run 16 using held-out cases.

## Migration, rollout, and handoff

Persist model run/validation metadata and immutable narrative/improvement versions. Disabling synthesis stops new generation but preserves existing report reads and job settlement/recovery. Roll back prompt/model/policy pointers for new jobs, not completed content.

Hand off the actual model adapter, prompt/schema versions, provider configuration/retention disclosure, validators, improvement-ranking rules, negative fixtures, and safe report DTO. Run 13 should render these validated fields without deriving new claims in components.
