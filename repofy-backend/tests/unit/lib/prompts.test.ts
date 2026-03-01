import { describe, it, expect } from "vitest";
import { SCORER_PROMPT, NARRATOR_PROMPT, ADVICE_SYSTEM_PROMPT } from "../../../src/lib/prompts";

describe("SCORER_PROMPT", () => {
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
      expect(SCORER_PROMPT).toContain(axis);
    }
    let lastIndex = -1;
    for (const axis of axes) {
      const idx = SCORER_PROMPT.indexOf(axis);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("includes scoring caps with hasBuildSystem and cap precedence rule", () => {
    expect(SCORER_PROMPT).toContain("SCORING CAPS");
    expect(SCORER_PROMPT).toContain("capped at");
    expect(SCORER_PROMPT).toContain("hasBuildSystem");
    expect(SCORER_PROMPT).toContain("use the LOWEST value");
  });

  it("specifies exact scoring cap values", () => {
    expect(SCORER_PROMPT).toContain("hasTests=false AND hasBuildSystem=false");
    expect(SCORER_PROMPT).toContain("capped at 0.4");
    expect(SCORER_PROMPT).toContain("hasTests=false AND hasBuildSystem=true");
    expect(SCORER_PROMPT).toContain("capped at 0.6");
  });

  it("includes contributor count collaboration floors with override semantics", () => {
    expect(SCORER_PROMPT).toContain("contributorCount >= 50");
    expect(SCORER_PROMPT).toContain("floor of 0.5");
    expect(SCORER_PROMPT).toContain("overrides the 0.3 cap");
    expect(SCORER_PROMPT).toContain("contributorCount >= 500");
    expect(SCORER_PROMPT).toContain("floor of 0.7");
    expect(SCORER_PROMPT).toContain("overrides the 0.5 floor");
  });

  it("includes BUILD SYSTEM CONTEXT block with full build system list", () => {
    expect(SCORER_PROMPT).toContain("BUILD SYSTEM CONTEXT");
    expect(SCORER_PROMPT).toContain("Makefile, CMake, Meson, Gradle, Maven, Autotools");
    expect(SCORER_PROMPT).toContain("Bazel, Zig, or Kbuild");
  });

  it("includes red flag severities", () => {
    for (const severity of ["Minor", "Notable", "Concerning"]) {
      expect(SCORER_PROMPT).toContain(severity);
    }
  });

  it('requires "valid JSON"', () => {
    expect(SCORER_PROMPT).toContain("valid JSON");
  });

  it("requires exact repo names", () => {
    expect(SCORER_PROMPT).toContain("exact repo name");
  });

  it("does NOT ask AI to return overallScore or letter grades", () => {
    expect(SCORER_PROMPT).toContain("Do NOT return overallScore");
    expect(SCORER_PROMPT).not.toContain("LETTER GRADES");
  });

  it("includes enum values for topRepos", () => {
    for (const val of ["Excellent", "Good", "Mixed", "Weak", "Unknown"]) {
      expect(SCORER_PROMPT).toContain(val);
    }
    for (const val of ["Standout", "Strong", "Solid", "Needs Work", "Risky"]) {
      expect(SCORER_PROMPT).toContain(val);
    }
  });

  it("mentions dataQualityWarnings", () => {
    expect(SCORER_PROMPT).toContain("dataQualityWarnings");
  });

  it("requires plain prose for interpretation fields", () => {
    expect(SCORER_PROMPT).toContain("INTERPRETATION FIELDS");
    expect(SCORER_PROMPT).toContain("plain prose");
    expect(SCORER_PROMPT).toContain("1-3 sentences");
  });
});

describe("NARRATOR_PROMPT", () => {
  it("instructs not to alter numeric values", () => {
    expect(NARRATOR_PROMPT).toContain("Do not alter any numeric values");
  });

  it("instructs not to open with score/level/recommendation", () => {
    expect(NARRATOR_PROMPT).toContain("Do NOT open with the score");
  });

  it("mentions LOCKED_LINE", () => {
    expect(NARRATOR_PROMPT).toContain("LOCKED_LINE");
  });

  it("requires plain prose with no markdown", () => {
    expect(NARRATOR_PROMPT).toContain("NO markdown headers");
    expect(NARRATOR_PROMPT).toContain("NO bullet points");
    expect(NARRATOR_PROMPT).toContain("plain prose only");
  });

  it("specifies exactly 3 paragraphs", () => {
    expect(NARRATOR_PROMPT).toContain("exactly 3 paragraphs");
  });
});

describe("ADVICE_SYSTEM_PROMPT (v2)", () => {
  it("contains calibration rules", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("TRAJECTORY CALIBRATION");
    expect(ADVICE_SYSTEM_PROMPT).toContain("repo complexity");
    expect(ADVICE_SYSTEM_PROMPT).toContain("language/domain breadth");
    expect(ADVICE_SYSTEM_PROMPT).toContain("collaboration signals");
    expect(ADVICE_SYSTEM_PROMPT).toContain("engineering practices");
    expect(ADVICE_SYSTEM_PROMPT).toContain("push cadence");
  });

  it("contains sequencing scaffolding", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("Sequence the 3 builds across 12 weeks");
    expect(ADVICE_SYSTEM_PROMPT).toContain("activeBuildTitle");
    expect(ADVICE_SYSTEM_PROMPT).toContain("skill-learning task each week");
    expect(ADVICE_SYSTEM_PROMPT).toContain("connected, progressive plan");
  });

  it("contains anti-misclassification language", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("Do NOT infer level from repo count or follower/star volume alone");
    expect(ADVICE_SYSTEM_PROMPT).toContain("Penalize tutorial-heavy patterns");
    expect(ADVICE_SYSTEM_PROMPT).toContain("estimate with uncertainty");
  });

  it("contains measurable metrics examples", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("BAD:");
    expect(ADVICE_SYSTEM_PROMPT).toContain("GOOD:");
    expect(ADVICE_SYSTEM_PROMPT).toContain("Improve GitHub presence");
    expect(ADVICE_SYSTEM_PROMPT).toContain("3+ merged PRs");
  });

  it("contains estimatedWeeks sum constraint", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("sum across all 3 MUST be <= 12");
  });

  it("specifies exactly 3 builds", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("exactly 3");
  });

  it("specifies exactly 12 weeks", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("exactly 12 weeks");
  });

  it("requires evidence citations", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("Every recommendation MUST cite");
  });

  it("forbids recommending existing skills", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("NEVER recommend languages, frameworks, or tools the developer already uses");
  });
});
