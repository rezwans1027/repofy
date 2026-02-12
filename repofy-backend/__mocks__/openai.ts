import { vi } from "vitest";

const mockCreate = vi.fn();

export const __mockCreate = mockCreate;

export default class OpenAI {
  chat = { completions: { create: mockCreate } };
}
