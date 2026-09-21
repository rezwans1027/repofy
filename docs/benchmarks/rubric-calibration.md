# Initial rubric human review protocol

Release: `readiness_1_0_0`. Status: **uncalibrated; first Run 16 boundary review recorded**. External rollout is blocked. On September 20, 2026 the requesting user agreed with all 24 claim/unknown cards and all 30 role calculation cards in [Run 16](run16-human-review.md). This is one unblinded review, not empirical weight calibration. Engineering role expertise is not recorded, and the second independent engineering review is still required. Earlier approvals are not counted again.

Run 16 owns convening the review and recording named reviewers, review dates, corpus version, actual judgments and disagreements. Before selecting a rollout cohort, assign two independent engineering reviewers familiar with each represented role. A third reviewer resolves disagreements without replacing the original judgments. This is a documented pending work item, not a claim that reviewers have been recruited or meetings scheduled.

Run 11 should first prepare the normalized evidence and coverage for these cases. Use consented public examples or synthetic projects. Do not copy private source, secret matches or credentials into this review log. Record immutable project/snapshot references and owner-safe evidence summaries only.

| Role | Representative implemented case | Deliberately weak case | Not-assessable case |
|---|---|---|---|
| Frontend | Keyboard-accessible submission with stale-response and failure recovery tests | React present; static form without behavior checks | UI framework semantics or eligible files not covered |
| Backend | Contract and validation boundaries with failed-request, transaction and concurrency tests | Express, ORM and queue dependencies without implementation | Relevant handlers excluded or language unsupported |
| Full-Stack | Exercised client/service/database contract and authorization across layers | Frontend works but API input validation and persistence proof are absent | One entire layer cannot be analyzed |
| Mobile | Device lifecycle, permission denial, navigation restoration and reconnect tests | Navigator and storage packages with an online-only screen | Swift/Kotlin/Dart or React Native semantics without corresponding detectors |
| AI Application | Bounded adapter, scoped retrieval, citation checks and recorded adversarial evaluation | AI SDK and a prompt; no evaluated or validated outputs | Model/evaluation path unavailable to static supported analysis |

For each role include all three cases above, plus a duplicate-evidence variant, a high-strength/low-confidence variant and a mixed known/unknown compound requirement. At least 30 judgments are required by this initial protocol. Preserve expected judgments before running the implementation, to avoid changing the reference to match its output.

Each reviewer should independently record:

1. Capability key and taxonomy version; requirement key and role version.
2. Assessable, not observed, or unknown, and the specific coverage/provenance basis.
3. Strength band and confidence label independently, with linked supporting observations.
4. Whether **every** required component is demonstrated, its independent corroboration and the threshold used.
5. Whether claim wording stays within the allowed scope and avoids seniority/employability/ownership conclusions.
6. Whether an improvement would produce useful project behavior, acceptance evidence and a plausible effort band.

Mandatory counterexamples: dependency/config presence cannot satisfy an implementation requirement; missing detector coverage cannot become zero skill; one API capability cannot satisfy both contracts and validation; the same cluster cannot corroborate itself; unknown weight cannot be removed from the denominator; current mobile limitations cannot be hidden by TypeScript support.

The `.55` required and `.40` optional thresholds, corroboration counts, confidence policy and four non-backend weight sets are hypotheses. Review both false positives and false negatives, including small projects whose scope does not include every role behavior. Do not penalize reuse, forks or unavailable history as misconduct. Documentation presence alone must not prove that setup succeeds.

The final review artifact must report observed agreement by role and assessability state, confusion between adjacent bands, common claim-boundary errors, denominator behavior on partial coverage, improvement usefulness, and resolved/unresolved disagreements. Run 16 must record the chosen acceptance threshold and sample limitations before declaring calibration passed; no numeric agreement target or measured agreement is fabricated by this run. Any revised meanings, thresholds or weights create a new immutable version and rerun the benchmark. The original records remain readable.

## Run 16 evidence and remaining calibration

The [frozen role vectors](../../repofy-backend/scripts/release/rubric-cases.json) cover six boundaries for each of the five roles. Expected arithmetic was frozen before execution; all 30 calculations match the policy and the first reviewer agreed with 6/6 in each role. Inputs are hypothetical normalized evidence. They do not assert that native mobile or AI runtime capabilities can currently be extracted, and they do not supply the representative project and improvement-usefulness judgments above.

The claim sample uses the PRD's observed ≥90% support and <2% unsupported-major targets. The first review has 22/22 supported major claims, 0/22 unsupported major claims, and 2/2 correctly unknown cards. A 95% Wilson interval for 0/22 has an upper bound of approximately 14.9%; the sample is also authored and correlated. Neither the observed zero nor agreement on all arithmetic closes the population quality gate. [Machine-readable review](run16-human-review.json) retains the exact response; [results](run16-results.json) separate unknown cards, major claims, per-role boundary agreement and unmeasured empirical calibration.

Before calibration can close, record the second independent engineering review and each reviewer's role expertise, representative implementation/weak/unknown project judgments, strength/confidence-band confusion, improvement usefulness and unresolved disagreements. Specify the empirical rubric acceptance threshold before evaluating that new sample; no threshold is retroactively chosen to make this review pass. Preserve the original records and use a third independent reviewer for disagreements. The [release decision](run16-release-decision.json) remains on hold.
