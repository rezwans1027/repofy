# Run 16 — Human claim and role-boundary review

Status: first review complete. On September 20, 2026, the user replied “Agree with all expected labels”: 24/24 C-card agreements and 30/30 R-card agreements, no disagreements or uncertainty. Independent engineering-role review remains pending. Earlier Run 09/11/12/15 approvals are not reused.

The [frozen 24-case corpus](../../repofy-backend/scripts/release/corpus.json) was authored before its first execution. The implementation agent authored both code and reference labels, so this is an unblinded convenience sample, not independent detector or population calibration. See the [frozen reviewed rendering](run16-reviewed-rendering.json) for the 58 generated claims from the execution matching this sample. [Fresh measurements](run16-results.json) are separate: random fixture identities can select a different equally ranked bounded observation, which does not inherit this review. The frozen rendering and source versions are hash-bound to the exact review JSON. The sample below selects one actual major claim per nonempty result plus explicit unknown cases. No live model wrote this text; the real renderer used synthetic permitted choices.

Review each C item as **supported**, **unsupported**, or **uncertain**; use **unknown** for C20/C21. Judge the entire statement against the linked synthetic source, including its limitation. Record disagreements by ID and explain the unsupported part. The target is at least 90% support agreement and below 2% unsupported major claims, with sample size and uncertainty reported. A small observed zero is not proof of a sub-2% population rate.

For R01–R30, judge the expected requirement state, independent confidence and retained unknown weight. These are hypothetical normalized inputs; R19 does not mean native mobile behavior is supported by current detectors. The [existing calibration protocol](rubric-calibration.md) requires two independent engineering reviewers and a third for disagreements. One requester review supplies one boundary review and cannot close independent calibration or validate role weights.

## C01–C24: rendered claims and unknown cases

### C01 — backend_parse (backend, full_stack)

Facts/limit: Straight-line static parsing; runtime requests and schema completeness unknown.

> A route parses request input with a Zod object schema before passing the parsed value to a local function. Only a straight-line parse path is supported; schema completeness, error middleware and other routes are unknown. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C02 — backend_owner (backend, full_stack)

Facts/limit: Loaded-resource comparison only; actor verification and races unknown.

> A route returns an explicit error status with a structured literal error code. No claim about a universal error contract, safe message content or matching consumer behavior. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C03 — backend_auth (backend)

Facts/limit: Request-user guard, not resource authorization.

> A route returns a 401 response when its request user is absent before a local call consumes that user. This is an authentication-state guard, not proof of credential verification or resource authorization. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C04 — frontend_form (frontend, full_stack)

Facts/limit: Client validation; no field recovery, accessibility conformance or server trust claim.

> A form submit handler parses a React state value with a Zod object schema before passing it to a local function. Client validation alone is not a server trust boundary; field-level feedback, submission success and UX are unverified. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C05 — frontend_request (frontend, full_stack)

Facts/limit: HTTP error status and stale-response races remain unchecked.

> A native button has a static text label and is wired to a local action function. This narrow markup observation does not verify computed accessible names, keyboard tests, CSS visibility, focus recovery or accessibility conformance. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C06 — query_parameters (backend)

Facts/limit: Value parameterization is not all-query security or ownership verification.

> A pg query separates literal SQL text from an explicit parameter array. Does not establish identifier safety, authorization, successful execution or safety of other queries. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C07 — transaction_writes (backend, full_stack)

Facts/limit: Two transaction-bound source writes; execution and business invariants unknown.

> A Prisma transaction callback issues multiple awaited writes through its transaction parameter. Does not prove related business invariants, conflict handling, all-write atomicity or rollback behavior under execution. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C08 — schema_declared (backend)

Facts/limit: Declared constraint; no applied migration evidence.

> An ORM table declaration includes an explicit uniqueness or foreign-key relationship constraint. A declared constraint does not prove a migration was applied or that deployed data satisfies it. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C09 — retry_ceiling (backend, ai_application)

Facts/limit: Four attempts do not bound operation duration or establish recovery.

> A loop with a literal attempt ceiling retries an awaited local operation after a caught failure. Only the loop attempt count is bounded; duration, recursive work, backoff and eventual recovery are unknown. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C10 — state_precondition (backend, mobile)

Facts/limit: Local precondition; no durable or concurrent idempotency.

> A function returns early for an unexpected input state before a subsequent local operation on that input. This local state guard does not establish durable idempotency, atomic compare-and-set or concurrency safety. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C11 — client_cleanup (backend)

Facts/limit: Finally release in source; release success and every resource unknown.

> A pg client is released in a finally block surrounding a query on that client. Does not prove all resources are released or that the query or release succeeds. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C12 — linked_assertion (frontend, backend, full_stack)

Facts/limit: Source assertion only, not executed or passing tests.

> A test assertion consumes the result of a statically resolved local implementation call. Source assertions are not passing results or coverage measurements; mocks weaken independence and external integration is unverified. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C13 — model_adapter (ai_application)

Facts/limit: Declared schema/retry/timeout; no model accuracy, retrieval permission or injection-safety claim.

> A structured model call supplies an output schema, an explicit retry ceiling and a timeout signal. SDK enforcement, model availability, output quality, context authorization and prompt-injection defenses are unverified. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C14 — dependency_only (frontend, backend, full_stack, mobile, ai_application)

Facts/limit: Declarations cannot satisfy implementation requirements.

> A dependency declaration was observed. A declaration does not establish usage, working integration or proficiency. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C15 — shadowed_decoys (backend, ai_application)

Facts/limit: Locally named package-like functions are not imported provider operations.

> Parsed source structure was observed. Structure does not establish runtime behavior, correctness or proficiency. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is moderate; proficiency and authorship are unverified.

Expected: **supported**.

### C16 — safe_parse_alternative (backend)

Facts/limit: Valid alternative input-validation shape is outside the bounded parse detector.

> An Express route callback calls a statically resolved local function boundary. Does not establish API stability, complete routing or separation of all responsibilities. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C17 — workspace_layers (frontend, backend, full_stack)

Facts/limit: Layer boundaries, declared schema and CI do not prove end-to-end execution.

> A native button has a static text label and is wired to a local action function. This narrow markup observation does not verify computed accessible names, keyboard tests, CSS visibility, focus recovery or accessibility conformance. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C18 — python_baseline (backend, ai_application)

Facts/limit: Baseline syntax and dependency inventory; production API/AI semantics unassessable.

> A dependency declaration was observed. A declaration does not establish usage, working integration or proficiency. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C19 — java_baseline (backend, mobile)

Facts/limit: Baseline Java syntax is not Android lifecycle or backend framework behavior.

> A dependency declaration was observed. A declaration does not establish usage, working integration or proficiency. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C20 — mobile_native_unknown (mobile)

Facts/limit: Unsupported native mobile semantics stay unknown, not a zero skill score.

> The covered implementation behavior is unassessable; no missing-skill conclusion follows.

Expected: **unknown**.

### C21 — empty_unknown (frontend, backend, full_stack, mobile, ai_application)

Facts/limit: Empty input cannot establish absent personal skills.

> The covered implementation behavior is unassessable; no missing-skill conclusion follows.

Expected: **unknown**.

### C22 — private_sentinels (backend)

Facts/limit: Synthetic private text, credential pattern and ignored-path sentinels must not reach model/projections or execute.

> Documentation structure was observed. Documentation does not establish implemented behavior or operational quality. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C23 — fork_original_work (backend)

Facts/limit: A fork with implementation has context but no authorship attribution or penalty.

> A loop with a literal attempt ceiling retries an awaited local operation after a caught failure. Only the loop attempt count is bounded; duration, recursive work, backoff and eventual recovery are unknown. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

### C24 — template_generated (frontend)

Facts/limit: Template origin and generated/vendor exclusions do not prove personal contribution or misconduct.

> A native button has a static text label and is wired to a local action function. This narrow markup observation does not verify computed accessible names, keyboard tests, CSS visibility, focus recovery or accessibility conformance. Contribution confidence remains unknown under the recorded provenance policy; context signals do not change these capability measurements. Evidence confidence is low; proficiency and authorship are unverified.

Expected: **supported**.

## R01–R30: rubric boundaries

All rubrics and taxonomy are version 1.0.0. These selected required requirements demand at least .55 strength, Moderate confidence, an implementation cluster and independent corroboration. Strong evidence does not override a failed confidence or independence minimum. Unknown components retain their weight in the full denominator.

| ID | Role / requirement | Supplied evidence | Expected state | Weight / contribution |
| --- | --- | --- | --- | --- |
| R01 | frontend / frontend_interaction | Every component has .70 strength, Moderate confidence, one code cluster and one independent test cluster. | satisfied | 0.20 / 0.140; unknown retained 0.00 |
| R02 | frontend / frontend_interaction | Only dependency presence: .20 strength, Low confidence; no implementation or independent behavior proof. | unmet | 0.20 / 0.000; unknown retained 0.00 |
| R03 | frontend / frontend_interaction | The required capability cannot be assessed in the supplied scope. | unknown | 0.20 / 0.000; unknown retained 0.20 |
| R04 | frontend / frontend_interaction | Strength .70/Moderate, but the claimed corroborating test reuses the implementation cluster. | unmet | 0.20 / 0.000; unknown retained 0.00 |
| R05 | frontend / frontend_interaction | Strength .70, independent test present, but confidence remains Low. | unmet | 0.20 / 0.000; unknown retained 0.00 |
| R06 | frontend / testing_behavior | One component has .70/Moderate with independent proof; another required component is unassessable. | unknown | 0.12 / 0.000; unknown retained 0.12 |
| R07 | backend / api_design | Every component has .70 strength, Moderate confidence, one code cluster and one independent test cluster. | satisfied | 0.15 / 0.105; unknown retained 0.00 |
| R08 | backend / api_design | Only dependency presence: .20 strength, Low confidence; no implementation or independent behavior proof. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R09 | backend / api_design | The required capability cannot be assessed in the supplied scope. | unknown | 0.15 / 0.000; unknown retained 0.15 |
| R10 | backend / api_design | Strength .70/Moderate, but the claimed corroborating test reuses the implementation cluster. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R11 | backend / api_design | Strength .70, independent test present, but confidence remains Low. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R12 | backend / api_design | One component has .70/Moderate with independent proof; another required component is unassessable. | unknown | 0.15 / 0.000; unknown retained 0.15 |
| R13 | full_stack / frontend_interaction | Every component has .70 strength, Moderate confidence, one code cluster and one independent test cluster. | satisfied | 0.15 / 0.105; unknown retained 0.00 |
| R14 | full_stack / frontend_interaction | Only dependency presence: .20 strength, Low confidence; no implementation or independent behavior proof. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R15 | full_stack / frontend_interaction | The required capability cannot be assessed in the supplied scope. | unknown | 0.15 / 0.000; unknown retained 0.15 |
| R16 | full_stack / frontend_interaction | Strength .70/Moderate, but the claimed corroborating test reuses the implementation cluster. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R17 | full_stack / frontend_interaction | Strength .70, independent test present, but confidence remains Low. | unmet | 0.15 / 0.000; unknown retained 0.00 |
| R18 | full_stack / frontend_interaction | One component has .70/Moderate with independent proof; another required component is unassessable. | unknown | 0.15 / 0.000; unknown retained 0.15 |
| R19 | mobile / mobile_lifecycle | Every component has .70 strength, Moderate confidence, one code cluster and one independent test cluster. | satisfied | 0.16 / 0.112; unknown retained 0.00 |
| R20 | mobile / mobile_lifecycle | Only dependency presence: .20 strength, Low confidence; no implementation or independent behavior proof. | unmet | 0.16 / 0.000; unknown retained 0.00 |
| R21 | mobile / mobile_lifecycle | The required capability cannot be assessed in the supplied scope. | unknown | 0.16 / 0.000; unknown retained 0.16 |
| R22 | mobile / mobile_lifecycle | Strength .70/Moderate, but the claimed corroborating test reuses the implementation cluster. | unmet | 0.16 / 0.000; unknown retained 0.00 |
| R23 | mobile / mobile_lifecycle | Strength .70, independent test present, but confidence remains Low. | unmet | 0.16 / 0.000; unknown retained 0.00 |
| R24 | mobile / mobile_offline | One component has .70/Moderate with independent proof; another required component is unassessable. | unknown | 0.14 / 0.000; unknown retained 0.14 |
| R25 | ai_application / ai_integration | Every component has .70 strength, Moderate confidence, one code cluster and one independent test cluster. | satisfied | 0.18 / 0.126; unknown retained 0.00 |
| R26 | ai_application / ai_integration | Only dependency presence: .20 strength, Low confidence; no implementation or independent behavior proof. | unmet | 0.18 / 0.000; unknown retained 0.00 |
| R27 | ai_application / ai_integration | The required capability cannot be assessed in the supplied scope. | unknown | 0.18 / 0.000; unknown retained 0.18 |
| R28 | ai_application / ai_integration | Strength .70/Moderate, but the claimed corroborating test reuses the implementation cluster. | unmet | 0.18 / 0.000; unknown retained 0.00 |
| R29 | ai_application / ai_integration | Strength .70, independent test present, but confidence remains Low. | unmet | 0.18 / 0.000; unknown retained 0.00 |
| R30 | ai_application / ai_integration | One component has .70/Moderate with independent proof; another required component is unassessable. | unknown | 0.18 / 0.000; unknown retained 0.18 |

Review usefulness of the associated improvement approach too: add observable project behavior and independent failure-path proof where assessable; seek appropriate coverage/evidence when unknown. Do not interpret a coverage-review recommendation as absent skill. Proposed effort and role weights still need empirical expert review.

## Known evaluation finding

`R16-Q01`: the concise expression-body route callback in `workspace_layers` is not detected as a route/service boundary. Its reference remains positive: 24 true positives, 0 false positives, 1 false negative (96% annotated recall). No label was changed to match the detector. The known omission must remain visible; changing detector behavior requires a new immutable version.

## Review record

The requesting user agreed with every expected label on September 20, 2026. This is one unblinded boundary review, with 22 sampled major claims supported and two explicitly unknown cases. It does not establish engineering expertise across every role or replace the required independent calibration reviewers. Retain each reviewer separately; machine-readable original judgments are in [run16-human-review.json](run16-human-review.json).
