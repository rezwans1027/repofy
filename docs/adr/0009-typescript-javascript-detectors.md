# ADR 0009: bounded TypeScript and JavaScript implementation evidence

Date: 2026-09-20. Status: implemented and human sample review complete; broader precision calibration pending. Requirements: ANA-005–007; PRD 7.2, 16.4–16.6, 18.1, 18.5.

## Parser choice

Keep the existing production dependency **TypeScript 5.9.3** and its in-memory `createSourceFile` parser. TS, JS, JSX, TSX, MTS/CTS and MJS/CJS share one AST vocabulary. Diagnostics invalidate the entire file for implementation evidence; an error-recovered tree never supplies positive claims. Source spans come from the parsed file's offsets and line map. The index adds lexical scopes, declarations, imports, references and a bounded local call relation without a compiler host, type checker or package resolver. No repository configuration, imported module, package script, transform, plugin or generator executes.

| Candidate | Syntax and recovery | Locations | Dependency and isolation implications |
| --- | --- | --- | --- |
| TypeScript, selected | Native JS/TS and JSX/TSX AST; reject any parse diagnostic. Newer syntax outside the pinned parser remains unassessable. | Offsets and source-file line/character map | Already installed for Run 08; no added dependency or alternate AST conversion. No `Program` or filesystem `CompilerHost`. |
| Babel parser | TS and JSX syntax modes; optional error recovery can still throw. | Parser location/offset options | Another production parser and AST adapter; repository Babel configuration would still be ignored. No demonstrated benefit for this initial pattern set. |
| Acorn | Core JavaScript parser, separate loose parser and syntax-extension plugins | Parser AST location options | TS/JSX require extensions and their compatibility policy. Repository-selected plugins remain prohibited. |

These comparisons use the maintained [TypeScript compiler API documentation](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API), [Babel parser documentation](https://babeljs.io/docs/babel-parser), and [Acorn project documentation](https://github.com/acornjs/acorn). They describe available APIs; none supplies our application heap or deadline guarantees. Pinning the parser and versioning the detector release makes parser upgrades explicit evidence changes.

## Resolution and execution boundaries

The pass consumes Run 08's already filtered inventory and bounded strings. It never crawls another filesystem. Imports resolve only to included, parsed local files with a single candidate. Literal relative imports, `.js` to `.ts` substitution without ambiguity, named ESM export aliases, simple CommonJS destructured `require` and `exports.name = localFunction` are supported. External APIs are recognized by literal package imports and observed receiver construction/use, not a variable's spelling. Local shadowing, duplicate declarations, type-only imports, reassignment, property writes, known object mutation APIs and writes through simple aliases invalidate an API binding.

Strict JSON `tsconfig.json`/`jsconfig.json` can declare a literal `baseUrl` and single-target `paths` mapping with at most one wildcard. Targets cannot escape the included repository. The nearest configuration wins; conflicting configurations, inherited config, project references, plugins, custom roots/suffixes, multiple targets, and ambiguous files remain unresolved. Invalid resolution configuration also prevents assuming a bare import refers to an external package. JSONC, package exports, workspace-package resolution, barrels, namespace calls, dependency injection and whole-program side effects are outside this version. Runtime package versions and monkey-patching remain unverified.

Direct evaluation and `with` make a file unsupported. Dynamic imports and dynamic `require` are counted as uncertain relationships. Declaration files and generated headers supply no implementation claims. Earlier security exclusions remain authoritative and never re-enter this pass.

## Detector and claim contract

The [registry](../../repofy-backend/src/domain/detectors/registry.ts) defines 16 immutable `tsjs.*@1.0.0` rules, required observations, capability candidates, ecosystems, forbidden overclaims, fixture expectations and budgets. `CAPABILITY_COVERAGE` enumerates all 34 taxonomy capabilities as partial or unsupported; none is advertised as completely assessed. Existing taxonomy/rubric releases are unchanged.

Supported observations cover Express route-to-local-function calls, connected Zod request parsing, separate authentication-state and resource-ownership guards, structured error returns, connected React form validation, rendered request pending/error state with a repeatable action, labeled native buttons, parameterized pg queries, Prisma interactive transactions, Drizzle uniqueness/references, bounded local retry loops, local state guards, pg finally cleanup, assertions of local implementation results and bounded structured AI SDK calls.

API contracts are grounded in the documented [Zod parse behavior](https://zod.dev/basics), [pg parameter arrays](https://node-postgres.com/features/queries), [Prisma interactive transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [Drizzle constraints](https://orm.drizzle.team/docs/indexes-constraints), and [AI SDK 5 generateObject options](https://v5.ai-sdk.dev/docs/reference/ai-sdk-core/generate-object). Observing these API shapes does not attest the installed dependency or runtime outcome. The AI detector supports that explicit API shape; newer SDK output APIs are not inferred.

Confidence is **0.55**, with strength **0.40–0.55** depending on the rule. Mocked/intercepted test evidence is capped at confidence **0.40**, strength **0.35** and cannot claim independent corroboration. These are uncalibrated policy limits, never statistical probabilities. Run 08 dependency/configuration presence stays weaker and separate. A missing match is not a missing capability.

Every rule's explanation states the actual local observation. Authentication-state checks never map to `security_authorization`. A state guard never proves durable idempotency or race safety. A retry ceiling does not bound the called operation's duration. Markup does not prove full accessibility. Client validation is not server authorization. A transaction call does not prove all writes are atomic. Source tests do not imply passing CI, integration coverage or a percentage. AI output-schema options do not establish prompt-injection safety, context authorization or output quality.

Known unsupported scopes include Next.js server routing, middleware composition, safeParse control-flow variants, custom UI components, stale-response prevention, mobile lifecycle/offline behavior, arbitrary ORM/query builders, general idempotency protocols, Jest globals, parameterized tests, asynchronous matcher chains, end-to-end test harnesses, general negative-test semantics and AI retrieval/evaluation/safety. Run 10 must expose these boundaries; Run 11 must honor them when aggregating.

## Provenance and grouping

The additive shared `implementation` detail includes a closed rule kind, source line/column span, confidence basis, claim boundary, calibration status, limits, opaque symbol/concept/pattern IDs and bounded local-call/assertion relations. Paths remain exclusively in encrypted internal locators. Observations and exported details contain fixed explanations and opaque references, never identifiers, source snippets, SQL text, prompts or test titles.

Symbol and concept IDs derive from the snapshot, file identity and enclosing implementation span. Multiple rules on one handler share its concept. Relations identify an included local target function and its concept, so Run 11 can attach test corroboration to the observed implementation. Code-to-code links are always `same_source`; a separate test file is `separate_test` only when no recognized interception is present. No external-integration claim is made.

The repository/snapshot-scoped pattern ID hashes the enclosing AST kind sequence through the existing keyed identity function. Copied structures in different files can be conservatively grouped; names, literals and comments are omitted. Shape collisions can merge distinct implementations, so this is a deduplication hint, never positive evidence of common authorship or independently corroborated behavior. It must not increase strength. It is not a cross-repository tracking key.

## Coverage, budgets and failure handling

| Limit | Value |
| --- | --- |
| Existing per-file parse input / AST / depth | 256 KiB / 20,000 nodes / 64 levels |
| Implementation candidate files / indexed source bytes / total indexed nodes | 256 / 2 MiB / 100,000 |
| Graph work per file / recursive symbol resolution | 200,000 charged steps / 12 hops |
| Alias configurations / mappings per configuration | 32 / 32 |
| Findings per file / entire snapshot evidence | 100 / 2,000 |
| Observed single-file indexing deadline / implementation phase deadline | 1 second / 15 seconds |
| Verification subprocess heap / independent parent watchdog | 256 MiB / 15 seconds |

Byte/node/file/graph limits deterministically mark processing as limited. All findings for a graph-limited file are discarded. Timeouts fail the stage with `WORKER_EXPIRED`; they cannot seal timing-dependent partial artifacts. Synchronous parser work cannot be interrupted by an in-thread timer: input/depth ceilings limit it, deadlines are checked on return, and Run 07's separate worker supervisor provides the outer production process boundary. The 15-second independent watchdog is specifically the verification harness; it does not replace the production attempt supervisor.

Coverage separately records eligible/analyzed/failed/limited/unsupported/generated/no-signal files, unresolved imports, dynamic references, ambiguous bindings, rejected alias configurations, indexed bytes/nodes, quarantined detectors and per-rule persisted evidence counts. Structural language denominators retain Run 08 meaning; semantic assessability is in the new manifest rather than silently relabeling every parsed file semantic. Hitting an evidence cap is explicit. Access is checked again before any persistence-ready output is returned.

## Persistence, quarantine and rollout

The detector bundle is `tsjs_implementation@1.0.0`, coverage manifest `1.1.0`; structural extractor `structural_inventory@1.0.0` and security policy `1.1.0` remain unchanged. The full profile participates in artifact identity. `createImplementationExtraction` is the production extraction factory; `productionHandlers` remains `null` until Runs 10–12 provide the remaining validated stages.

Migration `20260920000200_implementation_detectors.sql` registers immutable rule-to-capability/strength definitions. Insert/seal triggers reject unrelated file references, unsupported capability mappings, inflated confidence/strength, malformed or mismatched coverage and invalid quarantine versions. The backend also checks exact snapshot membership, lines, encrypted locator association and current taxonomy. Existing sealed artifacts are not rewritten. File membership validation now uses maps to avoid quadratic work at the 2,000-item observation ceiling.

Quarantine future analyses with `implementationProfile([kind, ...])` or the factory's disabled list. This yields a distinct `1.0.0-q<16-bit-mask>` release and explicit quarantined coverage; an old job cannot switch profiles mid-flight. Keep prior artifacts and pinned jobs immutable. If a rule is later misleading: record detector/version, scope of affected snapshots, the unsupported claim, review decision and correction in an operator quality notice; deploy a new quarantined/fixed release; surface that notice through the later evidence UI; offer an authorized fresh reanalysis with its own job and current access checks. Never update prior evidence or mark a rescan successful before validation. No quality incident or completed calibration is asserted by this run.

Rollback is an application rollback to the prior extraction factory with its matching frozen policy, or quarantine of affected rules. Keep this additive migration applied; destructive downgrade would break artifact reproducibility. This run performs no remote migration, live provider call, model call, billing change or public enablement.

## Verification and human review

Each rule has a positive, plausible false-positive, limitation and semantic mutation fixture. Additional tests cover aliases, CommonJS/ESM, shadowed/mutated imports, neighboring routes, quoted/interpolated SQL, skipped/empty/disconnected/mocked assertions, copied/generated modules, membership forgery, quarantine identity and budgets. A real worker/PGlite test persists all kinds; PostgreSQL verifies concurrent fenced writes, rollback on forged semantics, cancellation and export privacy. The independent process harness measures synthetic bounded workloads and refuses configuration/source execution.

See the [Run 09 handoff](../../feature%20one%20implementation/09-handoff.md) for final measured results and the [human review sample](../benchmarks/run09-human-review.md) for the user's confirmation of all four labels on 2026-09-20. The sample has 4/4 agreement, no disagreements and no uncertain labels. Expected labels were visible, so this is an unblinded convenience-sample review. Broader human precision evaluation and calibration remain pending; the frozen detector definitions and confidence values are unchanged.
