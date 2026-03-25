/** Price in dollars for the 2-credit growth pack. Single source of truth for all UI. */
export const CREDIT_PACK_PRICE = 10;
export const CREDIT_PACK_SIZE = 2;

export const SECTIONS = [
  { id: "hero", label: "Home", number: 0 },
  { id: "features", label: "Features", number: 1 },
  { id: "advisor", label: "Advisor", number: 2 },
  { id: "analysis", label: "Analysis", number: 3 },
  { id: "compare", label: "Compare", number: 4 },
  { id: "how-it-works", label: "How", number: 5 },
  { id: "pricing", label: "Pricing", number: 6 },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/report",
  "/reports",
  "/generate",
  "/compare",
  "/advisor",
  "/pricing",
  "/feedback",
] as const;

export const TYPEWRITER_USERNAMES = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "tj",
  "yyx990803",
  "ThePrimeagen",
];
