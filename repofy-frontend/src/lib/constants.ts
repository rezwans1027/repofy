export const SECTIONS = [
  { id: "hero", label: "Home", number: 0 },
  { id: "features", label: "Features", number: 1 },
  { id: "analysis", label: "Analysis", number: 2 },
  { id: "advisor", label: "Advisor", number: 3 },
  { id: "compare", label: "Compare", number: 4 },
  { id: "how-it-works", label: "How", number: 5 },
  { id: "pricing", label: "Pricing", number: 6 },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export const TYPEWRITER_USERNAMES = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "tj",
  "yyx990803",
  "ThePrimeagen",
];
