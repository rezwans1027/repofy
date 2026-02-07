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

// --- Dashboard fake data ---

export interface FakeUser {
  username: string;
  name: string;
  bio: string;
  location: string;
  company: string;
  joinedYear: number;
  repos: number;
  stars: number;
  followers: number;
  contributions: number;
  languages: { name: string; color: string; percentage: number }[];
  prActivity: {
    opened: number;
    merged: number;
    reviewed: number;
  };
  commitStreak: {
    current: number;
    longest: number;
  };
  topCollaborators: {
    username: string;
    initials: string;
    contributions: number;
  }[];
}

export interface FakeRepo {
  name: string;
  description: string;
  language: string;
  languageColor: string;
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
}

export const fakeUsers: FakeUser[] = [
  {
    username: "alexchendev",
    name: "Alex Chen",
    bio: "Systems thinker. Open source contributor. Writes Rust for fun.",
    location: "San Francisco, CA",
    company: "Vercel",
    joinedYear: 2018,
    repos: 47,
    stars: 2340,
    followers: 891,
    contributions: 1847,
    languages: [
      { name: "TypeScript", color: "#3178C6", percentage: 38 },
      { name: "Rust", color: "#DEA584", percentage: 27 },
      { name: "Python", color: "#3572A5", percentage: 16 },
      { name: "Go", color: "#00ADD8", percentage: 10 },
      { name: "Shell", color: "#89E051", percentage: 6 },
      { name: "Other", color: "#71717A", percentage: 3 },
    ],
    prActivity: { opened: 312, merged: 287, reviewed: 194 },
    commitStreak: { current: 23, longest: 67 },
    topCollaborators: [
      { username: "jmiller", initials: "JM", contributions: 47 },
      { username: "linapark", initials: "LP", contributions: 34 },
      { username: "devraj", initials: "DR", contributions: 28 },
      { username: "emmastone", initials: "ES", contributions: 19 },
      { username: "tomwu", initials: "TW", contributions: 15 },
    ],
  },
  {
    username: "saradev42",
    name: "Sara Mitchell",
    bio: "Full-stack engineer. React & Node enthusiast. Building the web.",
    location: "Austin, TX",
    company: "Stripe",
    joinedYear: 2019,
    repos: 34,
    stars: 1520,
    followers: 643,
    contributions: 2103,
    languages: [
      { name: "TypeScript", color: "#3178C6", percentage: 45 },
      { name: "JavaScript", color: "#F7DF1E", percentage: 25 },
      { name: "Python", color: "#3572A5", percentage: 15 },
      { name: "CSS", color: "#563D7C", percentage: 10 },
      { name: "Other", color: "#71717A", percentage: 5 },
    ],
    prActivity: { opened: 245, merged: 231, reviewed: 318 },
    commitStreak: { current: 41, longest: 89 },
    topCollaborators: [
      { username: "markdev", initials: "MD", contributions: 62 },
      { username: "priyanka", initials: "PK", contributions: 41 },
      { username: "cjohnson", initials: "CJ", contributions: 33 },
      { username: "alexchendev", initials: "AC", contributions: 22 },
      { username: "ryanlee", initials: "RL", contributions: 17 },
    ],
  },
  {
    username: "kai-rustlang",
    name: "Kai Nakamura",
    bio: "Performance obsessed. Low-level systems. Compilers & runtimes.",
    location: "Tokyo, Japan",
    company: "Mozilla",
    joinedYear: 2016,
    repos: 62,
    stars: 4210,
    followers: 1340,
    contributions: 3291,
    languages: [
      { name: "Rust", color: "#DEA584", percentage: 42 },
      { name: "C++", color: "#F34B7D", percentage: 22 },
      { name: "C", color: "#555555", percentage: 15 },
      { name: "Python", color: "#3572A5", percentage: 12 },
      { name: "Assembly", color: "#6E4C13", percentage: 5 },
      { name: "Other", color: "#71717A", percentage: 4 },
    ],
    prActivity: { opened: 489, merged: 462, reviewed: 127 },
    commitStreak: { current: 58, longest: 142 },
    topCollaborators: [
      { username: "rustcore", initials: "RC", contributions: 89 },
      { username: "bytehacker", initials: "BH", contributions: 54 },
      { username: "saradev42", initials: "SM", contributions: 38 },
      { username: "lowlevel99", initials: "LL", contributions: 27 },
      { username: "wasmguru", initials: "WG", contributions: 21 },
    ],
  },
];

export const fakeRepos: Record<string, FakeRepo[]> = {
  alexchendev: [
    { name: "rustdb", description: "A lightweight embedded database written in Rust", language: "Rust", languageColor: "#DEA584", stars: 482, forks: 37, updatedAt: "2 days ago", topics: ["database", "rust", "embedded", "storage"] },
    { name: "ts-api-kit", description: "Type-safe API client generator for TypeScript", language: "TypeScript", languageColor: "#3178C6", stars: 318, forks: 52, updatedAt: "1 week ago", topics: ["typescript", "api", "codegen", "openapi"] },
    { name: "dotfiles", description: "My development environment configuration", language: "Shell", languageColor: "#89E051", stars: 124, forks: 18, updatedAt: "3 weeks ago", topics: ["dotfiles", "neovim", "tmux"] },
    { name: "go-cache", description: "High-performance in-memory cache with TTL support", language: "Go", languageColor: "#00ADD8", stars: 267, forks: 29, updatedAt: "1 month ago", topics: ["go", "cache", "performance"] },
    { name: "neural-sketch", description: "Neural network visualization tool", language: "Python", languageColor: "#3572A5", stars: 195, forks: 14, updatedAt: "2 months ago", topics: ["machine-learning", "visualization", "pytorch"] },
    { name: "wasm-playground", description: "WebAssembly experiments and benchmarks", language: "Rust", languageColor: "#DEA584", stars: 156, forks: 11, updatedAt: "3 months ago", topics: ["webassembly", "wasm", "benchmarks"] },
  ],
  saradev42: [
    { name: "react-form-wizard", description: "Multi-step form library with validation and animations", language: "TypeScript", languageColor: "#3178C6", stars: 412, forks: 63, updatedAt: "3 days ago", topics: ["react", "forms", "validation", "ui"] },
    { name: "node-queue", description: "Distributed task queue for Node.js applications", language: "TypeScript", languageColor: "#3178C6", stars: 289, forks: 41, updatedAt: "1 week ago", topics: ["nodejs", "queue", "distributed", "redis"] },
    { name: "css-grid-gen", description: "Visual CSS grid layout generator", language: "JavaScript", languageColor: "#F7DF1E", stars: 197, forks: 28, updatedAt: "2 weeks ago", topics: ["css", "grid", "generator", "tool"] },
    { name: "py-data-pipe", description: "Data pipeline framework with built-in transformers", language: "Python", languageColor: "#3572A5", stars: 164, forks: 19, updatedAt: "1 month ago", topics: ["python", "data-pipeline", "etl"] },
    { name: "design-tokens", description: "Design token system for consistent theming", language: "CSS", languageColor: "#563D7C", stars: 143, forks: 22, updatedAt: "2 months ago", topics: ["design-system", "tokens", "theming"] },
    { name: "blog-engine", description: "Markdown-based static blog engine with RSS", language: "TypeScript", languageColor: "#3178C6", stars: 118, forks: 15, updatedAt: "3 months ago", topics: ["blog", "markdown", "static-site", "rss"] },
  ],
  "kai-rustlang": [
    { name: "tiny-compiler", description: "Educational compiler from scratch targeting x86-64", language: "Rust", languageColor: "#DEA584", stars: 1240, forks: 89, updatedAt: "1 day ago", topics: ["compiler", "x86-64", "education", "rust"] },
    { name: "mem-allocator", description: "Custom memory allocator with arena and pool strategies", language: "C++", languageColor: "#F34B7D", stars: 876, forks: 67, updatedAt: "5 days ago", topics: ["memory", "allocator", "systems", "cpp"] },
    { name: "async-runtime", description: "Minimal async runtime with work-stealing scheduler", language: "Rust", languageColor: "#DEA584", stars: 634, forks: 42, updatedAt: "2 weeks ago", topics: ["async", "runtime", "concurrency", "rust"] },
    { name: "simd-bench", description: "SIMD instruction benchmarking suite", language: "C", languageColor: "#555555", stars: 421, forks: 31, updatedAt: "1 month ago", topics: ["simd", "benchmarks", "performance"] },
    { name: "py-profiler", description: "Low-overhead Python profiler using eBPF", language: "Python", languageColor: "#3572A5", stars: 389, forks: 25, updatedAt: "2 months ago", topics: ["profiler", "ebpf", "python", "performance"] },
    { name: "wasm-vm", description: "WebAssembly virtual machine implementation", language: "Rust", languageColor: "#DEA584", stars: 312, forks: 18, updatedAt: "3 months ago", topics: ["webassembly", "virtual-machine", "rust"] },
  ],
};
