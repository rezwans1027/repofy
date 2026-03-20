/*
 * Accent colors
 * - cyan (#22D3EE / text-cyan)  — primary brand accent, used app-wide
 * - emerald (text-emerald-400)  — advisor feature accent only
 */

/** Code quality enum -> text color class */
export function codeQualityColor(grade: string): string {
  switch (grade) {
    case "Excellent": return "text-emerald-400";
    case "Good": return "text-cyan";
    case "Mixed": return "text-yellow-400";
    case "Weak": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

/** Testing enum -> text color class */
export function testingColor(grade: string): string {
  switch (grade) {
    case "Strong": return "text-emerald-400";
    case "Some": return "text-yellow-400";
    case "None": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

/** CI/CD enum -> text color class */
export function cicdColor(grade: string): string {
  switch (grade) {
    case "Present": return "text-emerald-400";
    case "Partial": return "text-yellow-400";
    case "None": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

/** Verdict enum -> text color class */
export function verdictColor(verdict: string): string {
  switch (verdict) {
    case "Standout": return "text-amber-400";
    case "Strong": return "text-emerald-400";
    case "Solid": return "text-cyan";
    case "Needs Work": return "text-orange-400";
    case "Risky": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

/** Recommendation -> badge classes */
export const RECOMMENDATION_STYLES = {
  "Strong Hire": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Hire: "bg-cyan/15 text-cyan border-cyan/30",
  "Weak Hire": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "No Hire": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
} as const satisfies Record<string, string>;

export function recommendationStyle(rec: string): string {
  return (RECOMMENDATION_STYLES as Record<string, string>)[rec] ?? "bg-secondary text-muted-foreground border-border";
}

/** Red-flag severity -> badge classes */
export const SEVERITY_STYLES = {
  Minor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Notable: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Concerning: "bg-red-500/15 text-red-400 border-red-500/30",
} as const satisfies Record<string, string>;

/** Project idea difficulty -> badge classes */
export const DIFFICULTY_STYLES = {
  Beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Advanced: "bg-red-500/15 text-red-400 border-red-500/30",
} as const satisfies Record<string, string>;

/** Improvement priority -> badge classes */
export const PRIORITY_STYLES = {
  High: "bg-red-500/15 text-red-400 border-red-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
} as const satisfies Record<string, string>;

/** Skill demand level -> badge classes */
export const DEMAND_STYLES = {
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Growing: "bg-purple-500/15 text-purple-400 border-purple-500/30",
} as const satisfies Record<string, string>;

/** Skill roadmap timeline priority -> badge classes */
export const TIMELINE_STYLES = {
  Now: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Next: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Later: "bg-blue-500/15 text-blue-400 border-blue-500/30",
} as const satisfies Record<string, string>;

/** Trajectory confidence -> badge classes */
export const CONFIDENCE_STYLES = {
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-red-500/15 text-red-400 border-red-500/30",
} as const satisfies Record<string, string>;

/** Career level -> text color class */
export const LEVEL_STYLES = {
  Junior: "text-blue-400",
  "Mid-Level": "text-cyan",
  Senior: "text-emerald-400",
  Staff: "text-amber-400",
} as const satisfies Record<string, string>;

/** Verdict -> badge classes (bg + text + border) */
export function verdictBadgeStyle(verdict: string): string {
  switch (verdict) {
    case "Standout": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Strong": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Solid": return "bg-cyan/15 text-cyan border-cyan/30";
    case "Needs Work": return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "Risky": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-secondary text-muted-foreground border-border";
  }
}

/** Advisor accent color — used for icons, labels, and highlights in advice sections */
export const ADVISOR_ACCENT = "text-emerald-400";
export const ADVISOR_HOVER_BORDER = "hover:border-emerald-500/20";
export const ADVISOR_SIDEBAR = "bg-emerald-400/20";
export const ADVISOR_SIDEBAR_STRONG = "bg-emerald-400/30";
