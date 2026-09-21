# Branch review corrections

The review corrections address four reproduced defects:

- Source reads share an authorization checkpoint for at most the existing two-second polling interval. Inventory and publication still request a fresh checkpoint, stale concurrent reads share one pending check, and abort/disposal closes the context. The 1,000-file regression models 65 ms database latency and requires two checkpoints instead of one per source file.
- Straight-line implementation matching stops after known terminal statements. Unreachable local calls no longer support request validation, authentication, route/service, or form-validation evidence.
- Cleanup evidence requires an immediate, unconditional release in `finally` and a reachable direct query in the corresponding `try`. Conditional cleanup and preceding effects that could bypass release are outside the supported pattern.
- Prisma declarations use Prisma comment/string handling. Commented-out models do not support data-modeling evidence, and apostrophes in comments do not invalidate real models. Malformed or unsupported lexical syntax fails closed; SQL handling remains separate.

Corrected analyzer profiles have new version identities. Existing observations and historical migrations remain unchanged. The additive migration registers the new definitions and validates coherent old or new version combinations. New workers reject jobs pinned to unsupported old execution policies before processing source; create a new analysis to use the corrected implementation.

The aggregation process verifier extracts fresh synthetic evidence under the current profiles, checks independent arithmetic and ordering invariance, and retains its 20,000-observation workload, 384 MiB heap, and 30-second watchdog. Historical Run 11 examples stay unchanged and are explicitly rejected as input to the corrected analyzer.

Production and development dependencies were updated within their existing major versions, including Next.js and Vitest security patches. The pinned extraction/parser dependencies remain unchanged.

Historical human approvals in the Run 16 review/rendering files remain intact. They are bound to the earlier domain implementation, so the corrected implementation has no transferred human labels. Automated benchmarking may continue, but current human-review metrics remain unavailable and release stays on hold until the required reviews and external gates are satisfied.

Verification results are recorded in `run16-verification.json`, `run16-results.json`, and `run16-load.json`. These cover local synthetic behavior, not live providers or deployment readiness.

The completed verification passes all 22 checks against one unchanged implementation digest: 82 contract tests, 1,273 backend tests, 108 PostgreSQL tests, 580 frontend tests, coverage thresholds, builds, process limits, and browser journeys. Both application dependency audits report zero production or development vulnerabilities. The recorded rollout decision remains HOLD with nine pending gates, including a new bound human review of the corrected implementation.

The updated Next/Sentry proxy emits a nonblocking close-listener threshold warning. A minimal reproduction without Express or rate limiting found 11 listeners per response; all five response objects were collected after completion in WeakRef/GC probes. No retained-response accumulation was reproduced, and no warning suppression or application workaround was added.
