export const SECTIONS = [
  { id: "analysis-input", label: "Input", number: 0 },
  { id: "profile-summary", label: "Profile", number: 1 },
  { id: "code-dna", label: "Code DNA", number: 2 },
  { id: "language-fingerprint", label: "Languages", number: 3 },
  { id: "commit-signature", label: "Commits", number: 4 },
  { id: "verdict", label: "Verdict", number: 5 },
  { id: "how-it-works", label: "How", number: 6 },
  { id: "pricing", label: "Pricing", number: 7 },
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
