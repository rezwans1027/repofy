# Run 08 — Inventory and structural evidence extraction

**Status:** Complete for the scoped local implementation; see [verification and handoff](08-handoff.md). Implementation detection, expanded language coverage, calibration and live-provider verification remain downstream gates. **Depends on:** Runs 03, 06–07. **Requirements:** ANA-004–005, ING-009; PRD sections 7.2, 16, and 18.1.

## Outcome and scope

Convert a filtered snapshot plus authorized provider metadata into reproducible file inventory and evidence observations. The pipeline recognizes structure, dependencies, tests, CI, schemas, and documentation without claiming that files were executed or that declared dependencies demonstrate proficiency.

Implementation-level TypeScript/JavaScript detectors follow in Run 09. Provenance grading follows in Run 15, but this run must already collect and type the authorized metadata required by ANA-005.

## Read first

- [Existing GitHub data fetching](../repofy-backend/src/services/github.service.ts) and [GitHub data types](../repofy-backend/src/types/index.ts).
- Run 03 capability definitions, Run 06 SafeSnapshotContext, and Run 07 stage interfaces.
- PRD evidence source types, coverage boundaries, and claim-validation rules.

## Implementation sequence

1. Define pure inventory/extractor interfaces consuming the safe snapshot context. Each extractor declares supported file types, version, budget, expected output schema, and failure behavior. It has no arbitrary filesystem, network, package-manager, or shell access.
2. Inventory eligible/excluded files, text sizes, language classifications, generated/dependency status, and safe exclusion reasons. Distinguish total repository inventory from analyzed eligible files. Preserve denominators for coverage rather than reporting only successful parses.
3. Detect monorepo/project boundaries and manifests. Distinguish production, development/test, optional, transitive, and workspace dependencies where the source format supports it. Parse lockfiles with bounds; dependency presence yields a dependency observation, not an implementation conclusion.
4. Extract framework/configuration signals from JSON/YAML and statically inspected configuration files. Never import or execute JavaScript/TypeScript config modules. Bound recursive structures and parser expansion, and report ambiguous configuration explicitly.
5. Discover test frameworks and candidate test files, suites, assertions, and implementation associations supported by static evidence. Existing tests in a repository do not prove they pass; lack of matching files after exclusions does not prove the author never tests. Maintain distinctions used by Run 09's meaningful-test detectors.
6. Extract CI/workflow, Dockerfile, deployment configuration, database schema/migration, SQL, documentation, and architecture observations. A workflow command saying npm test is CI configuration evidence, not a test result or successful deployment. Secret-filter metadata strings as necessary before narrative use.
7. Fetch bounded commits, pull requests, checks/statuses, and Actions metadata only through the authorized provider client. Bind observations to the exact SHA or clearly record their historical relationship, retrieval time, and applicability. A passing check on a different SHA must not count as the analyzed commit passing.
8. Distinguish unavailable permission, provider outage, history truncation, excluded files, parse failure, no signal observed, and unsupported source type. Feed these states into the coverage manifest; do not silently substitute zeros.
9. Normalize findings into evidence items with snapshot ID, source type, locator, detector/extractor version, observations, confidence basis, content fingerprint, scope limitations, and visibility. Assign deterministic natural keys so a repeated stage can upsert/deduplicate observations without producing duplicate claims.
10. Persist sanitized observations through Run 02 membership rules and Run 07 idempotent stages. Record counts, parser failures, timing, and truncation safely. Introduce benchmark fixtures and expected observations now so Run 16 can evaluate accumulated behavior.

## Proposed modules and artifacts

Add backend analyzer modules for inventory, manifests, tests, CI/configuration, schemas, documentation, and provider metadata. Store synthetic fixture repositories under a dedicated tests/fixtures/evidence directory; clearly label planted secret sentinels as test material and never use copied private source.

Each finding exposes an observation and a claim boundary. For example, a workflow invoking tests supports the presence of automated test configuration, not a claim that all critical paths are tested or that CI is currently passing. Narrative strings from README files remain untrusted input.

## Acceptance criteria

- Repeated extraction of the same snapshot/policy produces equivalent normalized observations and no duplicate evidence rows.
- Inventory covers analyzed and excluded content with honest counts and reasons.
- Dependency, code, test, config, docs, commit, PR, and CI observations use distinct source types.
- Missing optional metadata permissions produce visible limitations rather than analysis failure or invented data.
- Commit/check metadata cannot be attributed to a different snapshot implicitly.
- No extractor executes repository configuration or source.

## Verification

Use synthetic single-package apps, monorepos, dependency-only repositories, documentation-only examples, malformed configuration, aliased/missing manifests, disabled workflows, migrations, and oversized metadata. Test snapshot-mismatched checks, truncated history, optional permission denial, and repeated stage execution.

Compare exact observation semantics rather than snapshotting large opaque JSON. Include false-positive fixtures where README claims testing but no implementation/check evidence supports it. Capture logs and persisted rows to assert no secret sentinel or unredacted private excerpt appears.

## Migration, rollout, and handoff

Add necessary inventory/coverage indexes and source-type enum extensions compatibly. Version extractor behavior; do not rewrite older evidence when a parser changes. A faulty extractor can be disabled for new runs while reports retain the recorded limitations/version.

Hand off extractor interfaces, source-specific confidence/limitation rules, fixtures, provider metadata contracts, and coverage counters. Run 09 builds implementation detectors on the normalized inventory; Run 15 consumes provenance metadata without refetching unrelated history.
