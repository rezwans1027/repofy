# ADR 0012 — Bounded model selection and validated report publication

Date: 2026-09-20. Implementation accepted; live-provider success remains a rollout gate.

## Decision

The legacy external engine has no implementation in this checkout. Feature 1 uses the worker's actual `OpenAIResponsesGateway`, calling `https://api.openai.com/v1/responses`. It does not call the legacy engine or trust its advice payloads. The checked-in worker composition now includes extraction, aggregation, synthesis and validation. Deployment remains opt-in and owner-allowlisted; client readiness availability remains unavailable until the report workflow and release gates pass.

`bounded_narrative@1.0.0` uses a strict structured selection contract. The model chooses presentation order for approved evidence statements and behavior/proof emphasis for approved improvement templates. Every assessed capability and every relevant gap must occur exactly once. It cannot supply free prose, locators, scores, prices, access decisions, identities, outcomes, tool calls or new capability concepts. This deliberately limits expressive range while making semantic validation deterministic. There is no successful fallback for invalid generation.

The provider input contains frozen version references, an opaque run UUID, permitted representative evidence IDs, bounded application-authored observations and limitations, gaps, immutable Run 03 improvement templates, and computed role summaries. It excludes raw source, repository names, paths, filenames, comments, README text, contribution narratives, provider object identifiers and credentials. Repository instructions are never executable instructions. No repository-directed host, redirect, tool, conversation, background task or file upload exists.

Positive statements are derived from the winning Run 11 cluster's actual base detector and claim boundary. A dependency remains a declaration; documentation remains a structural observation; a test assertion remains source rather than a passing result. Linked test text requires the exact accepted corroboration. Both presentation variants retain the boundary, confidence label and authorship uncertainty. Valid foreign IDs, new statements with valid IDs, invented metrics and hidden-name text all fail the closed selection contract. Re-rendering before publication also rejects edits to nested fields and any alteration of deterministic scores.

## Provider configuration and handling

Versioned v1 selection accepts only provider `openai`, snapshot `gpt-4.1-mini-2025-04-14`, prompt/policy `bounded_narrative_1.0.0`, and deployment acknowledgement `openai_standard_retention_acknowledged`. Unsupported configuration fails closed. Adding another model requires a reviewed registry/migration release with pricing, limits and response-version validation; a repository or request cannot select an arbitrary model. Rollback changes future job pointers, not completed report content.

The adapter sends `store:false` and strict `text.format` JSON Schema, and handles incomplete responses/refusals separately. Structured Outputs constrains syntax; application semantics still require the independent validator. See [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

OpenAI documents that API content is not used for training unless the customer opts in. Default abuse-monitoring retention may include content for up to 30 days, with legal/safety exceptions. `store:false` is an application-state control, **not a Zero Data Retention guarantee**. ZDR/Modified Abuse Monitoring require provider approval and account/project configuration. This implementation has not verified those account settings and makes no such claim. Deployment owners must verify data-sharing settings and the accepted provider handling before enabling source-derived structured context. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

The checked pricing schedule is $0.40 per million input tokens and $1.60 per million output tokens, without cached-input discounts. The snapshot supports Responses and Structured Outputs. See [GPT-4.1 mini specifications and pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Pricing is an immutable estimate for this release, not a provider invoice reconciliation.

The local credential's model listing exposed only `gpt-5.2`. The selected pinned model returned 404; the separately documented [GPT-5.2 snapshot](https://developers.openai.com/api/docs/models/gpt-5.2) also returned 404. The actual synthesis smoke request was rejected. No alias substitution or successful-integration claim was made. [Smoke record](../benchmarks/run12-provider-smoke.json).

## Budgets, failures and retention

| Bound | v1 policy |
| --- | --- |
| Structured input | 65,536 UTF-8 bytes; full request at most 73,728 bytes |
| Response stream | 65,536 bytes; 8,192 output tokens; 30-second total deadline |
| Paid-call uncertainty reservation | $0.05 per attempted request |
| Per logical job | At most 2 calls and $0.10 reserved, across all worker attempts |
| Feature 1 global window | $10 over the previous 24 hours, including pending/uncertain calls |
| Retry | One 250 ms retry for explicit HTTP 429; each call separately reserved |
| Unknown outcome | No automatic regeneration after a timeout, transport error, 5xx, reserved-call crash or lost successful-result acknowledgement |

Database locking serializes budget check plus reservation across workers. Successful/invalid responses retain known usage and conservative estimated cost; unknown usage holds the full reservation. Explicit rejected requests have zero estimated generation cost. Budget exhaustion makes no provider request. A known rejection or a failure before any model reservation can resume through Run 07, within the same total call ceiling. Queued job retry and terminal refund remain Run 07 responsibilities; an operator may resolve provider availability and start a new logical job after terminal failure.

`model_runs` records purpose, provider/model, prompt/schema/policy/pricing versions, input fingerprint, allowed references, attempt identity/state, usage, latency, HTTP status when available, validation code and validated report hash. Terminal rows cannot be rewritten. Invalid output quarantine retains **only these metadata**, with zero raw prompt/response/error-body retention. Records remain with the job until owner/account deletion; export includes source-free model records. A separate anonymous financial reservation table survives job deletion to prevent budget reset, contains no owner/source fields, and is pruned after 30 days. A daily window is a spend limit, not an uncertainty reconciliation mechanism. No cross-owner result cache is introduced. Worker tracing is suppressed and provider/API breadcrumbs are filtered.

## Ranking and disclosure

`proof_priority_1.0.0` calculates `min(1, relevance × gap × expectedProof × confidence / effortCost)`, rounded to six decimals. Relevance is the maximum frozen requirement weight for a relevant role, restricted to the selected target role when supplied. Gap is `1 − strength` for assessed scope; unknown is zero. Expected proof is a conservative policy estimate of .5 for a supported template and zero for coverage review. Confidence is the Run 11 value, or zero for unknown. Small/medium/large/unknown effort costs are .25/.5/1/1. Ties sort by stable capability key, independent of provider choice or repository order. Unknown coverage reviews remain visible with priority zero. Proof gain and effort are estimates; score improvement is never promised.

Improvements use frozen template rationale, project behavior, measurable acceptance criteria and expected evidence. Expected evidence is explicitly prefixed as proposed future proof. Known support or assessed scope supplies repository IDs; paths remain absent because the narrative stage has no authorized plaintext locators. Unknown cases request coverage review, not a rewrite or technology collection.

The owner projection uses generic repository labels, includes all snapshot coverage and five roles, and includes only each capability's selected base and accepted corroboration. Run 11's owner evidence query retains the complete evidence index. Derived capability support comes from the aggregation support relation; do not infer it from the older observation's capability array. The generalized future contract carries only capability keys/states and numeric assessments, without prose, identities, citations or locations. No public endpoint or employer artifact is created, and calling the projection does not grant disclosure permission.

## Publication and verification

The trusted worker validates selection, renders text, validates the whole result, and records its hash. The synthesis staging RPC accepts only that validated hash. Before publication, the worker reconstructs the expected rendering and the database checks exact hash, versions, Run 11 scores, references, active grants, run membership and worker lease. The existing atomic finalizer retains immutable observations, report/citation insertion and settlement. A forward migration extends assessment references to support Run 11's derived structural mappings and linked tests; its deferred constraint runs with a fixed privileged search path, as required at service-role transaction commit. Earlier migrations remain untouched.

Synthetic adversarial, integration and real PostgreSQL tests cover malformed/oversized responses, foreign/cross-run citations, valid IDs with unsupported claims, metrics/confidence/names, malicious README content, uncertain outcomes, retries, budgets, deletion, concurrent reservations and complete worker publication. The human boundary review is **4/4 agreed**; it is not the held-out calibration scheduled for Run 16. The real-provider smoke is separate from CI and is currently blocked as described above. Disabling synthesis preserves provider-independent report reads and existing cancellation/refund/recovery operations.
