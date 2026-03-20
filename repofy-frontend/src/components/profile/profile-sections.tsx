"use client";

import { StatsGrid } from "./sections/stats-grid";
import { TopLanguages } from "./sections/top-languages";
import { TopRepositories } from "./sections/top-repositories";
import { RecentActivity } from "./sections/recent-activity";
import { PrActivity } from "./sections/pr-activity";
import { TopCollaborators } from "./sections/top-collaborators";
import { CommitStreak } from "./sections/commit-streak";
import { ContributionHeatmap } from "./sections/contribution-heatmap";

export interface ProfileData {
  repos: number;
  stars: number;
  followers: number;
  contributions: number;
  contributionsIsEstimate?: boolean;
  contributionHeatmap: number[][] | null;
  languages: { name: string; color: string; percentage: number; repoCount?: number }[];
  joinedYear?: number;
  activityBreakdown?: {
    pushEvents: number;
    prEvents: number;
    issueEvents: number;
    reviewEvents: number;
  };
  prActivity?: { opened: number; merged: number; reviewed: number };
  commitStreak?: { current: number; longest: number };
  topCollaborators?: {
    username: string;
    initials: string;
    contributions: number;
  }[];
}

export interface RepoData {
  name: string;
  description: string;
  language: string;
  languageColor: string;
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
  url?: string;
}

interface ProfileSectionsProps {
  user: ProfileData;
  repos: RepoData[];
}

export function ProfileSections({ user, repos }: ProfileSectionsProps) {
  return (
    <div className="space-y-6">
      <StatsGrid
        repos={user.repos}
        stars={user.stars}
        followers={user.followers}
        contributions={user.contributions}
        contributionsIsEstimate={user.contributionsIsEstimate}
      />

      <TopLanguages languages={user.languages} />

      <TopRepositories repos={repos} />

      {user.activityBreakdown && (
        <RecentActivity activityBreakdown={user.activityBreakdown} />
      )}

      {user.prActivity && (
        <PrActivity prActivity={user.prActivity} />
      )}

      {user.topCollaborators && user.topCollaborators.length > 0 && (
        <TopCollaborators collaborators={user.topCollaborators} />
      )}

      {user.commitStreak && (
        <CommitStreak commitStreak={user.commitStreak} />
      )}

      <ContributionHeatmap heatmapData={user.contributionHeatmap} />
    </div>
  );
}
