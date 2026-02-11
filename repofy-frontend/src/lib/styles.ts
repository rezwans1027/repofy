/** Grade letter -> text color class */
export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade.startsWith("B")) return "text-cyan";
  if (grade.startsWith("C")) return "text-yellow-400";
  return "text-red-400";
}

/** Recommendation -> badge classes */
export const RECOMMENDATION_STYLES: Record<string, string> = {
  "Strong Hire": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Hire: "bg-cyan/15 text-cyan border-cyan/30",
  "Weak Hire": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "No Hire": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

export function recommendationStyle(rec: string): string {
  return RECOMMENDATION_STYLES[rec] ?? "bg-secondary text-muted-foreground border-border";
}

/** Red-flag severity -> badge classes */
export const SEVERITY_STYLES: Record<string, string> = {
  Minor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Notable: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Concerning: "bg-red-500/15 text-red-400 border-red-500/30",
};

/** Project idea difficulty -> badge classes */
export const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

/** Improvement priority -> badge classes */
export const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-500/15 text-red-400 border-red-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

/** Skill demand level -> badge classes */
export const DEMAND_STYLES: Record<string, string> = {
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Growing: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};
