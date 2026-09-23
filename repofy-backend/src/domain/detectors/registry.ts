import { IMPLEMENTATION_KINDS, type ImplementationKind } from "@repofy/contracts";
import { initialRubricCatalog } from "../rubrics/catalog";
import { extractionProfile } from "../extraction/policy";

export const DETECTOR_LIMITS = Object.freeze({ files: 256, bytes: 2 * 1024 * 1024, nodes: 100000,
  graphSteps: 200000, resolutionDepth: 12, fileMs: 1000, durationMs: 15000, findingsPerFile: 100, aliasConfigs: 32 });
export const COMMON_LIMITATIONS = Object.freeze([
  "Only explicitly supported static patterns were assessed; no execution, whole-program correctness or candidate proficiency is established.",
  "Confidence and strength are conservative uncalibrated policy values, not measured probabilities. Human precision review is pending.",
  "External package identity follows literal imports; installed versions, runtime patching, middleware order and deployment behavior are unverified.",
]);
interface Definition { capabilities: readonly string[]; ecosystems: readonly string[]; required: string; observation: string; limitation: string; strength?: number }
const definitions: Record<ImplementationKind, Definition> = {
  route_service: { capabilities: ["api_design", "architecture_modularity"], ecosystems: ["express"],
    required: "An Express factory-bound route callback directly calls an included local exported function.",
    observation: "An Express route callback calls a statically resolved local function boundary.", limitation: "Does not establish API stability, complete routing or separation of all responsibilities." },
  request_validation: { capabilities: ["api_boundary_validation", "security_input_handling"], ecosystems: ["express", "zod"],
    required: "The first effect in a route callback parses request input with a local Zod object schema; a later local call consumes that parsed binding.",
    observation: "A route parses request input with a Zod object schema before passing the parsed value to a local function.", limitation: "Only a straight-line parse path is supported; schema completeness, error middleware and other routes are unknown." },
  authentication_guard: { capabilities: ["api_boundary_validation"], ecosystems: ["express"],
    required: "A leading missing-user guard returns a 401 JSON response before a local call consumes that request user.",
    observation: "A route returns a 401 response when its request user is absent before a local call consumes that user.", limitation: "This is an authentication-state guard, not proof of credential verification or resource authorization." },
  ownership_guard: { capabilities: ["security_authorization"], ecosystems: ["express"],
    required: "A direct actor-id versus loaded owner-id inequality guard returns 403 before a local operation consumes that same resource.",
    observation: "A route compares a loaded resource owner with its request actor and returns 403 before a subsequent local resource operation.", limitation: "Does not prove actor authenticity, safe loading, role authorization, race safety or protection of other routes." },
  structured_error: { capabilities: ["api_design"], ecosystems: ["express"],
    required: "A route returns a literal 4xx/5xx status and an object with a literal error code through its response parameter.",
    observation: "A route returns an explicit error status with a structured literal error code.", limitation: "No claim about a universal error contract, safe message content or matching consumer behavior." },
  form_validation: { capabilities: ["frontend_interaction", "security_input_handling"], ecosystems: ["react", "zod"],
    required: "A JSX form is connected to a local submit handler whose parsed React state value feeds a local function.",
    observation: "A form submit handler parses a React state value with a Zod object schema before passing it to a local function.", limitation: "Client validation alone is not a server trust boundary; field-level feedback, submission success and UX are unverified." },
  request_state: { capabilities: ["frontend_interaction"], ecosystems: ["react"],
    required: "A connected action directly sets pending before a try whose first effect awaits fetch, with immediate error and pending-reset setters in catch/finally and rendered state.",
    observation: "A connected UI action wraps a fetch with rendered pending and error state and a finally reset; the action can be invoked again.", limitation: "No stale-response protection, retry policy, server success or complete state-management claim; fetch can resolve on HTTP errors." },
  accessible_action: { capabilities: ["frontend_accessibility"], ecosystems: ["react"], strength: 0.4,
    required: "A native JSX button has static nonempty text and an onClick reference to a local function with work.",
    observation: "A native button has a static text label and is wired to a local action function.", limitation: "This narrow markup observation does not verify computed accessible names, keyboard tests, CSS visibility, focus recovery or accessibility conformance." },
  parameterized_query: { capabilities: ["security_input_handling"], ecosystems: ["pg"],
    required: "An awaited pg Pool/Client query supplies a literal SQL statement with numbered placeholders and a matching nonempty values array.",
    observation: "A pg query separates literal SQL text from an explicit parameter array.", limitation: "Does not establish identifier safety, authorization, successful execution or safety of other queries." },
  transaction: { capabilities: ["data_transactions"], ecosystems: ["prisma"],
    required: "An awaited Prisma interactive transaction contains at least two direct awaited writes using the callback transaction parameter.",
    observation: "A Prisma transaction callback issues multiple awaited writes through its transaction parameter.", limitation: "Does not prove related business invariants, conflict handling, all-write atomicity or rollback behavior under execution." },
  schema_constraint: { capabilities: ["data_modeling"], ecosystems: ["drizzle"], strength: 0.45,
    required: "An exported pgTable declaration has a column using imported column factories with unique() or references() to another included table column.",
    observation: "An ORM table declaration includes an explicit uniqueness or foreign-key relationship constraint.", limitation: "A declared constraint does not prove a migration was applied or that deployed data satisfies it." },
  bounded_retry: { capabilities: ["reliability_recovery", "performance_resources"], ecosystems: ["javascript"],
    required: "A canonical bounded integer for-loop retries a resolved local awaited operation inside try/catch without changing its bound/counter in the body.",
    observation: "A loop with a literal attempt ceiling retries an awaited local operation after a caught failure.", limitation: "Only the loop attempt count is bounded; duration, recursive work, backoff and eventual recovery are unknown." },
  state_guard: { capabilities: ["reliability_concurrency"], ecosystems: ["javascript"], strength: 0.45,
    required: "A function starts with a parameter-state inequality guard that exits with no value, a primitive literal, or an unshadowed Error with literal arguments before a local operation consumes that parameter.",
    observation: "A function exits early for an unexpected input state before a subsequent local operation on that input.", limitation: "Only inert exits and literal Error construction are supported. This local state guard does not establish durable idempotency, atomic compare-and-set or concurrency safety." },
  failure_cleanup: { capabilities: ["reliability_recovery"], ecosystems: ["pg"],
    required: "A client acquired by awaited pg Pool.connect has a reachable direct query in try and an immediate unconditional release as the first effect in finally.",
    observation: "A pg client is released in a finally block surrounding a query on that client.", limitation: "Does not prove all resources are released or that the query or release succeeds." },
  asserted_call: { capabilities: ["testing_behavior"], ecosystems: ["vitest", "@jest/globals"],
    required: "An explicit test import connects a non-skipped callback assertion to the direct result of an included local implementation call.",
    observation: "A test assertion consumes the result of a statically resolved local implementation call.", limitation: "Source assertions are not passing results or coverage measurements; mocks weaken independence and external integration is unverified." },
  bounded_model_output: { capabilities: ["ai_integration"], ecosystems: ["ai", "zod"],
    required: "An awaited ai.generateObject call supplies a Zod object schema, explicit bounded maxRetries and native AbortSignal.timeout.",
    observation: "A structured model call supplies an output schema, an explicit retry ceiling and a timeout signal.", limitation: "SDK enforcement, model availability, output quality, context authorization and prompt-injection defenses are unverified." },
};
export const DETECTORS = Object.freeze(IMPLEMENTATION_KINDS.map(kind => Object.freeze({ kind, id: `tsjs.${kind}`, version: "1.0.4" as const,
  capabilityIds: Object.freeze([...definitions[kind].capabilities]), ecosystems: Object.freeze([...definitions[kind].ecosystems]),
  requiredObservations: definitions[kind].required, observation: definitions[kind].observation, limitation: definitions[kind].limitation,
  forbiddenOverclaims: Object.freeze(["Execution or passing tests from source alone", "System-wide security, correctness or concurrency safety", "Authorship, proficiency or employment suitability"]),
  confidenceBasis: "resolved_static_pattern" as const, strength: definitions[kind].strength ?? 0.55, confidence: 0.55,
  fixtureExpectations: Object.freeze(["positive", "plausible_false_positive", "limitation", "mutation"]), budgets: DETECTOR_LIMITS,
})));
for (const detector of DETECTORS) for (const capability of detector.capabilityIds) {
  if (!initialRubricCatalog.taxonomy.capabilities.some(c => c.capabilityId === capability && c.evidenceFamilies.includes(detector.kind === "asserted_call" ? "test" : "code"))) {
    throw new Error("Invalid detector capability registry");
  }
}
export const CAPABILITY_COVERAGE = Object.freeze(initialRubricCatalog.taxonomy.capabilities.map(c => Object.freeze({ capabilityId: c.capabilityId,
  state: DETECTORS.some(d => d.capabilityIds.includes(c.capabilityId)) ? "partial" : "unsupported",
  detectors: Object.freeze(DETECTORS.filter(d => d.capabilityIds.includes(c.capabilityId)).map(d => d.id)) })));
export function implementationProfile(disabled: readonly ImplementationKind[] = []) {
  if (new Set(disabled).size !== disabled.length || disabled.some(id => !IMPLEMENTATION_KINDS.includes(id))) throw new Error("Invalid detector quarantine");
  const quarantine = Object.freeze(IMPLEMENTATION_KINDS.filter(k => disabled.includes(k)));
  return Object.freeze({ ...extractionProfile(), detectorBundle: { id: "tsjs_implementation", version: `1.0.4${disabled.length ? `-q${IMPLEMENTATION_KINDS.map(k => disabled.includes(k) ? 1 : 0).join("")}` : ""}` },
    coverageManifest: "1.1.1", implementation: Object.freeze({ disabled: quarantine }) });
}
