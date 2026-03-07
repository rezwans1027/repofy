/**
 * Sanitise user-controlled strings before they are interpolated into an LLM
 * prompt.  This is a defence-in-depth measure against prompt-injection attacks.
 */

/** ASCII control characters that should never appear in prompt text. */
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

/**
 * Known LLM instruction keywords that an attacker might inject.
 * Matched case-insensitively at the start of a line or after whitespace.
 */
const INSTRUCTION_PATTERN_RE =
  /(?<=^|\s)(SYSTEM|IGNORE|OVERRIDE|FORGET|DISREGARD|BYPASS|ASSISTANT|INSTRUCTION|PROMPT|EXECUTE|ADMIN|SUDO|JAILBREAK|DAN)\b/gi;

const DEFAULT_MAX_LEN = 500;

/**
 * Sanitise a single user-provided field for safe inclusion in a prompt.
 *
 * 1. Returns `"N/A"` for null / undefined / empty-string input.
 * 2. Strips ASCII control characters.
 * 3. Prefixes known LLM instruction keywords with `[user-data]`.
 * 4. Truncates the result to `maxLen` characters.
 */
export function sanitizeForPrompt(
  input: string | null | undefined,
  maxLen: number = DEFAULT_MAX_LEN,
): string {
  if (input == null || input.trim() === "") return "N/A";

  let cleaned = input.replace(CONTROL_CHAR_RE, "");

  cleaned = cleaned.replace(INSTRUCTION_PATTERN_RE, "[user-data] $1");

  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }

  return cleaned;
}

/**
 * Strip control characters only (for code snippets that don't need full
 * instruction-pattern sanitisation).
 */
export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHAR_RE, "");
}
