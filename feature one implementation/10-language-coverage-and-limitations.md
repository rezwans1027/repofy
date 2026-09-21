# Run 10 — Language coverage and honest limitations

**Status:** Complete for the scoped implementation and verification on 2026-09-20. See [Run 10 handoff](10-handoff.md) and [ADR 0010](../docs/adr/0010-language-coverage.md). Public analysis remains gated by downstream handlers and release validation. **Depends on:** Runs 08–09. **Requirements:** ANA-004, ANA-006–007, ANA-010, ANA-014 foundations; PRD sections 7.2, 9.6, 18.5, and 29.3.

## Outcome and scope

Support the PRD's deep TS/JS ecosystem, baseline Python/Java evidence, and explicit reduced-confidence states for other ecosystems. Every analysis records the coverage actually achieved, including exclusions, parser failures, and unsupported capability categories.

Baseline support means useful inventory, dependency/config/test/documentation/history evidence and selected source observations. It does not mean parity with TS/JS semantics or unsupported proof of runtime behavior.

## Read first

Read PRD section 7.2, Run 03 taxonomy, Run 08 coverage counters, and Run 09 detector registry. Review the proposed report/unknown-state schemas from Run 01 before adding another incompatible coverage representation.

## Implementation sequence

1. Create a versioned analyzer-coverage manifest mapping language/framework/file type to supported extractors, supported capabilities, semantic depth, confidence constraints, and known limitations. Record both declared capability and achieved execution outcomes for each snapshot.
2. Verify the deep-support inventory covers TS/JS/JSX/TSX, JSON, YAML, SQL, Markdown, Dockerfiles, GitHub Actions, React, Next.js, Node.js, Express, and selected common tests/database/config patterns. Unsupported versions or dynamic configuration must not inherit a blanket deep-support label.
3. Add baseline Python parsing for project structure, supported dependency manifests, module/function/class structure where safe, test discovery, configuration, documentation, and selected source observations. Do not import modules, evaluate setup scripts, install packages, or run tests.
4. Add baseline Java parsing for source/module structure, supported build/dependency manifests, test discovery, annotations/configuration, documentation, and selected source observations. Do not run build tools, annotation processors, compiler plugins, or code generation.
5. Define safe parser failure and budget behavior consistently across languages. Reuse Run 06's scanned context and security restrictions. Version new parser dependencies and document primary sources during implementation.
6. Model capability assessability independently from detected programming language. A mixed repository may provide strong SQL schema or CI evidence while its application-language implementation remains shallow. Mobile and AI role requirements must expose unsupported native/runtime areas instead of showing false certainty.
7. Define per-repository and per-capability states: assessable, partially assessable, not assessable, and evidence not observed within assessed scope. Store eligible/analyzed/excluded/unparsed counts, source-type availability, history bounds, and reason codes. Unknown and zero observed evidence are not interchangeable.
8. Handle repository limits and reduced scans explicitly. Freeze selected-file policy and coverage in the run, require an understandable reduced-scan choice if offered, and record reasons for omitted scope. An unsupported/empty repository may return an informative insufficient-evidence result; it must not create an invented verified capability.
9. Extend API/UI components with coverage badges and concise limitation text for the repository picker, progress failures, and later report. Labels are generated from trusted reason codes rather than raw parser exceptions or untrusted repository text.
10. Create fixture coverage matrices and baseline expectations for every supported language tier. Feed achieved coverage into Run 11 so missing analyzer support cannot inflate or unfairly collapse role results.

## Data and API impact

Store coverage manifest version, parser/detector outcomes, and coverage reasons on snapshots/extraction runs as defined in Run 02. Report DTOs expose understandable scope summaries and capability assessability, not all internal file paths.

Add stable errors/reasons for unsupported depth, no eligible source, parse-budget exhaustion, metadata unavailable, and reduced scan. Distinguish retryable infrastructure failure from a currently unsupported language. Do not instruct a user to repeatedly pay for the same unsupported analysis.

## Acceptance criteria

- Python and Java fixtures produce useful baseline observations with appropriate limitations.
- TS/JS deep support is based on a manifest and actual successful execution, not a hardcoded language badge alone.
- Unknown-language files do not generate deep semantic claims from filename/dependency guesses.
- Mixed-language results preserve supported evidence while identifying unsupported scope.
- Empty, excluded-only, malformed, and oversized repositories yield honest states and an actionable outcome.
- Every resulting report can explain the analyzer coverage version and what was not assessed.

## Verification

Use Python/Java single-module and multi-module fixtures, mixed-language repositories, malformed syntax, build-script-only projects, unsupported native mobile code, generated code, no meaningful source, and partial scans. Test stale coverage manifests, missing parser workers, and detectors that fail on only some files.

Assert that inaccessible/not-assessable requirements do not become definitive statements of lacking a skill. Verify label accessibility and textual explanations without relying on colors. Compare stored coverage denominators to known fixture counts and ensure excluding difficult files cannot increase claimed analysis completeness.

## Migration, rollout, and handoff

Add coverage fields compatibly and preserve unknown defaults for old in-development runs; do not retroactively claim coverage for a legacy report. Disable a defective parser in a new manifest with explicit limitations. Keep language tiers configurable only through versioned server policy.

Hand off the coverage matrix, baseline fixtures, state definitions, confidence constraints, safe user-facing reasons, and exact denominator inputs. Run 11 owns final role-coverage math; this run supplies the facts it must respect.
