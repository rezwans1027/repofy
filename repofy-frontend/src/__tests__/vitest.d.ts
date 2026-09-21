import "vitest";

// vitest-axe 0.1 declares the old global Vi namespace; Vitest 4 uses module augmentation.
declare module "vitest" {
  interface Matchers {
    toHaveNoViolations(): void;
  }
}
