# ADR 0015 — Private finding feedback and neutral provenance context

September 20, 2026. Run 15; ANA-017–019. [Human boundary review](../benchmarks/run15-human-review.md): user agreed with A–E, 5/5. This is a qualitative fairness review, not statistical calibration.

## Decision

Feedback is an owner-authored response to one immutable report and typed finding. Provenance describes observed repository context separately from evidence strength, interpretation confidence and personal contribution. Neither feature changes a completed report. Feedback cannot become verified evidence, trigger synthesis, send email, or alter a score.

Use `provenance_context@1.0.0` in future `evidence_aggregation@1.1.0` runs. Numeric aggregation remains identical to 1.0.0. Contribution confidence and both numeric modifiers are null. The human-reviewed policy supplies no defensible authorship probability or calibrated penalty; forks, templates, imports, squashes, generated files, missing history and organization work therefore receive no automatic modifier. Run 16 must evaluate any proposal to change this policy with labeled, authorized data and a new version.

## Feedback and controlled review

Owner GET/POST: `/api/v1/readiness-reports/:reportId/findings/:kind/:findingId/feedback`. Kinds are capability, claim, evidence and improvement. Capability IDs use the recorded capability map; UUID references must belong to that exact report. Evidence membership includes the full authorized run, not just the report's displayed subset. A real active connection session is required, with the existing CSRF boundary for cookie mutations. A foreign owner or reference returns unavailable without revealing existence.

The four choices are accurate, inaccurate, unclear and irrelevant. An optional trimmed comment is bounded to 1,000 characters; controls and direction overrides are rejected, and the static sensitive-data scanner rejects recognized credentials/personal data. This scanner is not a guarantee that all sensitive text is recognizable. Comments remain owner-only, render as text, and are excluded from review, mail, model inputs, telemetry and analytics. The UI asks users to omit source, credentials and personal details.

One active response exists per author/report/kind/finding. Writes require an expected revision and idempotency key. An actor lock serializes concurrent writes; exact replay returns the current saved response without another event. Changed reuse of a key conflicts. Edits increment revision and reopen disposition. Safe private history stores classification/revision/time, never historical comment text. A dirty browser draft retains its base revision even if another tab refreshes the query cache. Uncertain retry and token refresh preserve the original request key/body; account changes remount the editor and discard late acknowledgements.

Review GET `/api/v1/finding-feedback/review` and POST `/api/v1/finding-feedback/review/:feedbackId` require all three: the existing constant-time `x-admin-key` boundary, an active authenticated connection session, and an active private `finding_reviewers` grant. The service role cannot directly read or mutate these private tables. Queue pages contain at most 50 generalized items and a UUID keyset cursor. They expose feedback ID, kind, classification, revisions, time, disposition, structured note, synthetic case ID and an evidence detector/version when applicable. They omit report/finding/owner/repository IDs, comments, source, provider names and identities. The feedback ID is an opaque review handle, not permission to open a private finding.

Dispositions: open, needs reproduction, confirmed issue, not reproduced, resolved and duplicate. Review notes are a closed vocabulary rather than free text. Updates fence both feedback and review revisions; exact review replay has no duplicate effect. Revoking the reviewer grant immediately blocks queue and review RPCs. An owner edit reopens review while retaining its prior safe record. See the [review procedure](../benchmarks/run15-review-process.md) for synthetic reproduction and priority rules.

## Provenance sources and limits

Each immutable run observation records detector/version, observation time, snapshot/repository/SHA, source relationship, limitations and unknown contribution basis. New fields contain only closed categories and bounded counts.

| Context | Interpretation and limit |
| --- | --- |
| Provider `fork` | A provider-declared fork. It says nothing about how much original implementation is present. |
| Provider `template_repository` | Positive template-origin relationship when available. `is_template` is not origin evidence. Missing origin is unknown, never proof of starting from scratch. |
| Generated/dependency classification | Counts from saved mandatory exclusions and Run 09 source markers; heuristic paths are not AI-code detection or individual authorship. Excluded paths/content are not retained here. |
| One root head with at least 100 files | Only a possible bulk initial commit. Requires available one-record history, the exact pinned head, no parents and no other sampled commit. Squashing and importing are indistinguishable by this heuristic. |
| Linked identity categories | Provider-linked association to the verified connected account, another linked account, or unavailable association. Names/emails are never used as verification. Both connected/other categories establish multiple linked identities in the sample, not a unique contributor count or responsibility split. |
| Missing/bounded history | Explicit unavailable, not requested, truncated and other collection states. No missing-skill inference. |

GitHub's [Get a repository response](https://docs.github.com/en/rest/repos/repos#get-a-repository) documents the provider repository fields. The authorized request rechecks stable repository ID, visibility, archive state and access. Fork/template metadata is **current repository context**, not a historical fact pinned to the SHA. A provider outage records unavailable context; a revocation fails the job, and database failure remains retryable rather than being mistaken for unavailable provider history.

Run 08's authorized, already captured commit evidence supplies counts and identity categories, bound to the pinned head and bounded ancestors. Run 14 never reuses a snapshot for a request with optional metadata and never calls such a request unchanged; current metadata is fetched under the accepted account/grant. The captured metadata participates in snapshot artifact identity. Metadata-free snapshots can be reused after reauthorization and correctly leave history unknown. A history/evidence count mismatch becomes truncated. No extra contributor profile, arbitrary author string or email is imported.

The service and fenced SQL store independently enforce snapshot/run membership and exact SHA, counts derived from stored metadata/inventory, allowed source relationships, closed fields/signals and the null contribution policy. An immutable private run record is persisted before aggregation. Aggregation 1.1.0 must include that exact record; 1.0.0 must not include it. Existing arithmetic and SQL recomputation remain intact. New validated explanations append application-owned contribution limitations; the model does not receive user feedback or choose provenance penalties.

## Retention, export, deletion and rollout

Current feedback, classification history and reviews expire 180 days after the owner's last edit. Review activity does not extend this period. Scheduled maintenance prunes independently from job/source cleanup. Private request-key/hash tombstones survive to prevent expired/deleted feedback from being resurrected by delayed retries; they contain no comment or classification and cascade on account deletion. Deleting an analysis deletes its feedback/reviews/provenance through foreign keys. Account export v8 includes owned current feedback, safe history/reviews and provenance, omitting reviewer identity and request keys/hashes. Account deletion cascades through owned feedback, reviewer grants and private provenance; references to a deleted reviewer on another owner's review become null.

Deploy additive migration `20260920000800_finding_feedback_and_provenance.sql` before the new API, worker, maintenance and export consumer. `FINDING_FEEDBACK_ENABLED` controls owner writes; saved owner reads/deletion remain available with flags off. `FEATURE_ONE_PROVENANCE_ENABLED` separately selects 1.1.0 for new intake and defaults off; the master feature flag suppresses it. Workers select checked-in handlers matching the claimed frozen policy, so changing intake flags does not reinterpret queued 1.0.0/1.1.0 jobs. Unsupported policies still fail closed.

Old reports and observations remain immutable. An explicit rescan selects a newly enabled aggregation policy and the comparison identifies `aggregation_changed`. Turning provenance off changes future intake only. If a context detector proves misleading, disable new intake or release a corrected version, generalize the issue in a quality notice, and offer explicit reanalysis; do not rewrite or erase existing reports. No retrospective recalculation, automatic email, external deployment or live flag activation is part of this run.

A regression under load exposed separately evaluated terminal job clocks crossing a millisecond. The additive migration keeps the existing immutable transition guard and ensures a terminal write's `updated_at` includes its `finished_at`. A deterministic database case checks ordered response timestamps and continued terminal immutability. No completed row is backfilled or report rewritten.
