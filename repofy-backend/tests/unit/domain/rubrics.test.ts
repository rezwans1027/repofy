import { describe, expect, it } from "vitest";
import { RubricCatalogSchema, RoleRequirementManifestSchema, type RubricCatalog } from "@repofy/contracts";
import { initialRubricCatalog as catalog } from "../../../src/domain/rubrics/catalog";
import { confidenceLabel, evaluateRequirement, strengthBand } from "../../../src/domain/rubrics/policy";

const clone = () => structuredClone(catalog);
const api = catalog.rubrics[0].requirements[0];
const strongInputs = () => api.capabilityIds.map(capabilityId => ({ state: "assessed", capabilityId, strength: 0.8, confidence: "high",
  evidence: [{ clusterId: `${capabilityId}.implementation`, sourceType: "code", basis: "implementation" },
    { clusterId: `${capabilityId}.test`, sourceType: "test", basis: "corroboration" }] }));

describe("versioned rubric definitions", () => {
  it("covers fourteen categories, all five roles and the exact PRD backend starting weights", () => {
    expect(catalog.taxonomy.categories).toHaveLength(14);
    expect(catalog.taxonomy.capabilities).toHaveLength(34);
    expect(catalog.rubrics).toHaveLength(5);
    expect(catalog.rubrics[0].requirements.map(item => item.weight)).toEqual([0.15,0.15,0.13,0.12,0.1,0.1,0.08,0.07,0.05,0.05]);
    for (const rubric of catalog.rubrics) {
      expect(rubric.calibration).toBe("uncalibrated");
      expect(rubric.availability).toMatchObject({ state: "definitions_only", externalRollout: false });
      expect(rubric.requirements.some(item => item.required)).toBe(true);
      expect(rubric.requirements.some(item => !item.required)).toBe(true);
      expect(rubric.coveragePolicy).toMatchObject({ denominator: "all_requirement_weights", unknownRequirements: "retain_weight_report_separately", allUnknown: "unknown_without_score" });
    }
    expect(catalog.rubrics.find(item => item.roleId === "mobile")!.availability.plannedCoverage.some(item =>
      item.languages.includes("react_native") && item.depth === "inventory_only")).toBe(true);
  });

  const invalid: [string, (value: RubricCatalog) => void][] = [
    ["missing capability", value => { value.rubrics[0].requirements[0].capabilityIds.push("absent"); }],
    ["duplicate capability key", value => { value.taxonomy.capabilities.push(value.taxonomy.capabilities[0]); }],
    ["missing category", value => { value.taxonomy.categories.pop(); }],
    ["duplicate category", value => { value.taxonomy.categories[1] = value.taxonomy.categories[0]; }],
    ["duplicate requirement", value => { value.rubrics[0].requirements[1] = value.rubrics[0].requirements[0]; }],
    ["duplicate role", value => { value.rubrics[1] = value.rubrics[0]; }],
    ["missing role", value => { value.rubrics.pop(); }],
    ["negative weight", value => { value.rubrics[0].requirements[0].weight = -1; }],
    ["NaN weight", value => { value.rubrics[0].requirements[0].weight = NaN; }],
    ["infinite weight", value => { value.rubrics[0].requirements[0].weight = Infinity; }],
    ["zero total", value => { value.rubrics[0].requirements.forEach(item => { item.weight = 0; }); }],
    ["incorrect total", value => { value.rubrics[0].requirements[0].weight = 0.9; }],
    ["presence threshold", value => { value.rubrics[0].requirements[0].minimumEvidence = 0.39; }],
    ["out of range threshold", value => { value.rubrics[0].requirements[0].minimumEvidence = 1.1; }],
    ["taxonomy mismatch", value => { value.rubrics[0].taxonomyVersion = "1.0.1"; }],
    ["definition version mismatch", value => { value.taxonomy.capabilities[0].taxonomyVersion = "1.0.1"; }],
    ["requirement version mismatch", value => { value.rubrics[0].requirements[0].version = "1.0.1"; }],
    ["unsupported major", value => { value.taxonomy.version = "2.0.0"; }],
    ["unsupported prerelease", value => { value.taxonomy.version = "1.0.0-draft"; }],
    ["non-anchor requirement key", value => { value.rubrics[0].requirements[0].requirementId = "other"; }],
    ["technology component", value => { value.rubrics[0].requirements[0].capabilityIds.push("framework_presence"); }],
    ["missing improvement template", value => { value.taxonomy.capabilities[0].improvementTemplateIds.push("absent"); }],
    ["duplicate improvement template", value => { value.taxonomy.improvementTemplates.push(value.taxonomy.improvementTemplates[0]); }],
    ["technology behavior claim", value => { value.taxonomy.capabilities[0].allowedClaimScopes[0].scope = "repository_behavior"; }],
    ["missing claim boundary", value => { value.taxonomy.capabilities[0].allowedClaimScopes[0].boundary = ""; }],
    ["false PRD attribution", value => { value.rubrics[1].weightOrigin = "prd_backend_starting_values"; }],
    ["changed weights falsely attributed to PRD", value => { value.rubrics[0].requirements[0].weight = 0.2; value.rubrics[0].requirements[1].weight = 0.1; }],
    ["incorrect band boundary", value => { value.taxonomy.strengthPolicy.bands[0].upperExclusive = 0.3; }],
  ];
  it.each(invalid)("rejects %s", (_name, mutate) => {
    const value = clone(); mutate(value);
    expect(RubricCatalogSchema.safeParse(value).success).toBe(false);
  });

  it("retains readable plain-text names, boundaries and acceptance evidence at supported lengths", () => {
    const value = clone();
    value.rubrics[0].name = "Accessible role definition ".repeat(10).slice(0, 240);
    value.taxonomy.capabilities[0].description = "Meaningful project behavior. ".repeat(80).slice(0, 2000);
    const result = RubricCatalogSchema.parse(value);
    expect(result.rubrics[0].name).toBe(value.rubrics[0].name.trim());
    expect(result.taxonomy.strengthPolicy.bands.every(item => item.label.length > 0)).toBe(true);
    expect(result.taxonomy.improvementTemplates.every(item => item.acceptanceCriteria.length && item.expectedEvidence.length)).toBe(true);
    value.rubrics[0].name = "x".repeat(241);
    expect(RubricCatalogSchema.safeParse(value).success).toBe(false);
  });
});

describe("reference requirement semantics", () => {
  it("satisfies a compound requirement only when all components have implementation and independent proof", () => {
    expect(evaluateRequirement(api, strongInputs())).toMatchObject({ state: "satisfied", strength: 0.8, confidence: "high" });
    const inputs = strongInputs(); inputs[1].strength = 0.2;
    expect(evaluateRequirement(api, inputs)).toMatchObject({ state: "unmet", strength: 0.2 });
    inputs[1].strength = 0.8; inputs[1].confidence = "low";
    expect(evaluateRequirement(api, inputs)).toMatchObject({ state: "unmet", confidence: "low" });
  });
  it("does not count a dependency or configuration as strong behavior despite a supplied high strength", () => {
    for (const sourceType of ["dependency", "config"]) {
      const inputs = strongInputs().map(item => ({ ...item, strength: 1, evidence: [{ clusterId: "presence", sourceType, basis: "presence" }] }));
      expect(evaluateRequirement(api, inputs)).toMatchObject({ state: "unmet", strength: 0.39 });
      inputs[0].evidence[0].basis = "implementation";
      expect(() => evaluateRequirement(api, inputs)).toThrow();
    }
  });
  it("does not count the same implementation cluster as independent corroboration", () => {
    const inputs = strongInputs(); inputs[0].evidence[1].clusterId = inputs[0].evidence[0].clusterId;
    inputs[0].evidence.push(inputs[0].evidence[1]);
    expect(evaluateRequirement(api, inputs)).toMatchObject({ state: "unmet", failures: [{ reasons: ["independent_corroboration_required"] }] });
  });
  it("leaves missing or unsupported components unknown without assigning a score", () => {
    for (const second of [undefined, { state: "unknown", capabilityId: api.capabilityIds[1], reasons: ["unsupported_language"] }]) {
      const result = evaluateRequirement(api, [strongInputs()[0], ...(second ? [second] : [])]);
      expect(result).toEqual({ state: "unknown", unknownCapabilityIds: [api.capabilityIds[1]] });
      expect(result).not.toHaveProperty("strength"); expect(result).not.toHaveProperty("confidence");
    }
    expect(evaluateRequirement(api, api.capabilityIds.map(capabilityId => ({ state: "not_observed", capabilityId, confidence: "high" })))).toMatchObject({ state: "unmet", strength: 0 });
    expect(() => evaluateRequirement(api, [...strongInputs(), strongInputs()[0]])).toThrow();
    expect(() => evaluateRequirement({ ...api, aggregation: { ...api.aggregation, operator: "any" } }, strongInputs())).toThrow();
  });
  it("requires test or CI corroboration for a strong minimum threshold", () => {
    const requirement = structuredClone(api); requirement.minimumEvidence = 0.65;
    expect(evaluateRequirement(requirement, strongInputs()).state).toBe("satisfied");
    requirement.evidencePolicy.minimumCorroboratingClusters = 0;
    expect(RoleRequirementManifestSchema.safeParse(requirement).success).toBe(false);
    requirement.evidencePolicy.minimumCorroboratingClusters = 1; requirement.evidencePolicy.corroboratingFamilies = ["docs"];
    expect(RoleRequirementManifestSchema.safeParse(requirement).success).toBe(false);
  });
  it.each(catalog.rubrics.map(rubric => [rubric.name, rubric] as const))("uses explicit component policies in %s", (_name, rubric) => {
    for (const requirement of rubric.requirements) {
      const inputs = requirement.capabilityIds.map(capabilityId => ({ ...strongInputs()[0], capabilityId }));
      expect(evaluateRequirement(requirement, inputs).state).toBe("satisfied");
      expect(evaluateRequirement(requirement, []).state).toBe("unknown");
    }
  });
});

describe("independent strength and confidence", () => {
  it.each([[0,"not_observed"],[.199,"not_observed"],[.2,"limited"],[.399,"limited"],[.4,"moderate"],
    [.649,"moderate"],[.65,"strong"],[.849,"strong"],[.85,"very_strong"],[1,"very_strong"]] as const)("labels strength %s as %s", (value, key) => {
    expect(strengthBand(catalog.taxonomy.strengthPolicy, { state: "assessed", strength: value }).key).toBe(key);
  });
  it("rejects invalid strengths and gives unknown a text label without a score", () => {
    expect(strengthBand(catalog.taxonomy.strengthPolicy, { state: "unknown" })).toEqual({ key: "unknown", label: "Not assessable" });
    for (const strength of [-1, 1.1, NaN]) expect(() => strengthBand(catalog.taxonomy.strengthPolicy, { state: "assessed", strength })).toThrow();
  });
  it("labels trust from validation, semantic coverage and provenance without numerical guesses", () => {
    const factors = { detectorValidation: "benchmark_validated", coverage: "complete", semanticMatch: "direct", independentCorroboration: true, provenance: "bounded" };
    const label = (overrides: object) => confidenceLabel(catalog.taxonomy.confidencePolicy, { ...factors, ...overrides });
    expect(label({})).toEqual({ state: "assessed", label: "high" });
    for (const changes of [{ detectorValidation: "fixture_validated" }, { independentCorroboration: false }, { provenance: "uncertain" }]) expect(label(changes)).toEqual({ state: "assessed", label: "moderate" });
    for (const changes of [{ detectorValidation: "unvalidated" }, { coverage: "partial" }, { semanticMatch: "indirect" }]) expect(label(changes)).toEqual({ state: "assessed", label: "low" });
    expect(label({ coverage: "unsupported" })).toEqual({ state: "unknown" });
  });
});
