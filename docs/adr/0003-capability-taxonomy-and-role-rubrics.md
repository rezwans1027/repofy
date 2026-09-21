# ADR 0003: Versioned capability definitions and role rubrics

Date: September 14, 2026. Status: accepted for the internal definition foundation; human calibration and external rollout remain pending.

Requirements: ANA-006, ANA-009–012; PRD 7.2–7.3, 9.5–9.7, 16–17. This run defines evidence semantics and discovery. It does not implement extraction, numerical capability aggregation, report generation, pricing, or employability judgments.

## Domain data and compatibility

The initial release is `readiness_1_0_0`, taxonomy `engineering_capabilities@1.0.0`, and five role versions `1.0.0`. The JSON [manifests](../../repofy-backend/src/domain/rubrics/manifests) are the authoring source: 34 definitions in all fourteen PRD categories, 50 weighted requirements, and 15 improvement templates. The backend build includes these JSON files for verification; HTTP discovery reads the database release, never an in-memory fallback.

The contracts package adds `CapabilityManifestDefinitionSchema`, `TaxonomyManifestSchema`, `RoleRequirementManifestSchema`, `RoleRubricManifestSchema`, `RubricCatalogSchema` and `RubricDiscoveryResponseSchema`. Run 01's smaller capability/rubric schemas and existing report payloads remain compatible. These new schemas are additive under contract `1.0.0`; their own `manifestVersion` governs the detailed format.

`requirementId` equals the anchor `capabilityId` used by Run 02's role requirement primary key and report requirement IDs. `capabilityIds` lists every component, including that anchor. For example, `api_design` requires both service contracts and `api_boundary_validation`. This preserves existing relational validation without silently treating the anchor as the whole requirement. `role_requirement_capabilities` records each component with a taxonomy FK, and the complete requirement policy is retained in `role_requirements.definition`.

Language and framework declarations are technology signals, excluded from weighted role components. Provenance signals provide context and uncertainty, without contributing a skill score. Performance is an engineering behavior in the reliability category; it does not add a fifteenth PRD category.

## Strength, confidence and assessability

Strength bands preserve PRD 16.5: `[0,.20)` not observed; `[.20,.40)` limited; `[.40,.65)` moderate; `[.65,.85)` strong; `[.85,1]` very strong. Values are not rounded before choosing a band. Unknown is **Not assessable**, without strength or confidence numbers. A low supported strength in the “not observed” band is a presentation band; Run 01's `not_observed` state still requires an explicit coverage basis.

Dependency/configuration presence is capped at `.39`, and cannot satisfy a role component. Only code, tests or exercised CI can supply an implementation basis. A configuration file can be described as a limited configuration observation. A declared Express dependency cannot support an API-validation claim.

Confidence policy `1.0.0` independently labels observation trust:

- High needs benchmark-validated detectors, complete relevant coverage, direct semantic relevance, independent corroboration and bounded provenance.
- Moderate needs at least fixture-validated detectors, complete coverage and direct relevance. Uncertain provenance or missing independent corroboration prevents high confidence.
- Partial coverage, indirect relevance or unvalidated detectors caps confidence at low. Unsupported coverage is unknown.

No numerical confidence calibration is invented here. Run 11 must define the mapping to existing numeric report fields and include it in its versioned aggregation policy. Human agreement on a **role rubric** is a separate question from reliability of an **observation**; none of these labels bypasses the uncalibrated-rubric gate.

Each required component starts at strength `.55`, moderate confidence, one implementation cluster and one independent test/CI corroboration cluster. Optional requirements start at `.40`, low confidence and one implementation cluster. “Required” identifies gaps that must be displayed; it is not an employment pass/fail gate. These thresholds are hypotheses, with `.55` informed by the PRD's illustrative requirement. Strong minimum thresholds of `.65` or greater always require independent tests or exercised CI.

All current combination rules use **all** components, minimum strength and minimum confidence. Evidence in the same cluster cannot be its own corroboration. Repeated test copies cannot increase independent cluster counts. Any missing/unknown component makes the requirement unknown; a fully assessed unsupported component makes it unmet. The [reference evaluator](../../repofy-backend/src/domain/rubrics/policy.ts) verifies these semantics on normalized synthetic inputs. Run 11 still owns actual clustering, detector validation, semantic matching, provenance modifiers and aggregation; caller-supplied high strength is not proof.

Every role retains all requirement weights in its denominator. Later role coverage is satisfied weight divided by total weight; unknown weight must also be displayed separately and is never removed to inflate the percentage. An entirely unknown role has no score. Partial/unmet strengths can be displayed per requirement but must not silently become fully satisfied coverage. Coverage is evidence coverage, not the probability of being hired.

## Weight rationale

All roles sum to 100%. Only the backend starting values are directly attributed to PRD 17.2. The other four rows and all required/optional choices are draft hypotheses; there has been no human validation. A component may participate in more than one requirement, but evidence is deduplicated within each assessment; Run 11 must disclose correlations rather than imply independent proof across overlapping requirements.

| Role | Weights and rationale |
|---|---|
| Backend | API 15, data 15, reliability 13, testing 12, security 10, architecture 10, delivery 8, observability 7, performance 5, documentation 5. Exact PRD starting weights. |
| Frontend | Interaction 20, client state 15, accessibility 12, testing 12, architecture 10, security/privacy 8, resource bounds 8, delivery 5, diagnostics 5, documentation 5. Emphasizes observable user flows, accessible controls and consistency. |
| Full-Stack | Frontend 15, API 15, data 13, cross-layer integration 12, testing 12, security 10, reliability 10, delivery 5, observability 4, documentation 4. Reserves explicit weight for contracts between client, service and persistence. |
| Mobile | Lifecycle 16, navigation 14, offline recovery 14, accessible interactions 10, testing 12, security/privacy 10, device resource bounds 8, architecture 6, delivery 5, documentation 5. Prioritizes interruption and device constraints; these behaviors currently lack detector coverage. |
| AI Application | Model integration 18, grounded context 15, evaluation 15, safety/privacy 12, recovery 10, data integrity 8, tests 8, diagnostics 6, delivery 4, documentation 4. Prioritizes measurable model behavior and boundaries over SDK presence. |

Each JSON requirement records its exact required flag. Mobile's TypeScript syntax support must not be interpreted as React Native lifecycle support; Swift, Kotlin and Dart have no promised semantic detectors. TypeScript/JavaScript and the listed web/config ecosystems are **planned** deep support, Python/Java planned baseline, and other languages inventory only. Every capability is currently marked `pending`; all five roles are `definitions_only`, `uncalibrated`, and `externalRollout: false`.

## Improvements and claims

Every definition provides behaviors, positive and weak evidence, limitations, source families, allowed claim scopes, forbidden claims and improvement references. Templates call for useful project behavior and verifiable acceptance evidence, such as invalid requests leaving persisted state unchanged. Effort is small/medium/large/unknown, without unsupported time estimates. The coverage-review template applies to not-assessable gaps and asks for coverage clarification, not a rewrite or technology addition. Run 12/13 must bind templates to actual gaps, roles and permitted locations and validate every generated claim.

The [benchmark review protocol](../benchmarks/rubric-calibration.md) records representative judgments and the human review gate. No agreement or reviewer approval is claimed. Schema tests cover readable plain-text labels at their supported lengths; UI layout and assistive-technology verification remain Run 13 work.

## Immutable publication and discovery

Root migration `20260913000400_rubric_registry.sql` adds the registry, immutable component membership, a private importer and active-pointer operation. `20260913000500_initial_rubrics.sql` contains the validated initial seed. `npm run rubrics:validate` checks schema semantics and exact seed parity in CI. `rubrics:seed:generate` writes only a local SQL artifact; it does not connect to a database. Do not regenerate or edit a seed after it has been applied to a deployment. Future releases need new manifest files and new migrations.

Importer and activation functions are available only to the migration owner. Runtime service-role access is restricted to the read RPC; anon/authenticated roles cannot read registry tables or invoke either mutation. An import locks the version registry for its transaction, checks complete version references and normalized weights, and rejects conflicting existing versions. Exact repeated imports do nothing, including leaving the active pointer alone. New identities start at `1.0.0`; forward versions increment one patch, or one minor with patch reset to zero. Skips, prereleases, regressions and new major versions require an explicit adapter/migration and fail in this importer. Reusing an unchanged published taxonomy or role version is permitted. Full contract validation precedes seed generation; SQL independently enforces reference, weight, policy and immutability invariants.

Activating a release changes one pointer covering a compatible taxonomy and all five roles. New analyses must atomically obtain that release and pin its taxonomy/role references through Run 02's `createRun`; they must not re-read “active” during retries. Switching active versions never rewrites previous definitions or reports. Historical releases remain addressable. Rollback changes the pointer back to an already imported release while retaining newer versions for existing reports.

Authenticated `GET /api/v1/role-rubrics` discovers the active release; `GET /api/v1/role-rubrics/:releaseId` reads an immutable release. The frontend's API base already contains `/api`, so consumers request `/v1/role-rubrics`. Both responses use `{ success: true, data: RubricDiscoveryResponse }`, are private/no-store, and require the master Feature 1 flag. Disabled discovery does no auth/provider/database work. An unseeded registry gives a safe unavailable result, missing historical IDs return 404, and provider/validation failures return safe v1 errors. No mutation route exists. The main readiness availability remains `not_implemented` even with the master flag enabled.

No remote database, provider account, deployment flag or worker was changed. No candidate data is needed to validate or publish these definitions. Safe operation records can identify release ID, taxonomy version and role versions only.
