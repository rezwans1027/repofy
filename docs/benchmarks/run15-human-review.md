# Run 15 — Provenance and fairness review

Status: reviewed by the user; agreement with A–E recorded September 20, 2026. These synthetic examples test interpretation boundaries,
not calibrated authorship probabilities. Policy: `provenance_context@1.0.0`, used by
future `evidence_aggregation@1.1.0` analyses. Capability strength/confidence have no
provenance multiplier; contribution confidence remains unknown.

| Example | Facts | Expected interpretation |
| --- | --- | --- |
| A | Provider declares a fork; substantial additional implementation and tests are present. | Fork is repository context. Assess present code normally; neither discount work nor assert that the connected engineer authored it. |
| B | Provider exposes a template origin; files are extensively modified; generated/vendor files also exist. | Template/generated/vendor classification describes origin or file scope. No automatic penalty, definitive authorship claim or AI-generation claim. |
| C | The pinned head is the only visible root commit and the snapshot contains at least 100 files. | A possible bulk initial commit is a bounded heuristic. Importing or squashing can produce this shape; it is not evidence of misconduct or missing skill. |
| D | Some provider-linked commit identities match the verified connected GitHub account, others differ; arbitrary author strings/emails may disagree. | Provider account association is observed; emails/names do not verify identity. Multiple linked identities provide contributor context, not sole responsibility or legal ownership. Contribution confidence remains unknown. |
| E | History is unavailable, not requested, private, incomplete or squashed. | Contribution remains unknown. Absence of visible history does not imply absence of skill, and numeric capability strength/confidence are not reduced. |

Review outcome: 5/5 agreement. This unblinded boundary review supports the neutral
policy; it does not calibrate authorship probabilities or justify numeric penalties.
