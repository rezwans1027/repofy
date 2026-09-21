# Run 15 feedback review and fairness procedure

The [architecture decision](../adr/0015-finding-feedback-and-provenance.md) defines the privacy boundary and retention. Human review of A–E is complete with 5/5 agreement. This workflow is internal and API-based; it does not grant access to a user's private source or comment.

## Reviewer setup and triage

An authorized database operator can grant an existing staff auth user access with parameterized SQL, `INSERT INTO feature_one_private.finding_reviewers(user_id,active) VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET active=true`. This is an operational grant, not an application endpoint. Revoke with `UPDATE feature_one_private.finding_reviewers SET active=false WHERE user_id=$1`. No grants are seeded by the migration. Keep the admin secret in server/operator tooling; never ship it in the frontend or put it in a URL.

Use a valid active connection session plus `x-admin-key` for `GET /api/v1/finding-feedback/review?limit=20&disposition=open`. Follow `nextId` with `afterId`. The response exposes generalized classification and detector context. Read requests and errors contain no private source/comment. Do not copy auth headers, full request objects or owner-provided free text into tickets or diagnostics.

POST a review to `/api/v1/finding-feedback/review/:feedbackId` with `expectedRevision`, `expectedReviewRevision`, one supported disposition, one structured note, nullable `benchmarkCase`, and a fresh `idempotencyKey`. Keep that body/key for an uncertain retry. A 409 means the response or review changed; reload the queue. An owner edit reopens the item, so reviewers must reassess the current revision.

| Situation | Disposition / note | Next action |
| --- | --- | --- |
| Insufficient generalized facts | needs_reproduction / needs_fixture | Build an independent synthetic reproduction. |
| Synthetic case reproduces an incorrect boundary | confirmed_issue / reproduced_synthetic | Link one of the registered cases below and propose a reviewed detector/policy fix. |
| Unsupported scope was mistaken for a negative | confirmed_issue / coverage_limitation | Correct explanation/coverage in a new version; retain old reports. |
| Wording overstates supported evidence | confirmed_issue / wording_issue | Prioritize the statement boundary and add a negative case before changing templates. |
| Case cannot reproduce the concern | not_reproduced / not_reproduced | Retain uncertainty; this does not prove the user wrong. |
| An authorized reproduction would need private details | needs_reproduction / requires_authorization | Stop at generalized triage; obtain specific authorization through an approved support process before retaining any real example. |
| Verified fix exists | resolved / reproduced_synthetic | Record its synthetic case; offer a versioned reanalysis through the normal product flow. |
| Existing synthetic issue covers it | duplicate / duplicate | Associate the registered case; do not duplicate private text. |

Prioritize confirmed unsupported authorship/skill/misconduct claims and privacy defects first, then detector false positives/negatives, then unclear wording. Feedback volume is not a correctness vote or a ranking of users. Accurate/irrelevant responses also remain reviewable quality input. No review automatically changes a score, report, model prompt, benchmark label, issue tracker or email.

## Registered synthetic reproductions

The machine-readable [fixture set](../../repofy-backend/tests/fixtures/evidence/provenance.json) is exercised by [provenance tests](../../repofy-backend/tests/unit/domain/provenance.test.ts). These are synthetic scenarios with no retained customer identifiers or source.

| Queue case ID | Cases and expected boundary |
| --- | --- |
| `run15.fork` | Fork with substantial original work: context only, no penalty. |
| `run15.template` | Extensively modified template: origin does not determine authorship or skill. |
| `run15.bulk` | Squashed project and bulk import with identical root shape: same possible signal, no accusation. |
| `run15.generated` | Generated/vendor files beside authored source: exclusion counts, no AI-generation inference. |
| `run15.identities` | Multiple linked identities and mismatched/unlinked author: account association only, no sole responsibility or author-email verification. |
| `run15.unknown` | Unavailable private organization history: unknown contribution, no reduction of capability strength/confidence. |

The aggregation regression uses real extracted code observations and proves old/new strength, confidence and role arithmetic are identical. PostgreSQL cases verify actual captured metadata/exclusions, reject fabricated stored counts/scores/text, and exercise independent concurrent feedback writes and stale review fences. The browser test covers token refresh, edits, review acknowledgement and versioned reanalysis. The [A–E review](run15-human-review.md) is unblinded qualitative boundary review; no precision/recall, fairness-population estimate, authorship probability or calibrated numeric provenance effect is claimed.

Forbidden interpretations include “stolen code,” “fraud,” “AI-generated,” “verified author,” “sole author,” “owns this code,” “lacks skill because history is missing,” and percentage personal contribution inferred from these observations. Neutral explanation can state the recorded provider fact, bounded scope, alternative causes and explicit unknowns. Understanding is reserved for later Repo Defense work.

For new benchmark cases, first generalize or synthesize the smallest reproduction, document the expected supported/unsupported statement boundary, test the failure, then register a safe case ID and reviewed fix. The current registry is deliberately closed; extending it requires a contract/migration change. A real example requires explicit authorization for the specific retention and use, redaction, restricted storage and a deletion date. Do not place it in this public repository or the generalized review queue by default.
