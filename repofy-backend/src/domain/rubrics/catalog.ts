import { RubricCatalogSchema } from "@repofy/contracts";
import taxonomy from "./manifests/taxonomy.v1.json";
import backend from "./manifests/backend.v1.json";
import frontend from "./manifests/frontend.v1.json";
import fullStack from "./manifests/full_stack.v1.json";
import mobile from "./manifests/mobile.v1.json";
import aiApplication from "./manifests/ai_application.v1.json";

/** Build/fixture input only. Request handlers read the database's active release. */
export const initialRubricCatalog = RubricCatalogSchema.parse({
  contractVersion: "1.0.0", manifestVersion: "1.0.0", releaseId: "readiness_1_0_0",
  taxonomy, rubrics: [backend, frontend, fullStack, mobile, aiApplication],
});
