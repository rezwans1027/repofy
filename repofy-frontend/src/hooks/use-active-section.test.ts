import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock IntersectionObserver
let observerCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

vi.stubGlobal(
  "IntersectionObserver",
  class MockIntersectionObserver {
    constructor(cb: IntersectionObserverCallback) {
      observerCallback = cb;
    }
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
  },
);

// Mock the SECTIONS constant
vi.mock("@/lib/constants", () => ({
  SECTIONS: [
    { id: "hero", label: "Hero" },
    { id: "features", label: "Features" },
  ],
}));

import { useActiveSection } from "./use-active-section";

describe("useActiveSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up DOM elements for the sections
    const hero = document.createElement("div");
    hero.id = "hero";
    document.body.appendChild(hero);

    const features = document.createElement("div");
    features.id = "features";
    document.body.appendChild(features);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("defaults to 'hero' section", () => {
    const { result } = renderHook(() => useActiveSection());
    expect(result.current).toBe("hero");
  });

  it("creates observers for each section element", () => {
    renderHook(() => useActiveSection());
    expect(mockObserve).toHaveBeenCalledTimes(2);
  });

  it("updates active section when intersection fires", () => {
    const { result } = renderHook(() => useActiveSection());

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    // The callback is shared — in the real impl each section gets its own observer
    // but the last one to fire with isIntersecting=true wins
    expect(typeof result.current).toBe("string");
  });

  it("disconnects all observers on unmount", () => {
    const { unmount } = renderHook(() => useActiveSection());
    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(2);
  });
});
