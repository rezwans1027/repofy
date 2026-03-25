import { describe, it, expect } from "vitest";
import {
  codeQualityColor,
  testingColor,
  cicdColor,
  verdictColor,
  recommendationStyle,
  verdictBadgeStyle,
  RECOMMENDATION_STYLES,
  SEVERITY_STYLES,
  DIFFICULTY_STYLES,
  PRIORITY_STYLES,
  DEMAND_STYLES,
  TIMELINE_STYLES,
  CONFIDENCE_STYLES,
  LEVEL_STYLES,
} from "./styles";

describe("codeQualityColor", () => {
  it.each([
    ["Excellent", "text-emerald-400"],
    ["Good", "text-cyan"],
    ["Mixed", "text-yellow-400"],
    ["Weak", "text-red-400"],
    ["Unknown", "text-muted-foreground"],
  ])("returns correct class for %s", (grade, expected) => {
    expect(codeQualityColor(grade)).toBe(expected);
  });
});

describe("testingColor", () => {
  it.each([
    ["Strong", "text-emerald-400"],
    ["Some", "text-yellow-400"],
    ["None", "text-red-400"],
    ["Other", "text-muted-foreground"],
  ])("returns correct class for %s", (grade, expected) => {
    expect(testingColor(grade)).toBe(expected);
  });
});

describe("cicdColor", () => {
  it.each([
    ["Present", "text-emerald-400"],
    ["Partial", "text-yellow-400"],
    ["None", "text-red-400"],
    ["Other", "text-muted-foreground"],
  ])("returns correct class for %s", (grade, expected) => {
    expect(cicdColor(grade)).toBe(expected);
  });
});

describe("verdictColor", () => {
  it.each([
    ["Standout", "text-amber-400"],
    ["Strong", "text-emerald-400"],
    ["Solid", "text-cyan"],
    ["Needs Work", "text-orange-400"],
    ["Risky", "text-red-400"],
    ["Other", "text-muted-foreground"],
  ])("returns correct class for %s", (verdict, expected) => {
    expect(verdictColor(verdict)).toBe(expected);
  });
});

describe("verdictBadgeStyle", () => {
  it.each([
    ["Standout", "bg-amber-500/15 text-amber-400 border-amber-500/30"],
    ["Strong", "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"],
    ["Solid", "bg-cyan/15 text-cyan border-cyan/30"],
    ["Needs Work", "bg-orange-500/15 text-orange-400 border-orange-500/30"],
    ["Risky", "bg-red-500/15 text-red-400 border-red-500/30"],
    ["Other", "bg-secondary text-muted-foreground border-border"],
  ])("returns correct badge for %s", (verdict, expected) => {
    expect(verdictBadgeStyle(verdict)).toBe(expected);
  });
});

describe("recommendationStyle", () => {
  it("returns style for known recommendations", () => {
    expect(recommendationStyle("Strong Hire")).toBe(RECOMMENDATION_STYLES["Strong Hire"]);
    expect(recommendationStyle("Hire")).toBe(RECOMMENDATION_STYLES["Hire"]);
    expect(recommendationStyle("Weak Hire")).toBe(RECOMMENDATION_STYLES["Weak Hire"]);
    expect(recommendationStyle("No Hire")).toBe(RECOMMENDATION_STYLES["No Hire"]);
  });

  it("returns fallback for unknown recommendations", () => {
    expect(recommendationStyle("Unknown")).toBe("bg-secondary text-muted-foreground border-border");
  });
});

describe("style constant maps", () => {
  it("SEVERITY_STYLES has expected keys", () => {
    expect(Object.keys(SEVERITY_STYLES)).toEqual(["Minor", "Notable", "Concerning"]);
  });

  it("DIFFICULTY_STYLES has expected keys", () => {
    expect(Object.keys(DIFFICULTY_STYLES)).toEqual(["Beginner", "Intermediate", "Advanced"]);
  });

  it("PRIORITY_STYLES has expected keys", () => {
    expect(Object.keys(PRIORITY_STYLES)).toEqual(["High", "Medium", "Low"]);
  });

  it("DEMAND_STYLES has expected keys", () => {
    expect(Object.keys(DEMAND_STYLES)).toEqual(["High", "Medium", "Growing"]);
  });

  it("TIMELINE_STYLES has expected keys", () => {
    expect(Object.keys(TIMELINE_STYLES)).toEqual(["Now", "Next", "Later"]);
  });

  it("CONFIDENCE_STYLES has expected keys", () => {
    expect(Object.keys(CONFIDENCE_STYLES)).toEqual(["High", "Medium", "Low"]);
  });

  it("LEVEL_STYLES has expected keys", () => {
    expect(Object.keys(LEVEL_STYLES)).toEqual(["Junior", "Mid-Level", "Senior", "Staff"]);
  });
});
