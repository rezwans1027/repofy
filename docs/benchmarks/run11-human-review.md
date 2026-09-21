# Run 11 calculation review

Status: required sample review complete. These are unblinded, hand-calculated policy examples,
not measurements of detector precision, candidate skill, or rubric calibration.

Policy: `evidence_aggregation@1.0.0`. Scores use six decimal places. Confidence is
separate from strength; current static detectors remain uncalibrated.

| Example | Frozen facts | Expected calculation and interpretation |
| --- | --- | --- |
| A | One dependency declaration has strength .20. It is repeated 100 times and copied into another repository. | Strength stays .20, **Limited evidence**. Presence alone is capped at .39 and cannot satisfy an implementation requirement. Repetition and repository count add nothing. |
| B | An implementation observation has strength .55. A separate, non-mocked test source asserts a call to that exact implementation concept. Coverage is partial with all eligible files processed; reliability and coverage ceilings are .55; contribution is unknown. | Strength = .55 + .10 = **.65, Strong evidence**. Confidence = min(.55, .55 + .05) = **.55, Low** because semantic coverage is partial. Additional tests in the same family add zero. This supports a static implementation and assertion-source observation, **not** a claim that tests passed. Unknown authorship receives no invented numeric score. |
| C | A role has total weight 1.00. Its .05-weight performance requirement is satisfied at strength .55, with the required implementation evidence and Low minimum confidence. All other requirements are not assessable. | Coverage = (.05 × .55) / 1.00 = **.0275 (2.75%)**. Assessable fraction is **.05 (5%)**. Unknown weight is **.95**. The denominator never shrinks to .05; the result is not 55% or 100%. |
| D | A compound requirement needs API design AND boundary validation. API design has .65 strength, but boundary validation is not assessable. | The requirement is **unknown**, with zero coverage contribution and its full weight retained. Its gap describes missing assessment scope; it does not claim the candidate lacks API skills. |

Review request: agree with A–D, or identify the example and disagreement. Record the
reviewer's actual response and time below; do not infer agreement from silence.

## Review record

Recorded 2026-09-20T16:26:13Z. One user reviewer responded:

> Agree with all four calculations and interpretations

A–D: 4 agreements, 0 disagreements, 0 uncertain. No revisions requested.
This convenience sample was unblinded and checks arithmetic/interpretation only.
It does not calibrate detector confidence or validate rubric weights; broader
review and measurement remain Run 16 work.
