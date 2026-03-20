import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("filters out false, undefined, and null", () => {
    expect(cn("px-4", false && "hidden", undefined, null, "py-2")).toBe(
      "px-4 py-2",
    );
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("resolves partial Tailwind conflicts", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays", () => {
    expect(cn(["px-4", "py-2"], "mt-2")).toBe("px-4 py-2 mt-2");
  });

  it("handles objects (truthy keys included)", () => {
    expect(cn({ "bg-red-500": true, hidden: false, "mt-4": true })).toBe(
      "bg-red-500 mt-4",
    );
  });

  it("returns empty string with no arguments", () => {
    expect(cn()).toBe("");
  });
});
