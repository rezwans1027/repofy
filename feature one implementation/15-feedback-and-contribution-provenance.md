# Run 15 — Finding feedback and contribution provenance

**Status:** Implemented and locally verified; see the [Run 15 handoff](15-handoff.md). Human review A–E is complete with 5/5 agreement. Run 16 and external rollout verification remain outstanding. **Depends on:** Runs 08–14. **Requirements:** ANA-017–019; PRD sections 9.4, 16.4–16.5, 18.5, and 24.4.

## Outcome and scope

An engineer can challenge or confirm a finding, and reports expose meaningful provenance/contribution uncertainty without claiming legal ownership, definitive authorship, or AI-code detection. Feedback becomes reviewable quality evidence, not an automatic rewrite of verified claims.

Do not build an employer dispute product, candidate ranking, fraud classifier, or a general admin-dashboard rewrite.

## Read first

- [Existing feedback route](../repofy-backend/src/routes/feedback.routes.ts), [feedback controller](../repofy-backend/src/controllers/feedback.controller.ts), and [admin authorization](../repofy-backend/src/middleware/adminAuth.ts).
- Run 08 metadata interfaces, Run 09 generated-code classification, Run 11 contribution-confidence inputs, and Run 14 version lineage.
- PRD provenance requirements and open decision about human review of challenged evidence.

## Implementation sequence

1. Add finding feedback tied to a specific report version, assessment/claim/evidence reference, and author. Support accurate, inaccurate, unclear, and irrelevant with optional bounded free text. Check that the finding belongs to a report the user owns.
2. Define repeat/edit behavior and idempotency: a user can update an active feedback response while retaining safe audit history if needed. Feedback does not mutate underlying evidence strength or disappear into the unrelated general product-feedback inbox.
3. Build an accessible feedback control on capability explanations, evidence items, or improvements as appropriate. Show acknowledgement and current response, handle offline/retry states, and avoid duplicate submissions after auth refresh. Clarify what feedback changes and what remains under review.
4. Add a minimal controlled review workflow, such as an internal authenticated queue/export with disposition states, reviewer notes, and links to synthetic/reproducible evidence. Validate the existing admin boundary before reuse. Prefer generalized summaries; support personnel do not gain automatic raw private-source access.
5. Extend provenance extraction using authorized metadata already gathered in Run 08. Detect provider-declared forks, available template-origin signals, generated/vendor classification, bulk initial commit patterns, limited history, and contribution uncertainty. State when the provider cannot establish a signal.
6. Distinguish a contributor's verified GitHub identity from a commit author string/email. Commit metadata can be incomplete or misleading; do not equate an arbitrary author email with verified identity, legal ownership, or sole implementation responsibility. Avoid importing unnecessary contributor personal data.
7. Define versioned provenance observations and conservative confidence modifiers. Forks, templates, squashed history, private organization work, and bulk initial commits are context signals, not automatic penalties or proof of misconduct. Unknown contribution must remain unknown rather than a fabricated numeric certainty.
8. Calibrate the effect on capability confidence and, where justified by the documented policy, strength. Preserve the distinction between code present in a repository and what a specific engineer can be credited with demonstrating. Understanding itself is assessed by later Repo Defense, not asserted here.
9. Integrate the new provenance policy into future Run 11 assessments and Run 12 explanations, and expose the contribution-confidence basis in the report UI. Use a new detector/aggregation version when behavior changes. Old reports stay immutable; offer explicit reanalysis instead of silently revising them.
10. Connect reviewed feedback to detector benchmark cases and prioritized fixes through a safe process. Redact/generalize private details and obtain appropriate authorization before retaining a real example; synthetic reproductions are preferred. Do not automatically send feedback to an LLM or email service.

## Data and API impact

Add finding_feedback, feedback review/disposition records, provenance observations, and necessary safe audit events through additive migrations. Example mutation: POST /api/v1/readiness-reports/:reportId/findings/:findingId/feedback. Type the finding reference to avoid arbitrary IDs crossing report boundaries.

Record observation source, snapshot/history relationship, detector/version, confidence basis, and limitations. Enforce retention and account/analysis deletion on feedback and review data. Metrics may count classifications/dispositions; free-text feedback and contributor identifiers do not belong in general analytics.

## Acceptance criteria

- All four feedback choices persist against the exact finding version and can be reviewed through a controlled path.
- Users cannot submit/read feedback for another user's private finding.
- Feedback does not directly rewrite completed assessments or become verified evidence.
- Fork/template/generated/bulk-commit/uncertain-history cases produce transparent contextual signals.
- Contribution confidence never claims identity verification, definitive authorship, legal ownership, fraud, or AI generation.
- Applying a revised provenance policy creates new analysis versions and comparable history.

## Verification

Test duplicate/edit feedback, deleted reports, unauthorized finding references, overlong/unsafe text, reviewer privilege boundaries, and deletion/export behavior. Confirm feedback doesn't cause an automatic email/model call or expose private source through review tools.

Use synthetic provenance histories: a fork with substantial original work, a template extensively modified, a squashed repository, generated files beside authored source, one bulk import, multiple contributors, mismatched author identity, and unavailable history. Review false-positive and fairness implications with humans; absence of history must not imply absence of skill.

## Migration, rollout, and handoff

Roll out finding feedback and provenance separately if needed, using their own flags/versioned policy. Keep feedback records independent from immutable report payloads. Disable a misleading detector for new runs and issue an explicit reanalysis/quality notice procedure; do not erase report history silently.

Hand off review instructions, provenance calibration notes, forbidden wording, fixtures, version changes, feedback retention, and known uncertainties. Run 16 evaluates the combined confidence/feedback behavior before external release.
