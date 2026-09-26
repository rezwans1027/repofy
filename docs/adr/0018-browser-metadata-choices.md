# ADR 0018 — Browser metadata choices and rescan continuity

September 26, 2026. Implements the browser path for ANA-005/018 and preserves
metadata scope across ANA-016 rescans.

Initial analysis offers opt-in commit history, pull request metadata, and CI results.
The default remains off. Each choice describes its read permissions and bounded or
exact-commit scope. Saved selections may include their last verified installation
permissions, encrypted with the existing display data. These are advisory: the
authorized collector rechecks current repository access and each read permission.
Missing optional permission or provider failure is captured as a coverage limitation.
Revoked repository access still fails analysis under the existing authorization rules.

Owner report views expose the original job's `includeMetadata` options separately
from immutable report content. Rescans initialize from those choices, including
sources that were denied or unavailable. Older API responses fall back to recorded
metadata states; `not_requested` stays off. Users may explicitly change the scope.

Session replay keys include metadata choices as well as actor, saved-selection
revision and, for rescans, baseline and repository IDs. Choice persistence and key
reuse cover uncertain responses, remounts and browser token refresh. A changed
scope receives a distinct key. No authentication token or source is stored there.

Browser acceptance uses real routes, PostgreSQL, workers and authorized metadata
collectors with synthetic HTTP responses. It verifies two-page truncated history,
exact-SHA PR/CI evidence, provenance history, rescan continuity, fresh permission
denial and unavailable CI without losing source evidence. This does not replace
the separate live GitHub installation release gate.
