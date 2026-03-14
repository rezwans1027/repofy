// ── AdviceData – shared interface for advice reports ────────────────
// SYNC: This file is duplicated in repofy-frontend/src/shared/types/advice.ts
//       If you update this file, update the frontend copy too.

export type GenerationWarning =
  | "repo_improvements_unavailable"
  | "repo_improvements_reduced"
  | "weekly_roadmap_synthesized"
  | "success_metrics_reduced"
  | "profile_optimizations_reduced"
  | "skill_roadmap_reduced"
  | "contribution_strategy_reduced"
  | "strengths_and_gaps_reduced"
  | "career_positioning_reduced";

export interface AdviceData {
  schemaVersion: "v2";
  generationWarnings: GenerationWarning[];

  summary: string;

  trajectory: {
    currentEstimate: "Junior" | "Mid-Level" | "Senior" | "Staff";
    targetEstimate: "Junior" | "Mid-Level" | "Senior" | "Staff";
    confidence: "Low" | "Medium" | "High";
    rationale: string;
    calibration: {
      complexity: string;
      breadth: string;
      collaboration: string;
      engineeringPractices: string;
      consistency: string;
    };
  };

  buildRoadmap: {
    title: string;
    projectOutcome: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    estimatedWeeks: number;
    techStack: string[];
    milestones: string[];
    hiringSignals: string[];
    evidence: string;
  }[];

  skillRoadmap: {
    skill: string;
    priority: "Now" | "Next" | "Later";
    demandLevel: "High" | "Medium" | "Growing";
    relatedTo: string;
    reason: string;
    proofOfLearning: string;
    evidence: string;
  }[];

  repoImprovements: {
    repoName: string;
    repoUrl?: string | null;
    language?: string | null;
    languageColor?: string;
    stars?: number;
    improvements: {
      area: "Testing" | "Documentation" | "CI/CD" | "Code Quality" | "Architecture";
      suggestion: string;
      priority: "High" | "Medium" | "Low";
      expectedOutcome: string;
    }[];
  }[];

  contributionStrategy: {
    title: string;
    detail: string;
    evidence: string;
  }[];

  profileOptimizations: {
    area: string;
    current: string;
    suggestion: string;
    example: string;
    impact: string;
  }[];

  weeklyRoadmap: {
    week: number;
    activeBuildTitle: string;
    focus: string;
    deliverable: string;
    tasks: string[];
    skillTask: string;
    successCheck: string;
  }[];

  strengthsAndGaps: {
    strengths: { area: string; detail: string }[];
    gaps: { area: string; detail: string }[];
  };

  careerPositioning: {
    positioning: string;
    roles: string[];
    differentiators: string[];
  };

  successMetrics: string[];
}
