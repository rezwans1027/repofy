# ADR 0010 — Declared support and achieved coverage

Accepted 2026-09-20 for Run 10 (ANA-004, ANA-006–007, ANA-010 and ANA-014 foundations). Public analysis remains gated by the unfinished aggregation, narrative and release stages.

## Decision

`language_inventory@1.0.0` composes the immutable Run 08 structural extractors, Run 09 `tsjs_implementation@1.0.0` rules and new baseline parsers. Coverage manifest `1.2.0` is recorded in each snapshot alongside its complete declaration and actual processing facts. The existing `AnalyzerCoverage` DTO has an optional `assessment`; old results retain absence, which means unknown. No historical snapshot is relabeled or reanalyzed automatically.

The declaration maps formats, frameworks, extractors, capability scopes, depth, confidence ceilings, limitations and file selection. [The checked-in declaration](../benchmarks/run10-coverage-manifest.json) is a review artifact; the versioned server registry is authoritative. Python/Java/Maven quarantine creates distinct `1.2.0-pXYZ` coverage and `1.0.0-pXYZ` extractor versions. Bits follow Python, Java, Maven order. All eight immutable declarations are seeded by the additive migration. Detector quarantine retains Run 09's independent bundle version and is reflected in achieved limitations.

## Parsers and supported scope

| Scope | Implementation and boundary |
| --- | --- |
| TS, TSX, JS, JSX, MTS, CTS, MJS, CJS | Existing structural syntax and 16 bounded implementation patterns; no whole-program/runtime claim. Successful implementation traversal determines achieved depth. |
| React, Express, Node; selected database/test/model calls | Existing explicitly resolved patterns only. Framework presence and installed-version guesses do not establish support. |
| Next.js | Dependency/configuration inventory and applicable React patterns; server routing, dynamic settings and runtime behavior remain unsupported. |
| JSON, YAML, TOML, SQL, Prisma, Markdown, Dockerfile, GitHub Actions | Existing bounded declaration/structure support. SQL inspection is lexical, CI configuration is not a passing result, and documentation is not implementation proof. |
| Python | `@lezer/python@1.1.19`: module units, imports, functions, classes, decorators, candidate test names and assert statements. Existing PEP 621/735 pyproject and literal requirements declarations remain available. |
| Java | `@lezer/java@1.1.4`: classes/enums/records, interfaces, methods, imports, module declarations, annotation counts and candidate test annotations/assert statements. No symbol resolution or annotation processing. |
| Maven | `@lezer/xml@1.0.6`: one well-formed, unprefixed project element, model 4.0.0, direct literal dependency scopes and module counts. Optional standard Maven namespace is checked. |
| Gradle, setup scripts, unsupported ecosystems | Build scripts are never evaluated. Python setup source can contribute grammar structure, not evaluated dependencies. Other application languages retain inventory and explicit unsupported depth. |
| Native mobile and AI runtime | No lifecycle/navigation/offline, model quality, retrieval, evaluation or runtime-safety assurance. The bounded TS/JS model-call pattern remains independent. |

The shared tree API is pinned to `@lezer/common@1.5.2`; transitive versions are locked. Manifest package keys `lezer_python`, `lezer_java`, and `lezer_xml` identify those npm packages. These editor grammars are selected for bounded in-memory parsing and CommonJS compatibility. They are not compiler/interpreter validators. Recovery/error nodes invalidate that file, including missing/mismatched XML closing tags. Maven namespaces and duplicate attributes are checked separately because grammar success is not full XML/schema validation. Entity/character references, DTDs and CDATA are rejected; no external resolver exists. Parent inheritance, properties, profiles, dependency management, plugins and transitive dependency resolution are explicitly not evaluated.

Using Python's interpreter AST or Java compiler APIs would add language runtimes and process/protocol management without supplying useful bounded declaration evidence beyond this run's scope. Native grammar bindings would add binary deployment requirements. These are implementation tradeoffs, not comparative accuracy measurements. No parser installs or imports repository dependencies, loads project plugins, invokes a compiler/build tool, or runs tests.

Primary references checked during implementation: [Python grammar](https://github.com/lezer-parser/python), [Java grammar](https://github.com/lezer-parser/java), [XML grammar](https://github.com/lezer-parser/xml), [Lezer common](https://www.npmjs.com/package/@lezer/common), [pyproject specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/), and [Maven POM reference](https://maven.apache.org/pom.html). The Python/Java GitHub mirrors announce their move to `code.haverbeke.berlin/lezer`; npm metadata points there. That host and the Lezer reference website returned 403 in this environment, so the pinned packages' grammar sources, types, README and changelogs were inspected locally. No claim of full language-version compatibility is made.

## Budgets, selection and failure

All Run 06 safe-context/security restrictions remain intact. Inventory includes every safe file in deterministic path order; exclusions retain counts without paths or inferred languages. Ingestion limits fail the whole snapshot. No optional reduced-scan product is offered. The picker states the bounded implementation scope before starting.

Parser input is limited to 256 KiB per file, 20,000 syntax nodes and depth 64. Cooperative parser advancement has a one-second deadline. Run 08 retains its 60-second extraction-stage deadline, and the existing supervised worker bounds the entire process. Wall-clock exhaustion fails the stage (`WORKER_EXPIRED`); it never seals a timing-dependent partial snapshot. The blocking process check separately uses a 256 MiB heap and 15-second parent watchdog.

Run 09 retains 256 implementation files, 2 MiB indexed source, 100,000 nodes, bounded resolution/traversal and its existing time limits. Deterministic file/node/byte failures produce explicit outcomes; all inventory denominators survive. Evidence remains bounded to 2,000 observations. Truncation, parser failure/unavailability, disabled parsers, dynamic configuration, unresolved references and partial implementation selection are distinct closed reason codes. Raw exceptions and repository prose never become coverage labels. Parser unavailability is identified as a service issue; unsupported language depth is not described as a transient retry condition.

## Counts and assessment states

The existing structural language ratios continue to mean structural processing of eligible files. They are not silently promoted to implementation completeness. The new all-file ratio is `analyzedFiles / totalFiles`, or null for an empty denominator. `totalFiles = eligibleFiles + excludedFiles`; `eligibleFiles = analyzedFiles + unparsedFiles`. Exclusions are unattributed: their language/capabilities are unknown. Ignoring a difficult file cannot increase the all-file ratio or remove the exclusion limitation.

Achieved language rows retain eligible/processed/unparsed counts and the number of files actually traversed by the implementation pass. Capability rows use their own relevant file families and all candidate application languages, not just the successfully parsed TS/JS subset. A capability's `unparsedFiles` means files not assessed at that capability's supported depth, including unsupported languages. Structural source availability and bounded provider history remain in `coverage.structural.sources` and `.metadata`, including exact-SHA versus historical record counts. The UI displays both.

| State | Meaning |
| --- | --- |
| `assessable` | Declared file scope was assessed and observations exist. It does not establish complete skill or runtime coverage. |
| `partially_assessable` | Useful observations exist within bounded support or incomplete scope. |
| `not_assessable` | No supported assessed input exists for this capability/scope. This is unknown, not a zero skill score. |
| `evidence_not_observed_within_assessed_scope` | Some supported scope was assessed, but no corresponding observation survived. Other scope remains limited or unknown. |

All 34 initial taxonomy capabilities have rows. SQL schema and CI configuration remain useful independently of an unsupported application language. The snapshot result is `insufficient_evidence` when no meaningful structural, implementation or provider observation exists. Empty and unsupported repositories do not acquire fabricated implementation evidence.

Capability observation counts include explicitly bounded structural context where appropriate. They are **not scores or verified capability memberships**. Baseline observations retain empty `capabilityIds`, existing low strengths and a 0.5 confidence ceiling; implementation confidence remains at most 0.55. Both are uncalibrated policy ceilings. Run 11 must use the original evidence, claim boundaries, grouping and independent corroboration; it must not score these counts, treat unsupported requirements as absence, or shrink role denominators to supported requirements.

## Persistence, API and rollback

Snapshot validation recomputes achieved coverage from file outcomes, structural metadata and actual observations. PostgreSQL binds declarations to immutable registry rows and independently checks denominators, language depth, capability observation counts/states, implementation outcomes, known reasons and confidence ceilings during sealing. Existing snapshot/worker authorization, receipt, cancellation, deletion and export fences remain in place.

The authenticated saved-selection policy exposes declared support. Owner job responses optionally expose sealed snapshot coverage through the existing owner-checked read/list RPCs. Responses contain no paths, identifiers, source excerpts or parser diagnostics. Existing private owner query keys, no-store fetches and cache cleanup apply. Shared preview/summary components display textual badges, scope tables, limitations and legacy unknown states and are reusable by Run 13's report UI.

For a defective parser, select a distinct quarantine profile for new jobs, record an operator quality notice with affected versions, and arrange authorized fresh analysis after a fix. Do not mutate pinned jobs, sealed evidence or existing declaration rows. Code/parser changes require a new extractor/coverage version and additive declaration registration. Keep the migration when rolling back application composition. The production extraction factory now returns the Run 10 composition; `productionHandlers` remains null until downstream handlers are complete. This run changes neither billing nor public availability.
