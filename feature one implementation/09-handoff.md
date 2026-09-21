# Run 09 handoff — TS/JS implementation detectors

Completed 2026-09-20 for the scoped ANA-005–007 implementation, automated verification and required human sample review. The user confirmed all four labels in the [review sample](../docs/benchmarks/run09-human-review.md): **4/4 agreement, 0 disagreements, 0 uncertain labels**. This was one unblinded review of a convenience sample; broader precision calibration remains pending. Public analysis remains disabled pending Runs 10–12 and release validation.

## Delivered

- Sixteen versioned rules for TS, JS, JSX and TSX: route/service calls, request validation, authentication-state guards, resource-owner guards, structured errors, form validation, request loading/error/repeat actions, native labeled buttons, parameterized pg queries, Prisma transactions, Drizzle uniqueness/relationships, bounded retries, state guards, failure cleanup, asserted implementation calls and bounded structured model output calls.
- A bounded lexical symbol/import/reference index using the pinned TypeScript parser. Literal local aliases and selected ESM/CommonJS patterns resolve only within the included snapshot. Shadowing, mutations, ambiguous imports and unsupported configuration cannot become strong claims through a matching name.
- Additive implementation evidence and coverage contracts, exact source spans, opaque symbol/concept/pattern references, explicit test independence and conservative uncalibrated confidence/strength. Paths remain encrypted; snippets, identifiers, query text and prompts do not enter observations or exports.
- Immutable detector registry and database enforcement for capability mappings, confidence ceilings, file membership, coverage and quarantine versions. Concurrent worker writes, cancellation and owner boundaries preserve existing fences.
- Sixty-four positive/false-positive/limitation/mutation examples, additional semantic and pipeline checks, real worker persistence, PostgreSQL forgery/race tests and a blocking bounded-process CI check. Indexed membership lookup removes quadratic validation at the 2,000-observation ceiling.

## Stable interfaces

| Interface | Location / version |
| --- | --- |
| Registry, supported capability map, budgets and quarantine profile | [registry.ts](../repofy-backend/src/domain/detectors/registry.ts), [machine-readable manifest](../docs/benchmarks/run09-detector-manifest.json) |
| Local AST/symbol/import/reference index | [project.ts](../repofy-backend/src/domain/detectors/project.ts) |
| Required-pattern implementation | [rules.ts](../repofy-backend/src/domain/detectors/rules.ts) |
| Bounded pass and coverage | [pass.ts](../repofy-backend/src/domain/detectors/pass.ts) |
| Shared runtime contracts | [implementation.ts](../packages/contracts/src/implementation.ts) |
| Worker-compatible composition | `createImplementationExtraction` in [pipeline.ts](../repofy-backend/src/domain/extraction/pipeline.ts) |
| Additive database migration | [20260920000200_implementation_detectors.sql](../supabase/migrations/20260920000200_implementation_detectors.sql) |
| Synthetic detector examples | [implementation.ts](../repofy-backend/tests/fixtures/evidence/implementation.ts) |
| Parser decision, scopes and operational recovery | [ADR 0009](../docs/adr/0009-typescript-javascript-detectors.md) |

Use detector bundle `tsjs_implementation@1.0.0`, coverage `1.1.0`, taxonomy `engineering_capabilities@1.0.0`, existing structural extractor `structural_inventory@1.0.0`, initial role rubric versions `1.0.0` and `structuralSecurityPolicy()` version `1.1.0`. Copy profile version references explicitly into `VersionDependencies`; do not spread its `disabled`/`implementation` settings into the strict version object. The previous structural factory remains available for previous policies. The full production handler registry remains `null`.

Run 11 grouping: rules on the same enclosing implementation share `conceptId`; relations identify the target function's concept, file and span. Code links carry `same_source`; linked tests carry `separate_test` or `mocked_test`. `patternId` is an opaque, repository/snapshot-scoped AST-shape deduplication hint; it cannot increase strength or establish authorship. Shape collisions may conservatively merge different implementations. Mocked test strength is capped at 0.35 and is not independent corroboration.

## Verification

Verified with cached Node 22.23.2 and disposable PostgreSQL 17.11; application `.env` databases were not used.

| Check | Result |
| --- | --- |
| Full backend suite, coverage, one worker | **1,031 tests / 84 files passed**; statements 86.55%, branches 83.44%, functions 87.29%, lines 89.08%; unchanged thresholds pass |
| Focused detector/pipeline/worker cases | **78 passed**, included in the full suite |
| Real PostgreSQL migrations, races, ACLs and semantic rejection | **83 passed** |
| Shared contracts build and tests | **66 passed** |
| Full frontend suite with coverage | **551 tests / 83 files passed**; unchanged coverage thresholds pass |
| Backend and frontend builds/type checks | Passed |
| Frontend lint | Passed; existing unused `vi` warning in `query-client.test.ts` remains |
| Worker lifecycle, ingestion cleanup, structural parser and detector process checks | Passed |
| Human labeled-sample review | User confirmed A: unsupported, B: unsupported, C: supported, D: unsupported on 2026-09-20; 4/4 agreement, no disagreements or uncertain labels |

The detector process benchmark indexed **256 files**, emitted **510 observations**, and used **17,105 indexed nodes / 65,878 bytes**. The final measured invocation, including malformed/deep and additional node/byte-exhaustion scenarios, took **242 ms**, with **196 MiB peak RSS**, under a **256 MiB heap ceiling / 15-second parent watchdog**. These are synthetic process measurements, not production latency or detector precision. [Recorded metrics](../docs/benchmarks/run09-process-results.json).

The original 2,001-file structural truncation test exposed quadratic membership validation under coverage. Indexed lookup reduced its focused covered run to 472 ms; the final full suite passed without raising test timeouts or lowering coverage thresholds. One earlier full-suite worker integration run timed out; its isolated covered check and final full-suite run passed with the original deadline. No browser UI behavior changed, so browser E2E was not rerun.

Verification logs are `/tmp/repofy-run09-{backend,postgres,contracts,frontend,frontend-build,frontend-lint,backend-typecheck,frontend-typecheck,focused,benchmark,worker,parser-process,ingestion}.log`.

## Remaining gates and next run

The required human sample review is recorded and complete. Its four examples were shown with their expected labels, so the observed agreement does not establish production precision, recall or agreement across reviewers. Broader blinded evaluation, confidence calibration and role-rubric calibration remain pending. This review changed documentation and review metadata only; detector rules, versions and confidence values remain unchanged.

Run 10 must turn the machine-readable partial/unsupported capability map and implementation processing counters into honest language coverage. Structural file counts retain their structural meaning. Lack of a supported pattern is not proof of missing skill. Important unsupported scopes include Next.js server routing, arbitrary middleware and dependency injection, inherited/JSONC compiler configuration, package/barrel resolution, custom UI components, stale-response protection, mobile behavior, general concurrency/idempotency protocols, test globals/parameterized suites/async matcher chains and AI retrieval/evaluation/safety.

Run 11 must group overlapping observations and respect independent-test boundaries. Run 12 must validate final narrative claims. No model call, paid API call, remote migration, deployment, publication or billing change occurred.

For a faulty rule, create a new quarantine profile/version for future jobs, record an operator quality notice describing affected versions and claims, and offer an authorized fresh reanalysis. Preserve historical evidence and pinned jobs. Roll back the application factory only with a matching new policy; keep the additive database migration. Existing Runs 01–08 and unrelated workspace changes were preserved; no commit was created.
