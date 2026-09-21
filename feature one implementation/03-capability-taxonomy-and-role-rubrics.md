# Run 03 — Capability taxonomy and the five role rubrics

**Status:** Complete for the scoped definition foundation; see [verification and handoff](03-handoff.md). Rubrics remain uncalibrated for external rollout. **Depends on:** Runs 01–02. **Requirements:** ANA-006, ANA-009–012; PRD sections 7.2–7.3, 9.5–9.7, 16, and 17.

## Outcome and scope

Create explicit, versioned definitions of what Repofy measures and how each of the five initial role families uses that evidence. The definitions are domain data that detectors, aggregation, improvements, and the UI share.

Do not create employability probabilities, seniority estimates, job-description parsing, or candidate rankings. Rubrics are initial calibration hypotheses, not validated universal hiring standards.

## Read first

Read the capability groups and Backend Software Engineer weights in [the PRD](../Repofy_PRD_v1.0.md), Run 01 schemas, and Run 02 seed/versioning conventions. Review [the old scoring types](../repofy-backend/src/types/index.ts) only to understand what must not be imported into the new role model.

## Implementation sequence

1. Define stable capability keys, human labels, category, description, observable behaviors, positive evidence, weak evidence, limitations, and allowed claim scopes. Include all fourteen PRD categories: languages/frameworks, frontend, mobile, backend/API, data, architecture, testing, reliability, security, delivery, observability, AI applications, documentation/collaboration, and provenance.
2. Separate technologies from engineering behaviors. Express is a framework signal; API boundary validation is a capability. Each capability identifies possible evidence families and whether dependency/config presence alone is sufficient for a limited observation, never a strong implementation claim.
3. Define the evidence-strength bands from PRD section 16.5 and a separate confidence policy. Represent not-assessable/unknown explicitly. Avoid baking numerical confidence guesses into copy or treating missing detector coverage as zero skill.
4. Create versioned Frontend, Backend, Full-Stack, Mobile, and AI Application Engineer rubrics. Use the PRD's backend weights as the starting values: API 15%, data 15%, reliability 13%, testing 12%, security 10%, architecture 10%, delivery 8%, observability 7%, performance 5%, documentation 5%.
5. Draft corresponding explicit weights and required/optional thresholds for the other four roles. Explain the reasoning and limitations in an ADR and benchmark review notes. Ensure each requirement maps to real taxonomy keys and total weights normalize under the selected coverage policy.
6. Define how multi-capability role requirements combine evidence, so a permissive OR does not accidentally satisfy an entire complex requirement. Document corroboration, minimum strength, and assessability requirements for each rule rather than leaving them to the model.
7. Link common evidence gaps to improvement categories and effort bands. Templates should describe a project behavior and acceptance evidence, such as exercised request-validation failures, rather than adding fashionable packages.
8. Add an immutable seed/import process that inserts versions and marks which versions are active for new analyses. Existing reports retain their rubric/taxonomy references. Do not edit published seed rows in place during a deployment.
9. Expose a read-only, authenticated rubric discovery contract for the repository picker and later role selector. Include availability/coverage limitations so all five roles can exist while shallow language support is described accurately.

## Deliverables and proposed location

Use a domain rubric module or small data package chosen in Run 01, with a machine-readable taxonomy manifest, five rubric manifests, validation script, seed migration/import, and calibration notes. Exact filenames are implementation choices; avoid reorganizing unrelated services.

Each rubric requirement includes a stable key, capability references, weight, required flag, minimum-evidence policy, aggregation rule, and version. Each capability includes allowed explanation boundaries used by Run 12's claim validator.

## Acceptance criteria

- Every role requirement resolves to a capability definition in the recorded taxonomy version.
- All five roles have explicit weights and policies; only the backend starting weights are attributed directly to the PRD.
- Changing the active rubric cannot change an older report's meaning.
- Dependency-only evidence cannot satisfy a strong implementation requirement by definition.
- Framework/language coverage restrictions are visible rather than hidden inside a total score.
- Definitions support useful gaps and improvements without requiring a model to invent what a capability means.

## Verification

Validate missing keys, duplicate keys, negative/NaN weights, zero-total rubrics, invalid thresholds, unsupported version transitions, and repeated seed execution. Use synthetic examples for strong implementation, dependency-only evidence, and not-assessable requirements. These tests verify rubric semantics and consistency; they do not substitute for human calibration.

Arrange a documented human review of representative rubric judgments as part of the benchmark process. If review has not happened, mark the rubric uncalibrated for external rollout rather than claiming agreement. Test readable names and definitions with long labels and accessible text representations.

## Migration, rollout, and handoff

Roll out versioned seeds behind Feature 1 flags. Revert the active version pointer if necessary while retaining previously referenced versions. Record taxonomy/rubric versions in safe telemetry; no candidate data is needed for this run.

Hand off manifests, weight rationale, assessment boundary examples, improvement categories, and an explicit list of capabilities awaiting detector coverage. Run 11 will implement aggregation against these definitions; Run 16 will measure calibration and expose unresolved limitations.
