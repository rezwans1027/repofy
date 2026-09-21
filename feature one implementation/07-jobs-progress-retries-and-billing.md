# Run 07 — Durable jobs, progress, retries, and billing safeguards

**Status:** Complete for the scoped implementation and local verification; see [verification and handoff](07-handoff.md). Production handler completion and live deployment remain gated. **Depends on:** Runs 02, 05–06. **Requirements:** ANA-001–003, CORE-003, ING-007–008; PRD sections 19.4, 21, 23.3, 23.6, and 25.

## Outcome and scope

A selected repository set creates a durable logical analysis job, survives API/worker restarts, and reports safe progress. Concurrent starts, retries, and duplicate deliveries cannot create duplicate final reports or charges.

Stages from Runs 08–12 are integrated as they arrive. Until then, test adapters may drive the state machine, but production must not mark placeholder extraction/synthesis as a completed verified report.

## Read first

- [Advice controller](../repofy-backend/src/controllers/advice.controller.ts), [advice jobs](../repofy-backend/src/services/advice-job.service.ts), [in-memory lock](../repofy-backend/src/lib/distributed-lock.ts), and [credits](../repofy-backend/src/services/credit.service.ts).
- [Credit migrations](../supabase/migrations/005_credit_wallets.sql), [credit concurrency tests](../repofy-backend/tests/integration/credit-concurrent-deduct.test.ts), and [advice polling hook](../repofy-frontend/src/hooks/use-advice-job.ts).
- Run 02 transaction primitives and Run 06 cleanup/cancellation interface.

## Implementation sequence

1. Write a job-processing ADR selecting a durable mechanism. Prefer the existing PostgreSQL foundation unless a queue library materially simplifies operations. Persist job truth in SQL, run a separate worker entry point, and document its startup, shutdown, supervision, and deployment. Preserve existing advice behavior unless a narrow shared extraction is necessary.
2. Implement POST /api/v1/analyses. Authenticate, validate all grants/attestations, enforce flags and entitlements, normalize repository IDs/options, and atomically create the logical job using user+idempotency key and a canonical request hash. A repeated key with the same request returns the same resource; a changed request with that key returns a conflict.
3. Persist resolved repository SHAs before extraction and freeze execution-policy versions. Resolve selections once; retries use the same snapshots. Keep job attempts separate from immutable analysis outputs. At retry, verify continued access without advancing the branch head.
4. Implement atomic worker claiming, renewable leases/heartbeats, and fencing or compare-and-set transition guards. A worker whose lease expired cannot publish, charge, overwrite progress, or delete a replacement worker's active workspace. A process-local lock is not sufficient.
5. Implement queued, acquiring_access, downloading, inventorying, extracting, aggregating, synthesizing, validating, and completed stages with failed/canceled/expired alternatives. Record attempt count and a safe stage error. Retry only configured transient failures with bounded backoff; deterministic validation/security failures enter terminal/manual-review states.
6. Build stage handlers around the safe snapshot context. Persist reusable sanitized stage outputs so interrupted processing can resume or re-fetch the same authorized SHA after temporary files are lost. Missing future handlers are an explicit unavailable/internal state, not silent no-ops.
7. Finalize a validated report, run completion, and the billing settlement decision transactionally or through an idempotent durable settlement workflow. Enforce exactly one final output per intended run. If a model succeeds but persistence fails, retries must not blindly repeat generation or charge again.
8. Decide and document Feature 1 entitlements and the charge/refund policy. Reuse existing credit primitives only after validating their concurrency semantics. Do not silently spend advisor credits or change prices. An internal free rollout can use a zero-cost policy while tests exercise reservations/debits/refunds through an explicit analysis billing adapter.
9. Associate billing effects with a stable logical job/settlement key, never a worker attempt. Define terminal failure refunds, retry eligibility after refund, and reconciliation of partially failed settlement. A refunded attempt cannot later publish a paid result accidentally; any new charge follows the documented retry policy.
10. Implement user-owned job status/list/cancel/retry routes, honest progress, and stable errors. Check authorization before every source-fetch stage and completion, including a grant-revision change during execution. Cancellation/deletion creates durable intent so a stale worker cannot resurrect deleted data.
11. Schedule stale-job recovery, billing reconciliation, and orphan-workspace cleanup independently of incoming requests. A feature flag stopping new work does not disable refund, revocation, or cleanup tasks.
12. Wire Run 05's start action to the API and add a progress screen with polling, reconnect/resume, cancel, and actionable failure states. Keep the submitted idempotency key stable across double-clicks, timeouts, and the API client's auth-refresh replay.

## Cache and multi-repository behavior

Cache identity includes the stable repository/snapshot set, detector/coverage/security/aggregation versions, and appropriate analysis options. Reuse never bypasses user authorization or leaks another user's private report. Preserve ordered display choices separately from canonical sorted identity.

Define failure policy for a mixed repository set: either fail the requested run or explicitly produce a versioned partial result with per-repository exclusions and recalculated coverage limitations. Do not silently omit a failed repository. Freeze the policy in the request/run contract.

## Acceptance criteria

Concurrent identical requests produce one logical job and at most one charge. A restarted worker can finish the same snapshot run; an expired worker cannot finalize it. A successful terminal report remains readable without GitHub/model availability. Cancellation/revocation/deletion stops new retrieval and prevents stale publication. Refund and cleanup workers recover independently of UI traffic. Progress derives from real stages and future unimplemented stages remain gated.

## Verification

Use real PostgreSQL multi-connection/process tests for claim races, expired leases, duplicate completion, and credit settlement. Test crash boundaries after debit/reservation, after model completion, before final commit, and after report persistence but before acknowledgement. PGlite/single-threaded mocks alone cannot establish cross-process guarantees.

Exercise same-key/different-payload conflicts, delayed auth-refresh retries, mixed-repository failures, revoked grants, canceled jobs, account deletion, queue/DB outages, and forced workspace loss. Verify recovery terminates within configured budgets and logs contain only IDs/stages/codes.

## Migration, rollout, and handoff

Add worker lease/attempt/settlement structures and narrowly scoped SQL functions. Deploy schemas first, then worker/API with intake disabled, then internal allowlist. Roll back by stopping new intake, draining/canceling work, and leaving reconciliation/cleanup active; do not discard queued work or ledger history.

Hand off stage interfaces, worker operations guide, job APIs, billing policy, fencing invariants, integration tests, and a handler-completeness checklist. Runs 08–12 must plug into this state machine rather than create parallel background loops.
