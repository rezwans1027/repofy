import { vi } from "vitest";

/**
 * Retrieve the __mockCreate reference from the mocked openai module.
 *
 * The mock is defined centrally in `__mocks__/openai.ts`. Test files
 * only need `vi.mock("openai")` (no inline factory) and then call
 * this helper to get the mock function for assertions.
 */
export async function getMockCreate() {
  const { __mockCreate } = await import("openai") as any;
  return __mockCreate as ReturnType<typeof vi.fn>;
}
