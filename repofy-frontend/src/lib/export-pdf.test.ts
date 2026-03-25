import { describe, it, expect } from "vitest";
import { findPageBreaks, collectSectionBreaks } from "./export-pdf";

describe("findPageBreaks", () => {
  it("returns only [0] when content fits one page", () => {
    const breaks = findPageBreaks(500, 1000, []);
    expect(breaks).toEqual([0]);
  });

  it("breaks at maxSliceHeight when no section breaks available", () => {
    const breaks = findPageBreaks(2500, 1000, []);
    expect(breaks).toEqual([0, 1000, 2000]);
  });

  it("snaps to section breaks when they fall within the page", () => {
    const sectionBreaks = [400, 800, 1200, 1600, 2000];
    const breaks = findPageBreaks(2500, 1000, sectionBreaks);
    // First page: ideal break at 1000, section break at 800 is within 35%-100% range (350-1000)
    // Should snap to 800 or 1000 depending on algorithm (finds largest <= idealBreak and > minY)
    // minY = 0 + 1000 * 0.35 = 350, best break <= 1000 and > 350 = 800
    expect(breaks[0]).toBe(0);
    expect(breaks[1]).toBe(800);
  });

  it("does not create pages shorter than 35% capacity", () => {
    // Section breaks very close to current position
    const sectionBreaks = [100, 200, 900];
    const breaks = findPageBreaks(2000, 1000, sectionBreaks);
    // minY = 0 + 350 = 350. Break at 100 and 200 are < 350, so not used. 900 > 350, so used.
    expect(breaks[1]).toBe(900);
  });

  it("handles exact page-size content", () => {
    const breaks = findPageBreaks(1000, 1000, []);
    expect(breaks).toEqual([0]);
  });

  it("handles content just over one page", () => {
    const breaks = findPageBreaks(1001, 1000, []);
    expect(breaks).toEqual([0, 1000]);
  });

  it("uses ideal break when no section breaks fit", () => {
    // Section breaks all below minY threshold
    const sectionBreaks = [50, 100];
    const breaks = findPageBreaks(2000, 1000, sectionBreaks);
    // minY = 350, no section breaks > 350, so idealBreak (1000) is used
    expect(breaks[1]).toBe(1000);
  });
});

describe("collectSectionBreaks", () => {
  it("collects Y positions of direct children", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 800, height: 2000 }),
    });

    const child1 = document.createElement("div");
    Object.defineProperty(child1, "getBoundingClientRect", {
      value: () => ({ top: 100, left: 0, width: 800, height: 200 }),
    });

    const child2 = document.createElement("div");
    Object.defineProperty(child2, "getBoundingClientRect", {
      value: () => ({ top: 400, left: 0, width: 800, height: 200 }),
    });

    container.appendChild(child1);
    container.appendChild(child2);

    const breaks = collectSectionBreaks(container, 2);
    // child1: (100 - 0) * 2 = 200
    // child2: (400 - 0) * 2 = 800
    expect(breaks).toEqual([200, 800]);
  });

  it("skips children at y=0", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 800, height: 1000 }),
    });

    const child = document.createElement("div");
    Object.defineProperty(child, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 800, height: 200 }),
    });

    container.appendChild(child);

    const breaks = collectSectionBreaks(container, 2);
    expect(breaks).toEqual([]);
  });

  it("collects children from [data-pdf-sections] wrapper", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 800, height: 2000 }),
    });

    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-pdf-sections", "");

    const section = document.createElement("div");
    Object.defineProperty(section, "getBoundingClientRect", {
      value: () => ({ top: 300, left: 0, width: 800, height: 200 }),
    });

    wrapper.appendChild(section);
    container.appendChild(wrapper);

    const breaks = collectSectionBreaks(container, 1);
    expect(breaks).toContain(300);
  });

  it("deduplicates breaks and sorts ascending", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 800, height: 2000 }),
    });

    const child1 = document.createElement("div");
    Object.defineProperty(child1, "getBoundingClientRect", {
      value: () => ({ top: 500, left: 0, width: 800, height: 200 }),
    });

    const child2 = document.createElement("div");
    Object.defineProperty(child2, "getBoundingClientRect", {
      value: () => ({ top: 200, left: 0, width: 800, height: 200 }),
    });

    container.appendChild(child1);
    container.appendChild(child2);

    const breaks = collectSectionBreaks(container, 1);
    // Should be sorted
    expect(breaks).toEqual([200, 500]);
  });
});
