import { describe, it, expect } from "vitest";
import {
  demoProfile,
  codeDnaAxes,
  languages,
  commitInsights,
  commitVerbs,
  generateHeatmapData,
  verdict,
  diffLines,
  contributionDensity,
  reportData,
} from "./demo-data";

describe("demo-data exports", () => {
  it("demoProfile has required fields", () => {
    expect(demoProfile.username).toBe("alexchendev");
    expect(typeof demoProfile.repos).toBe("number");
    expect(typeof demoProfile.stars).toBe("number");
  });

  it("codeDnaAxes has 6 axes with values between 0 and 1", () => {
    expect(codeDnaAxes).toHaveLength(6);
    codeDnaAxes.forEach(({ value }) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });

  it("languages have positive percentages that sum to 100", () => {
    const total = languages.reduce((s, l) => s + l.percentage, 0);
    expect(total).toBe(100);
    languages.forEach((l) => expect(l.percentage).toBeGreaterThan(0));
  });

  it("commitInsights is a non-empty array of strings", () => {
    expect(commitInsights.length).toBeGreaterThan(0);
    commitInsights.forEach((s) => expect(typeof s).toBe("string"));
  });

  it("commitVerbs have positive weights", () => {
    commitVerbs.forEach((v) => expect(v.weight).toBeGreaterThan(0));
  });

  it("verdict has valid score structure", () => {
    expect(verdict.grade).toBe("A-");
    expect(verdict.scores).toHaveLength(3);
    verdict.scores.forEach(({ value }) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  it("diffLines has old and new entries", () => {
    expect(diffLines.old.length).toBeGreaterThan(0);
    expect(diffLines.new.length).toBeGreaterThan(0);
    diffLines.old.forEach((l) => expect(l.type).toBe("remove"));
    diffLines.new.forEach((l) => expect(l.type).toBe("add"));
  });

  it("contributionDensity covers 12 months", () => {
    expect(contributionDensity).toHaveLength(12);
  });

  it("reportData has valid structure", () => {
    expect(reportData.overallScore).toBeGreaterThanOrEqual(0);
    expect(reportData.radarAxes).toHaveLength(6);
    expect(reportData.topRepos.length).toBeGreaterThan(0);
    expect(reportData.strengths.length).toBeGreaterThan(0);
    expect(reportData.weaknesses.length).toBeGreaterThan(0);
    expect(reportData.interviewQuestions.length).toBeGreaterThan(0);
  });
});

describe("generateHeatmapData", () => {
  it("returns a 7x52 grid", () => {
    const grid = generateHeatmapData();
    expect(grid).toHaveLength(7);
    grid.forEach((row) => expect(row).toHaveLength(52));
  });

  it("all values are between 0 and 4", () => {
    const grid = generateHeatmapData();
    grid.forEach((row) =>
      row.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(4);
      }),
    );
  });

  it("all values are integers", () => {
    const grid = generateHeatmapData();
    grid.forEach((row) =>
      row.forEach((val) => expect(Number.isInteger(val)).toBe(true)),
    );
  });
});
