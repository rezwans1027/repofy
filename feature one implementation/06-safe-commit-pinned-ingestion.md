# Run 06 — Safe commit-pinned snapshot ingestion

**Status:** Complete for the internal ingestion module and synthetic process driver; see [verification and handoff](06-handoff.md). Live private archive validation requires development-app credentials; Run 07 schedules and supervises the worker/janitor. **Depends on:** Runs 02, 04–05. **Requirements:** ANA-002, ANA-004 foundations, ING-001–008; PRD sections 22.2–22.3, 22.6, and 23.2.

## Outcome and scope

Produce a bounded, security-filtered snapshot context from an authorized repository at one exact commit. The context exposes only eligible, scanned content to later extractors and is destroyed reliably after use.

This run implements the ingestion module with a local/test driver. Run 07 schedules it durably. No repository commands, package installs, tests, builds, containers, or hooks are executed. Analysis fixtures contain synthetic code only.

## Read first

- [Existing GitHub fetcher](../repofy-backend/src/services/github.service.ts), [URL validation](../repofy-backend/src/lib/validators.ts), [retry helper](../repofy-backend/src/lib/retry.ts), and [logging](../repofy-backend/src/lib/logger.ts).
- Run 02 locator/retention decisions and Runs 04–05 provider/access interfaces.
- PRD ingestion, private-code-handling, repository-limit, and deletion requirements.

## Implementation sequence

1. Resolve the selected default branch to a full provider commit SHA after authorization. Persist branch, provider repository ID, SHA, and relevant timestamps before content download. Every content and metadata operation must refer to that identity; a branch changing mid-analysis must not mix snapshots.
2. Download through a constrained GitHub client with bounded redirects and credential forwarding. Validate provider download destinations according to official documentation; do not accept an arbitrary archive URL from the browser. Stream byte counts and stop at the compressed-size limit.
3. Create a uniquely owned temporary workspace per job attempt, outside static/public directories, with restrictive filesystem permissions and no cross-user reuse. Associate it with safe job metadata for cleanup without storing tokens or raw archive data in normal database rows.
4. Implement archive extraction guards: normalized paths, traversal/absolute-path rejection, unsafe symlink/hardlink rejection, entry count, nesting/path-length limits, compressed and decompressed byte ceilings, timeout, and memory limits. Compressed size alone does not protect against expansion attacks.
5. Apply default exclusions and .repofyignore before semantic processing. Exclude credentials/sensitive paths, vendored dependencies, generated/build artifacts, binaries, oversized files, and unsupported encodings. User rules cannot re-include mandatory security exclusions. Record counts and safe exclusion reasons without leaking excluded secret filenames outside owner policy.
6. Run secret/sensitive-data detection before any model-bound context exists. Resolve scanner selection and false-positive behavior in an ADR. Scanner failures fail closed for model-bound content. Persist exclusion/redaction outcomes and safe counts, never matched secret values or unredacted samples.
7. Expose a read-only SafeSnapshotContext API that returns eligible scanned text, safe locator references, normalized file metadata, content hashes, and coverage/exclusion summaries. Detectors cannot bypass it to read arbitrary disk paths or request network content.
8. Add configurable defaults from the PRD: 100 MB compressed archive, 10,000 eligible text files, 1 MB per text file, bounded total considered lines, and a defined decompressed-size limit. Freeze effective limits and scan policy versions into the run. Document reduced-scan versus rejection behavior; never silently call a truncated scan complete coverage.
9. Delete workspace content in success/failure/cancellation paths and implement crash/orphan cleanup integration. The PRD target is deletion within 60 minutes of completion or terminal failure; a finally block alone cannot cover process termination. Run 07 schedules periodic sweeping and lease-aware cleanup.
10. Carry secret-filter, exclusions, parser coverage, and scan-limit versions in the snapshot/extraction identity. Snapshot-based reuse must not reuse data across incompatible security policies. Define how revocation stops fetches and how deletion cancels an active workspace.

## APIs, storage, and boundaries

This is an internal worker module, not a public upload/extract endpoint. Proposed entry points resolveSnapshot, prepareSafeSnapshot, and disposeSnapshot use typed contexts and cancellation signals. Use the separate process boundary chosen for the worker; keep heavy archive processing out of Express request handlers.

Persist file metadata and safe locators under Run 02 policy. Do not retain raw files just to make future drill-down convenient. Public evidence links can be generated from the pinned commit; private refetch requires fresh authorization and security filtering.

## Acceptance criteria

- The analyzed SHA remains fixed when the default branch advances or a request is retried.
- Traversal, symlink escapes, archive expansion, excessive files, malformed ignore patterns, and binary content cannot bypass limits.
- Later extractors/model adapters have no access to excluded/unscanned source through the provided interface.
- Scanner/provider errors never place raw source, matched secrets, or tokens in errors or telemetry.
- Workspaces are deleted after terminal outcomes and orphan cleanup has a demonstrable bounded policy.
- Partial/unsupported scans expose explicit limitations and never imply complete absence of evidence.

## Verification

Create adversarial archives and synthetic repositories: traversal, absolute paths, malicious links, huge expansion, generated output, invalid encoding, secrets in unusual files, Unicode paths, and .repofyignore precedence. Test branch movement, interrupted streaming, timeout, revocation during download, disk-full behavior, secret-scanner failure, and cleanup after a simulated process crash.

Instrument child-process execution in ingestion tests so any attempt to run repository instructions fails. Compare temporary-directory contents before/after tests. Verify source sentinels never occur in captured safe logs or model-input fixtures.

## Migration, rollout, and handoff

Add inventory/security-outcome columns through additive migrations if required. Maintain a private-repository threat-model document. Keep real ingestion disabled until limits, scanner behavior, and cleanup pass; disabling intake must not disable cleanup.

Hand off SafeSnapshotContext, effective limits, secret-scanner ADR, fixtures, retention evidence, cancellation rules, and the janitor contract to Run 07. Run 08 consumes only the filtered context.
