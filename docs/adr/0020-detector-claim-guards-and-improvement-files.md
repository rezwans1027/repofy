# Detector claim guards and permission-checked improvement files

Date: 2026-09-26

Status: Accepted

The Feature 1 branch review found two static claims that could survive broken
source behavior: form controls in dead or incompatible render branches, and a
literal action allowlist that was subsequently mutated or escaped to other code.
Improvement plans also lacked direct references to relevant existing files.

New analyses pin detector bundle `tsjs_implementation` `2.0.1`. A labelled form
requires reachable controls on a common render path, through intrinsic JSX or
fragments. Syntax inside callbacks, props, custom components, nested forms or
incompatible conditional branches is insufficient proof. A model action allowlist
must be an inline literal or a local const alias graph used only for direct
`includes` reads. Mutations, exports, unknown calls and other escapes disqualify
that observation. These conservative rules may omit valid but unsupported source
patterns; they do not establish runtime correctness or calibrated confidence.

Detector `2.0.0` remains supported for previously pinned jobs and saved reports.
The additive migration registers `2.0.1` and independently checks snapshot seals
against their pinned registry. Coverage declaration `1.3.0`, aggregation policies
`3.0.0` / `3.1.0`, weights and confidence thresholds are unchanged: this correction
changes which observations qualify, not their declared scope or arithmetic.
Rescans across detector revisions retain the existing version comparability rules.

The report reader adds an optional `improvementEvidence` projection containing
only evidence IDs. References require a limited-evidence gap, matching capability
support and a relevant repository in the saved report; provider metadata and
unknown or unobserved gaps do not yield file targets. Older responses may omit
the projection. Its membership is validated by the shared response contract.
Immutable report content, model input and stored report locations do not change.

The UI presents these as relevant existing files, not verified edit instructions.
Inspecting a file uses the existing owner-scoped location endpoint, including
live GitHub identity/access checks and grant-revision revalidation before
decryption. Private locations have no outbound URL. Locations remain local
component state and clear on blur or visibility change; late responses and
mismatched evidence identities are discarded. Ordinary reads never decrypt
paths or call a provider.

Validation includes source counterexamples through rendered reports, positive
role qualification, old/new detector snapshot sealing with mixed-version
rejection, private/revoked/foreign evidence handling, and the browser flow from an
improvement plan through the live location endpoint. Historical calibration and
release artifacts are retained; these fixes do not constitute human calibration
or deployment approval.
