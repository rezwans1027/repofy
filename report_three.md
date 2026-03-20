# Real Issues Worth Addressing

## #4 — Race condition in concurrent advice requests

- **Severity:** High
- **Location:** `repofy-backend/src/controllers/advice.controller.ts:32-42`
- **Issue:** The in-flight tracking (`activeAdviceRequests` Map) is per-process only. In a horizontally-scaled deployment with multiple replicas, each instance tracks state independently, allowing a user to double-spend credits by hitting different instances simultaneously.
- **Fix:** Migrate to a shared store (e.g. Redis SETNX with TTL) when scaling beyond a single process.

## #13 — Error messages may expose API internals for non-500 errors

- **Severity:** Medium
- **Location:** `repofy-backend/src/middleware/errorHandler.ts:20`
- **Issue:** Non-500 errors return `err.message` directly to the client. While most are controlled validation messages from your own controllers, any middleware or library that sets `err.status < 500` with a sensitive message would leak internals.
- **Fix:** Audit all non-500 error paths to ensure no sensitive details leak, or sanitize all error messages regardless of status code.
