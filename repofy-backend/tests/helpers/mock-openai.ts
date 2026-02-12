import { vi } from "vitest";

/**
 * Retrieve the __mockCreate reference from the mocked openai module.
 * Call this inside beforeEach or individual tests after vi.mock has been set up.
 *
 * The vi.mock("openai") factory must be defined inline in each test file
 * (because vi.mock is hoisted before imports), but this helper avoids
 * duplicating the getMockCreate boilerplate across files.
 */
export async function getMockCreate() {
  const mod = await import("openai");
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}
