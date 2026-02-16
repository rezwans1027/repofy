import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, ADVICE_SYSTEM_PROMPT } from "../../../src/lib/prompts";

describe("SYSTEM_PROMPT", () => {
  it("lists 6 radar axes in correct order", () => {
    const axes = [
      "Code Quality",
      "Project Complexity",
      "Technical Breadth",
      "Eng. Practices",
      "Consistency",
      "Collaboration",
    ];
    for (const axis of axes) {
      expect(SYSTEM_PROMPT).toContain(axis);
    }
    // Verify order: each axis appears after the previous one
    let lastIndex = -1;
    for (const axis of axes) {
      const idx = SYSTEM_PROMPT.indexOf(axis);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("includes candidate levels", () => {
    for (const level of ["Junior", "Mid-Level", "Senior", "Staff"]) {
      expect(SYSTEM_PROMPT).toContain(level);
    }
  });

  it("includes recommendation values", () => {
    for (const rec of ["No Hire", "Weak Hire", "Hire", "Strong Hire"]) {
      expect(SYSTEM_PROMPT).toContain(rec);
    }
  });

  it("includes letter grades", () => {
    for (const grade of ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"]) {
      expect(SYSTEM_PROMPT).toContain(`"${grade}"`);
    }
  });

  it("includes red flag severities", () => {
    for (const severity of ["Minor", "Notable", "Concerning"]) {
      expect(SYSTEM_PROMPT).toContain(severity);
    }
  });

  it('requires "valid JSON"', () => {
    expect(SYSTEM_PROMPT).toContain("valid JSON");
  });

  it("requires exact repo names", () => {
    expect(SYSTEM_PROMPT).toContain("exact repo name");
  });
});

describe("ADVICE_SYSTEM_PROMPT", () => {
  it("specifies project ideas count (3-5)", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("3-5");
  });

  it("includes action plan timeframes", () => {
    for (const tf of ["30 days", "60 days", "90 days"]) {
      expect(ADVICE_SYSTEM_PROMPT).toContain(tf);
    }
  });

  it('requires "exactly 3 entries" for action plan', () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("exactly 3 entries");
  });
});
