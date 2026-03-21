import { describe, it, expect } from "vitest";

import { InsufficientCreditsError } from "../../../src/services/advice-persistence.service";

describe("advice-persistence.service", () => {
  describe("InsufficientCreditsError", () => {
    it("has correct name and message properties", () => {
      const err = new InsufficientCreditsError();
      expect(err.name).toBe("InsufficientCreditsError");
      expect(err.message).toBe("Insufficient growth credits");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
