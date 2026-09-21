# Run 12 statement-boundary review

Status: reviewed on 2026-09-20. The user agreed with all four expected labels and interpretations in this implementation session. Agreement: 4/4. These development cases are separate from Run 16's held-out benchmark and do not measure held-out precision.

The model selects statement IDs and presentation order; it cannot supply new prose. Both approved orders retain the limitation and confidence label. Each rejected example below cites the **same valid evidence ID** as its supported counterpart.

| Case | Evidence | Proposed claim | Expected label |
| --- | --- | --- | --- |
| A | A literal bounded retry loop around an awaited local operation; linked assertion source, without a passing test run | “The service reliably recovers from failures within a fixed duration.” | Unsupported: attempt count is bounded, but duration and recovery success are unknown. |
| B | The same retry evidence | “A loop with a literal attempt ceiling retries an awaited local operation after a caught failure. Only the loop attempt count is bounded; duration, recursive work, backoff and eventual recovery are unknown. A linked test assertion is present in source; passing execution is unverified.” | Supported within the static observation boundary. |
| C | A dependency declaration for Express | “The developer has implemented production-ready Express services.” | Unsupported: declaration does not establish usage, proficiency, ownership or production quality. |
| D | A capability has no assessable detector coverage | “This capability is not assessable in the selected snapshots. No conclusion about missing skill or implementation follows.” | Supported as an uncertainty statement; it is not a verified positive capability claim. |

Implementation fixtures reject A/C and preserve B/D. Human assessment is requested to check the boundaries and interpretation, not to authorize sending repository data to a provider.
