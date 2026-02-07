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

// ── Analysis Report Data ──────────────────────────────────────────

export const reportData = {
  candidateLevel: "Senior" as const,
  overallScore: 82,
  recommendation: "Strong Hire" as const,

  summary:
    "Alex Chen is a highly consistent systems engineer with strong architectural instincts and a clear preference for type-safe, well-structured code. Their open-source portfolio demonstrates depth in Rust and TypeScript, with meaningful contributions to infrastructure tooling. While testing coverage and documentation could improve, their commit discipline and collaboration patterns indicate a reliable, senior-level engineer well-suited for platform or developer experience roles.",

  radarAxes: [
    { axis: "Code Quality", value: 0.87 },
    { axis: "Project Complexity", value: 0.78 },
    { axis: "Technical Breadth", value: 0.82 },
    { axis: "Eng. Practices", value: 0.74 },
    { axis: "Consistency", value: 0.91 },
    { axis: "Collaboration", value: 0.68 },
  ],

  radarBreakdown: [
    { label: "Code Quality", score: 8.7, note: "Clean abstractions, consistent patterns across repos" },
    { label: "Project Complexity", score: 7.8, note: "Multiple non-trivial systems with real-world usage" },
    { label: "Technical Breadth", score: 8.2, note: "Strong in 4 languages, systems to web" },
    { label: "Engineering Practices", score: 7.4, note: "Good CI/CD usage, testing could be more consistent" },
    { label: "Consistency", score: 9.1, note: "Regular commits over 5+ years, no long gaps" },
    { label: "Collaboration", score: 6.8, note: "Moderate PR review activity, few issue discussions" },
  ],

  stats: {
    repos: 47,
    stars: 2340,
    followers: 891,
    contributions: 1847,
    starsPerRepo: 49.8,
    collaborationRatio: 0.34,
    interpretation:
      "High star count relative to repo count suggests quality over quantity. The collaboration ratio of 34% indicates primarily solo work, with selective but meaningful contributions to others' projects. Follower-to-following ratio (7.2:1) signals strong community recognition.",
  },

  activityBreakdown: {
    push: 52,
    pr: 24,
    issue: 12,
    review: 12,
    interpretation:
      "Primarily a builder — over half of activity is direct code pushes. Healthy PR workflow at 24%, with balanced issue tracking and code review participation.",
  },

  languageProfile: {
    languages: [
      { name: "TypeScript", color: "#3178C6", percentage: 38, repos: 18 },
      { name: "Rust", color: "#DEA584", percentage: 27, repos: 12 },
      { name: "Python", color: "#3572A5", percentage: 16, repos: 9 },
      { name: "Go", color: "#00ADD8", percentage: 10, repos: 5 },
      { name: "Shell", color: "#89E051", percentage: 6, repos: 8 },
      { name: "Other", color: "#71717A", percentage: 3, repos: 4 },
    ],
    interpretation:
      "TypeScript and Rust dominate, reflecting a systems-oriented mindset with web-layer fluency. Python usage concentrated in tooling and scripting repos. Go adoption is recent but growing — 3 of 5 Go repos created in the last year.",
  },

  topRepos: [
    {
      name: "rustic-kv",
      description: "High-performance embedded key-value store written in Rust with LSM-tree architecture",
      language: "Rust",
      languageColor: "#DEA584",
      stars: 847,
      forks: 63,
      topics: ["rust", "database", "key-value", "lsm-tree"],
      codeQuality: "A" as const,
      testing: "B+" as const,
      cicd: "A-" as const,
      verdict: "Excellent architecture with comprehensive benchmarks. Memory-safe patterns used throughout. Test coverage at 78% — solid but could reach higher for a database project.",
      isBestWork: true,
    },
    {
      name: "ts-api-forge",
      description: "TypeScript API scaffolding CLI with built-in auth, validation, and OpenAPI generation",
      language: "TypeScript",
      languageColor: "#3178C6",
      stars: 612,
      forks: 89,
      topics: ["typescript", "api", "cli", "openapi", "developer-tools"],
      codeQuality: "A-" as const,
      testing: "B" as const,
      cicd: "A" as const,
      verdict: "Well-designed plugin system with clean separation of concerns. CI pipeline is exemplary with matrix testing across Node versions. Unit test coverage at 64% — integration tests would strengthen confidence.",
      isBestWork: false,
    },
    {
      name: "commit-radar",
      description: "Git analytics dashboard that visualizes commit patterns and team velocity",
      language: "TypeScript",
      languageColor: "#3178C6",
      stars: 234,
      forks: 18,
      topics: ["git", "analytics", "dashboard", "visualization"],
      codeQuality: "B+" as const,
      testing: "C+" as const,
      cicd: "B" as const,
      verdict: "Creative project with clean UI code. Backend parsing logic is robust but the frontend has some tightly coupled components. Testing is the weakest area — mostly snapshot tests with limited behavioral coverage.",
      isBestWork: false,
    },
  ],

  strengths: [
    { text: "Exceptional commit consistency — active contributions every week for 3+ years", evidence: "Heatmap analysis, 1847 contributions in the last year" },
    { text: "Strong architectural patterns across multiple languages", evidence: "Clean module boundaries in rustic-kv, plugin system in ts-api-forge" },
    { text: "Meaningful open-source impact with organically grown projects", evidence: "2,340 total stars, 170 forks across repos" },
    { text: "Type-safety advocate with consistent use of strict configurations", evidence: "TypeScript strict mode in all TS repos, Rust's ownership model leveraged well" },
  ],

  weaknesses: [
    { text: "Testing coverage varies significantly across projects (45-78%)", evidence: "commit-radar at 45%, rustic-kv at 78%" },
    { text: "Documentation tends to be minimal — README-only in most repos", evidence: "No dedicated docs folder in 40 of 47 repos" },
    { text: "Limited evidence of collaborative development patterns", evidence: "Only 12% of activity is PR reviews, few multi-contributor repos" },
    { text: "Frontend projects show less architectural discipline than backend work", evidence: "Tightly coupled components in commit-radar frontend" },
  ],

  redFlags: [
    { text: "Several repos have dependencies with known vulnerabilities that haven't been updated", severity: "Minor" as const, explanation: "12 repos have outdated dependency warnings. This is common in personal projects but worth discussing in context of production codebases." },
    { text: "Commit messages become less descriptive under apparent time pressure", severity: "Notable" as const, explanation: "Late-night commits (after 11 PM) show significantly shorter messages and larger changesets. Pattern suggests potential for reduced code quality under deadline pressure." },
  ],

  interviewQuestions: [
    { question: "Walk me through the LSM-tree implementation in rustic-kv — what tradeoffs did you make for write vs read performance?", why: "Tests depth of systems knowledge and ability to articulate architectural decisions" },
    { question: "Your testing coverage varies from 45% to 78% across projects. How do you decide what level of testing a project needs?", why: "Reveals testing philosophy and awareness of the coverage gap" },
    { question: "How would you approach breaking down commit-radar's tightly-coupled frontend into more maintainable components?", why: "Tests self-awareness about code quality and refactoring skills" },
    { question: "Describe a time you had to review and provide feedback on someone else's code. What was your approach?", why: "Probes collaboration skills given the lower review activity" },
    { question: "Your Go adoption is recent. What drew you to Go, and how does your approach differ from Rust?", why: "Tests language comparison ability and continuous learning mindset" },
    { question: "If you were to add comprehensive integration tests to ts-api-forge, what would your test architecture look like?", why: "Validates ability to design test strategies, not just write unit tests" },
  ],
};

