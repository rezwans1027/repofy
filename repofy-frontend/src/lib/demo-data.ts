export const demoProfile = {
  username: "alexchendev",
  name: "Alex Chen",
  avatarUrl: "",
  bio: "Systems thinker. Open source contributor. Writes Rust for fun.",
  repos: 47,
  stars: 2340,
  followers: 891,
  following: 124,
  contributions: 1847,
  joinedYear: 2018,
};

export const codeDnaAxes = [
  { axis: "Architecture", value: 0.88 },
  { axis: "Testing", value: 0.72 },
  { axis: "Docs", value: 0.65 },
  { axis: "Consistency", value: 0.91 },
  { axis: "Complexity", value: 0.78 },
  { axis: "OSS Impact", value: 0.84 },
];

export const languages = [
  {
    name: "TypeScript",
    color: "#3178C6",
    loc: 124500,
    repos: 18,
    confidence: 0.94,
    percentage: 38,
  },
  {
    name: "Rust",
    color: "#DEA584",
    loc: 87200,
    repos: 12,
    confidence: 0.89,
    percentage: 27,
  },
  {
    name: "Python",
    color: "#3572A5",
    loc: 52300,
    repos: 9,
    confidence: 0.76,
    percentage: 16,
  },
  {
    name: "Go",
    color: "#00ADD8",
    loc: 31800,
    repos: 5,
    confidence: 0.68,
    percentage: 10,
  },
  {
    name: "Shell",
    color: "#89E051",
    loc: 18400,
    repos: 8,
    confidence: 0.52,
    percentage: 6,
  },
  {
    name: "Other",
    color: "#71717A",
    loc: 9800,
    repos: 4,
    confidence: 0.3,
    percentage: 3,
  },
];

export const commitInsights = [
  "Consistent morning committer (9-11 AM UTC)",
  "Prefers atomic commits over bulk pushes",
  'Most common verb: "refactor" (23%)',
  "Weekend activity spikes on OSS repos",
  "Avg 4.2 files per commit",
];

export const commitVerbs = [
  { word: "refactor", weight: 23 },
  { word: "fix", weight: 18 },
  { word: "add", weight: 16 },
  { word: "update", weight: 14 },
  { word: "remove", weight: 9 },
  { word: "improve", weight: 8 },
  { word: "implement", weight: 7 },
  { word: "clean", weight: 5 },
];

// Generate a 7x52 heatmap (7 days x 52 weeks)
export function generateHeatmapData(): number[][] {
  const grid: number[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: number[] = [];
    for (let week = 0; week < 52; week++) {
      // Weighted random: more activity on weekdays, less on weekends
      const isWeekday = day < 5;
      const base = isWeekday ? 0.4 : 0.15;
      const val = Math.random() < base ? 0 : Math.floor(Math.random() * 4) + 1;
      row.push(val);
    }
    grid.push(row);
  }
  return grid;
}

export const verdict = {
  grade: "A-",
  summary:
    "Strong systems-level engineer with excellent code consistency and architectural thinking. Testing coverage could improve, but commit discipline and OSS contributions indicate high reliability. Would thrive in infrastructure, platform, or developer tooling roles.",
  scores: [
    { label: "Code Quality", value: 87 },
    { label: "Collaboration Signal", value: 78 },
    { label: "Growth Trajectory", value: 92 },
  ],
};

export const diffLines = {
  old: [
    { type: "remove" as const, text: "- Read 200 resumes" },
    { type: "remove" as const, text: "- Guess from job titles" },
    { type: "remove" as const, text: '- "5 years of React"' },
    { type: "remove" as const, text: "- Hope for the best" },
  ],
  new: [
    { type: "add" as const, text: "+ Analyze actual code" },
    { type: "add" as const, text: "+ Measure real patterns" },
    { type: "add" as const, text: "+ See commit discipline" },
    { type: "add" as const, text: "+ Hire with confidence" },
  ],
};

export const contributionDensity = [
  { month: "Jan", value: 42 },
  { month: "Feb", value: 38 },
  { month: "Mar", value: 65 },
  { month: "Apr", value: 71 },
  { month: "May", value: 58 },
  { month: "Jun", value: 89 },
  { month: "Jul", value: 76 },
  { month: "Aug", value: 92 },
  { month: "Sep", value: 84 },
  { month: "Oct", value: 67 },
  { month: "Nov", value: 73 },
  { month: "Dec", value: 55 },
];
