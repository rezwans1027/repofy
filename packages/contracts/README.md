# @repofy/contracts

Shared Zod runtime schemas and inferred TypeScript types for Feature 1. Contract version: `1.0.0`. These contracts do not implement fetching, analysis, persistence or model calls.

From the repository root:

```bash
npm --prefix packages/contracts ci
npm --prefix packages/contracts test
npm --prefix repofy-backend ci
npm --prefix repofy-frontend ci
```

`npm test` builds contracts and runs fixtures. Applications install compiled copies with `install-links=true`; rebuild and reinstall after edits. Both CommonJS and bundler consumers import the actual npm package, with no source alias. Do not commit generated `dist` files.

```ts
import { StartAnalysisRequestSchema, type ReadinessReportResponse } from "@repofy/contracts";
import { InternalEvidenceObservationSchema, type ReadinessDomainValidator } from "@repofy/contracts/internal";
```

The main entry point exposes owner response/request contracts. `/internal` contains ephemeral internal locators and the domain-validation interface. `/testing` contains synthetic fixtures exclusively for tests. Database membership, authorization, semantic claim support and redaction require a domain validator in addition to schema parsing.

Run 03 adds detailed versioned definitions in `rubrics.ts`: `TaxonomyManifestSchema`, `RoleRequirementManifestSchema`, `RoleRubricManifestSchema`, `RubricCatalogSchema` and `RubricDiscoveryResponseSchema`. They include compound capability requirements, strength/confidence policies, explicit unknown handling, pending coverage, claim boundaries and improvements. The original smaller `CapabilityDefinitionSchema`, `RubricRequirementSchema` and `RoleRubricSchema` remain unchanged; detailed consumers must use the new manifest schemas. Validate full catalogs to enforce cross-references and all five roles. See [ADR 0003](../../docs/adr/0003-capability-taxonomy-and-role-rubrics.md).

See [ADR 0001](../../docs/adr/0001-evidence-foundation.md) and the [Run 01 handoff](../../feature%20one%20implementation/01-handoff.md) for exported interfaces, idempotency, version dependencies, privacy, rollout and deployment instructions.
