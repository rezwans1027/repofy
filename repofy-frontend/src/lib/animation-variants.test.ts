import { describe, it, expect } from "vitest";
import {
  EASE_OUT_EXPO,
  staggerContainer,
  staggerContainerFast,
  staggerItem,
  staggerItemScale,
  staggerItemLeft,
  staggerItemRight,
  badgePop,
  contentFade,
  borderGrow,
  tabContentVariants,
} from "./animation-variants";

describe("animation-variants", () => {
  it("EASE_OUT_EXPO is a valid cubic-bezier tuple", () => {
    expect(EASE_OUT_EXPO).toHaveLength(4);
    EASE_OUT_EXPO.forEach((v) => expect(typeof v).toBe("number"));
  });

  it("stagger containers define hidden and visible states", () => {
    expect(staggerContainer).toHaveProperty("hidden");
    expect(staggerContainer).toHaveProperty("visible");
    expect(staggerContainerFast).toHaveProperty("hidden");
    expect(staggerContainerFast).toHaveProperty("visible");
  });

  it("stagger items start hidden with opacity 0", () => {
    expect(staggerItem.hidden).toMatchObject({ opacity: 0 });
    expect(staggerItemScale.hidden).toMatchObject({ opacity: 0 });
    expect(staggerItemLeft.hidden).toMatchObject({ opacity: 0 });
    expect(staggerItemRight.hidden).toMatchObject({ opacity: 0 });
  });

  it("stagger items animate to opacity 1", () => {
    expect(staggerItem.visible).toMatchObject({ opacity: 1 });
    expect(staggerItemScale.visible).toMatchObject({ opacity: 1, scale: 1 });
    expect(staggerItemLeft.visible).toMatchObject({ opacity: 1, x: 0 });
    expect(staggerItemRight.visible).toMatchObject({ opacity: 1, x: 0 });
  });

  it("badgePop and contentFade have expected structure", () => {
    expect(badgePop.hidden).toMatchObject({ opacity: 0 });
    expect(badgePop.visible).toMatchObject({ opacity: 1 });
    expect(contentFade.hidden).toMatchObject({ opacity: 0 });
    expect(contentFade.visible).toMatchObject({ opacity: 1 });
  });

  it("borderGrow animates height", () => {
    expect(borderGrow.hidden).toMatchObject({ height: 0 });
    expect(borderGrow.visible).toMatchObject({ height: "100%" });
  });

  describe("tabContentVariants", () => {
    const enter = tabContentVariants.enter as (dir: number | null) => { x: number; opacity: number };
    const exit = tabContentVariants.exit as (dir: number | null) => { x: number; opacity: number };

    it("enter slides from right for positive direction", () => {
      expect(enter(1)).toMatchObject({ x: 30, opacity: 0 });
    });

    it("enter slides from left for negative direction", () => {
      expect(enter(-1)).toMatchObject({ x: -30, opacity: 0 });
    });

    it("enter has no slide for null direction", () => {
      expect(enter(null)).toMatchObject({ x: 0, opacity: 0 });
    });

    it("exit slides left for positive direction", () => {
      expect(exit(1)).toMatchObject({ x: -30, opacity: 0 });
    });

    it("exit slides right for null direction", () => {
      expect(exit(null)).toMatchObject({ x: 30, opacity: 0 });
    });

    it("center state is visible and centered", () => {
      expect(tabContentVariants.center).toMatchObject({ x: 0, opacity: 1 });
    });
  });
});
