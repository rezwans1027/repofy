# Run 09 — TypeScript and JavaScript implementation detectors

**Status:** Complete for scoped implementation, local verification and human sample review (4/4 agreement on 2026-09-20). Broader precision calibration remains pending. See [handoff](09-handoff.md) and [review sample](../docs/benchmarks/run09-human-review.md). **Depends on:** Run 08 and Run 03 taxonomy. **Requirements:** ANA-005–007; PRD sections 7.2, 16.4–16.6, 18.1, and 18.5.

## Outcome and scope

Detect concrete engineering behaviors in TS, JS, JSX, and TSX using bounded static analysis. Every supported conclusion has a source location, detector/version, confidence basis, and stated limits. A detector cannot infer that a system is secure, scalable, or correct solely from a matching name.

This run delivers a useful tested detector bundle, not a general program-verification engine. Unsupported patterns remain unknown/limited rather than being silently converted into strong claims.

## Read first

Read Run 03 capability scopes, Run 08 extractor interfaces/fixtures, and the PRD's evidence-strength and deep-language-support requirements. Inspect representative existing application code for patterns only; do not publish this workspace's code as user evidence or commit private production source into fixtures.

## Implementation sequence

1. Evaluate and document the parser strategy using maintained primary documentation. Compare syntax support, error recovery, memory/time limits, source locations, and dependency/build impact. Parse repository configuration as data; do not execute compiler plugins, generators, macros, package scripts, or arbitrary imports.
2. Build a bounded local symbol/import/reference index. Resolve local module aliases only when statically safe, and mark ambiguous external/dynamic relationships as uncertain. Configure ceilings for file size, AST nodes, recursion, graph traversal, and parser time.
3. Define a detector contract containing ID/version, capability candidates, supported ecosystems, required observations, forbidden overclaims, observation strength basis, and positive/negative fixture expectations. Reuse normalized inventory rather than implementing a second file crawler.
4. Implement backend/API detectors for route/service boundaries, input validation, authentication checks, authorization checks, and structured errors. Distinguish authentication from resource ownership enforcement; an imported middleware name alone does not establish either behavior.
5. Implement frontend detectors for component/data-flow boundaries, forms and validation, loading/error/retry states, data fetching, and accessible interaction patterns that can be established statically. Avoid claims that static markup proves complete accessibility or good UX.
6. Implement database and reliability detectors for parameterized queries/ORM use, schema relationships, transactions, uniqueness constraints, bounded retries, idempotency/state guards, and failure cleanup. Describe the specific observed control rather than certifying end-to-end concurrency safety.
7. Implement testing detectors that connect assertions and exercised paths to implementation, identify obvious skipped/empty tests, and distinguish mocks from integration boundaries. Passing status and coverage percentages require actual authorized matching CI artifacts; source inspection must not invent them.
8. Add supported security/configuration and AI application patterns where the taxonomy requires them, such as schema-validated external input, bounded model calls, or output validation. Dependency presence remains a separate weak observation. Scope the initial bundle explicitly if a capability is still not assessable.
9. Emit evidence with stable source spans, safe symbol references, implementation-concept keys, independent corroboration links, and conservative confidence. Multiple detectors examining the same code must supply enough clustering metadata for Run 11 to avoid double-counting.
10. Maintain detector capability/coverage manifests, performance budgets, and explanation boundaries. Every detector needs at least a meaningful positive, a plausible false positive, and a limitation case. Add mutation-style negative variants where they test a real semantic distinction.

## Evidence examples

A transaction around two related database writes can support the observed use of a transaction at those locations. It cannot independently prove all application writes are atomic. A retry loop without a bound should not pass a bounded-retry detector. A test named rejects unauthorized users must contain relevant exercised behavior and assertions before contributing strong authorization-test evidence.

Do not confuse generated code with AI authorship. Generated/vendor classification is about evidence relevance; no detector labels developers fraudulent or claims definitive authorship.

## Acceptance criteria

- Meaningful source usage outranks a manifest import or README assertion under declared detector rules.
- Each implementation claim is tied to the exact included snapshot and a traceable location.
- Tests, docs, and config can corroborate implementation without multiplying duplicate observations.
- Parse errors, dynamic patterns, generated code, and unsupported framework features reduce assessability/confidence explicitly.
- Detector output is schema validated before persistence and constrained to the capability scope it can support.
- The bundle stays within measured CPU/memory limits on representative synthetic repositories.

## Verification

Create fixtures with disconnected validation helpers, unauthenticated routes beside protected routes, string-interpolated SQL, unused retry libraries, unbounded retry loops, mocked-only tests, skipped assertions, copied/generated modules, JSX patterns, mixed CommonJS/ES modules, and monorepo aliasing. Assert both supported and rejected observations.

Run parser stress tests and capture failures without source snippets. Have a human review a labeled detector sample and record disagreement. Do not mark detector precision complete based only on tests authored from the same implementation assumptions.

## Migration, rollout, and handoff

Register an immutable detector bundle version; schema additions are additive. Quarantine a faulty detector for future runs through a new manifest/version, never rewrite old reports silently. Record a quality notice/reanalysis path if an existing detector is later found misleading.

Hand off the detector registry, capability map, positive/negative fixtures, stable concept keys, measured limits, and known unsupported patterns. Run 10 converts that manifest into honest user-facing coverage; Run 11 aggregates the observations.
