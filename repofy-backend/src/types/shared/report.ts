// ── ReportData – shared interface for analysis reports ─────────────
// SYNC: This file is duplicated in repofy-frontend/src/shared/types/report.ts
//       If you update this file, update the frontend copy too.

export interface RadarAxis {
  axis: string;
  value: number;
}

export interface RadarBreakdownItem {
  label: string;
  score: number;
  note: string;
}

export interface Stats {
  repos: number;
  stars: number;
  followers: number;
  contributions: number;
  starsPerRepo: number;
  collaborationRatio: number;
  interpretation: string;
}

export interface ActivityBreakdown {
  push: number;
  pr: number;
  issue: number;
  review: number;
  interpretation: string;
}

export interface LanguageEntry {
  name: string;
  color: string;
  percentage: number;
  repos: number;
}

export interface LanguageProfile {
  languages: LanguageEntry[];
  interpretation: string;
}

export type CodeQuality = "Excellent" | "Good" | "Mixed" | "Weak" | "Unknown";
export type TestingLevel = "Strong" | "Some" | "None" | "Unknown";
export type CiCdStatus = "Present" | "Partial" | "None" | "Unknown";
export type RepoVerdict = "Standout" | "Strong" | "Solid" | "Needs Work" | "Risky";

export interface TopRepo {
  name: string;
  description: string | null;
  language: string | null;
  languageColor: string;
  stars: number;
  forks: number;
  topics: string[];
  codeQuality: CodeQuality;
  testing: TestingLevel;
  cicd: CiCdStatus;
  verdict: RepoVerdict;
  isBestWork: boolean;
}

export interface StrengthItem {
  text: string;
  evidence: string;
}

export interface WeaknessItem {
  text: string;
  evidence: string;
}

export type RedFlagSeverity = "Minor" | "Notable" | "Concerning";

export interface RedFlag {
  text: string;
  severity: RedFlagSeverity;
  explanation: string;
}

export interface InterviewQuestion {
  question: string;
  why: string;
}

export interface RiskSignals {
  concerningCount: number;
  notableCount: number;
}

export type CandidateLevel = "Junior" | "Mid-Level" | "Senior" | "Staff";
export type Recommendation = "No Hire" | "Weak Hire" | "Hire" | "Strong Hire";

export interface ReportData {
  candidateLevel: CandidateLevel;
  overallScore: number;
  recommendation: Recommendation;

  narrativeReport: string;

  radarAxes: RadarAxis[];
  radarBreakdown: RadarBreakdownItem[];

  stats: Stats;
  activityBreakdown: ActivityBreakdown;
  languageProfile: LanguageProfile;
  topRepos: TopRepo[];

  strengths: StrengthItem[];
  weaknesses: WeaknessItem[];
  redFlags: RedFlag[];
  interviewQuestions: InterviewQuestion[];

  riskSignals: RiskSignals;
  confidenceScore: number;
  rubricVersion: string;
  modelVersion: string;
  dataQualityWarnings: string[];
}
