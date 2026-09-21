# ADR 0008: bounded structural observations and optional provider metadata

Status: accepted for the scoped Run 08 implementation, September 20, 2026. Requirements: ANA-004–005 and ING-009. This delivers static observations; implementation detection, capability aggregation, narrative validation and public rollout remain downstream work.

## Extraction boundary

`domain/extraction/pipeline.ts` consumes only Run 06's `SafeSnapshotContext` plus trusted pinned identity, frozen versions and a captured metadata batch. Each registered extractor declares its source family, supported types, version, output schema, budgets and failure behavior. Its pure function receives one filtered string; it has no filesystem, network, module resolution, package manager or shell capability. JavaScript/TypeScript modules are parsed with `createSourceFile`, never imported, compiled, evaluated or executed.

The registry is `structural_inventory@1.0.0`, `structural_signals@1.0.0`, coverage manifest `1.0.0`. Parser dependencies are pinned to TypeScript 5.9.3, yaml 2.9.1 and smol-toml 1.8.0. Each file is capped at 256 KiB, parser trees at 20,000 nodes/64 levels, and output at 2,000 observations per snapshot. Run 06's total context/entry/line budgets still apply. Source work yields between files for revocation and abort handling. A 60-second extraction deadline fails the stage instead of sealing a timing-dependent partial artifact. The existing worker supervisor enforces its independent process deadline and heap limit.

JSON requires valid JSON and duplicate-key checking. YAML rejects duplicate keys, aliases, custom tags, merge expansion and multiple documents, with diagnostics suppressed. TOML has an explicit depth limit. Syntax or format failures become typed coverage counters; context authorization, cancellation and lease errors propagate. No parser diagnostic or input excerpt is retained or logged.

## Observations and limits

- Dependency declarations: npm manifests and v2/v3 package locks, pnpm v6/v9 lockfiles, bounded requirements files and PEP 621/735-style pyproject declarations. Production, development, optional, peer, workspace, alias and transitive-record counts remain distinct. Scopes may overlap. Only closed, recognized technology names are retained; arbitrary package names, versions and registry URLs are omitted. These observations cannot establish implemented use.
- Project boundaries: nearest eligible manifest location, including malformed/unsupported manifest candidates; nested projects are counted separately. Declared workspace patterns are counted, not expanded as proof of membership. No installation or import resolution takes place.
- Source/test structure: TS/JS AST module counts, named candidate suites/tests/assertions, skip modifiers, recognized framework imports and unambiguous relative-import associations. Shadowed names, aliases and dynamic suites are limitations. Setup helpers are not counted as tests. Other test languages receive filename-level inventory only. Tests are never run and association is not coverage.
- Configuration: JSON/YAML/TOML structure, static config syntax, Dockerfile instruction/stage counts, GitHub Actions jobs/conditions/test commands, and named deployment configuration. Dynamic values remain ambiguous. A disabled/conditional job or a command invoking tests is configuration, not a passing check or deployed system.
- Schema/docs: SQL DDL token structure and Prisma model declarations; documentation headings, links, fences and architecture headings. SQL dialect correctness and migration execution are not assessed. README prose remains untrusted and is never copied into observations.
- Unsupported formats (including Yarn lock syntax, npm lock v1, Maven/Gradle dependency evaluation, dynamic/Poetry dependency resolution and deep non-JS implementation analysis) are explicit. They remain inventoried and in eligible denominators. Run 10 owns the expanded language support matrix.

Each evidence item records source type, encrypted locator, snapshot/SHA, extractor version, content fingerprint, fixed observation, typed facts, confidence basis, claim boundary and limitations. Natural keys derive deterministic opaque UUIDs from repository-scoped HMACs. Content HMACs are re-keyed again at persistence; caller-selected hashes never become trusted lookup keys. No raw source, provider prose, author names or email addresses enter evidence, metrics, owner export or narratives.

Strength/confidence numbers are deliberately labeled **uncalibrated** in the structural contract. They are conservative placeholders, not measured probabilities or skill scores. Structural items currently have no capability assignments; Runs 09/11 must apply taxonomy scope and calibration rules before aggregation. Contribution remains unknown. Source-specific claim boundaries are enforced by runtime schemas.

## Security policy compatibility and denominators

Old pins retain security policy 1.0.0 unchanged. New structural runs explicitly select `structuralSecurityPolicy()` (1.1.0), which permits bounded supported lockfile paths and schema/migration SQL paths after all mandatory directory, size, encoding, ignore and secret checks. Dump/backup/seed/fixture/data paths and detected SQL data statements remain excluded. SQL screening handles nested comments between keywords; conservative exclusions may omit legitimate migrations. The static scanner and SQL filter are not a calibrated DLP guarantee. Binary lockfiles and unsupported generated dependency artifacts remain excluded.

Excluded files have **aggregate reason counters**, never fabricated or retained private paths. Total repository files equal eligible files plus security exclusions. Eligible files, including unsupported, oversized-for-parser and malformed inputs, remain in language/source denominators. Each source reports analyzed, parse-failed, unsupported, limited and no-signal counts. Filename-only analysis is labeled inventory depth. A lack of eligible matches does not establish that the author never tests or lacks a capability.

## Authorized provider metadata

`AuthorizedMetadataSource` invokes the existing verified connection service separately for requested commits, PRs, checks, statuses and Actions. Tokens are ephemeral, read-only, scoped to one selected repository and the relevant permission. Every page is surrounded by the same safe-context/job/grant fence. Access loss is fatal; optional permission denial, outages, parse/size limits, truncation, no signal and omission have distinct coverage states.

The client constructs only fixed GitHub REST paths with the pinned full SHA; it never follows redirects or Link URLs. Each group has at most two pages of 50 records, one MiB per response and a 15-second HTTP timeout. Commit ancestry comes from a SHA-rooted history query. PR head/merge relationship, check head SHA, combined-status SHA and Actions head SHA are checked explicitly. A successful result on another SHA remains repository context. A check record supports only that provider result, not all tests passing or successful deployment.

Retained provenance includes retrieval and event times, subject SHA, exact/ancestor/context relationship, parent counts, state/conclusion, author type and whether the provider author matches the connected identity. Raw identities, names, messages, PR prose, check output and URLs are discarded. Missing/limited history remains uncertainty. Run 15 can use these captured facts without refetching unrelated history; facts not collected remain unknown.

## Persistence, reuse and operations

Migration `20260920000100_structural_evidence.sql` adds structural file facts, private content HMACs, source/language indexes and aggregate-count validation. Snapshot uniqueness now includes an internal artifact key covering effective extractor/security policy, filtered content, metadata options and the captured metadata batch. This advances the necessary part of Run 10's cache work: differing permission states, retrievals or check results cannot collide with an unrelated sealed snapshot. Metadata order is canonicalized. Existing artifacts keep a `legacy` key; old migrations and evidence are not rewritten.

All writes retain Run 02 membership/immutability and Run 07 job fencing. Retries reuse the job's saved snapshot reference; returned canonical IDs remain authoritative. Export v5 strips the new artifact key and still omits fingerprints/encrypted locations. Existing account/analysis deletion and reference-aware pruning cover the new columns.

`productionExtraction()` is a lazy factory for the real Run 07 extraction interface. It logs counts, truncation and elapsed time only. The complete production registry remains null; public intake stays unavailable. A disabled extractor produces explicit unsupported coverage and a distinct deterministic prerelease bundle version. Changing parser behavior requires a new bundle version, not modification of sealed output. Deploy schema before code, keep intake off, and retain additive schema/history during rollback. No remote migration or flag change was performed.

## Primary references and verification

The implementation uses the official [TypeScript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API), [yaml parsing and alias controls](https://eemeli.org/yaml/), [smol-toml](https://github.com/squirrelchat/smol-toml), and GitHub's [commit/associated-PR](https://docs.github.com/en/rest/commits/commits), [check-run](https://docs.github.com/en/rest/checks/runs), [commit-status](https://docs.github.com/en/rest/commits/statuses) and [Actions run](https://docs.github.com/en/rest/actions/workflow-runs) APIs.

Synthetic fixtures cover monorepos, dependency/documentation-only projects, aliases, missing/malformed manifests, failed parsing, unsupported sources, disabled workflow jobs, SQL exclusions, private/secret sentinels and output truncation. Real PostgreSQL checks concurrent deduplication, metadata cache identity, forged counters/SHA relationships, fences, export and deletion. `extraction:verify` adds a separate 256 MiB parser process with an independent 15-second watchdog and exact source-free output checks. These development fixtures do not replace Run 16's held-out calibration or live GitHub acceptance.
