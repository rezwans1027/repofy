"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import {
  ProfileSections,
  type ProfileData,
  type RepoData,
} from "@/components/profile/profile-sections";
import { StickyCTABar } from "@/components/profile/sticky-cta-bar";
import { generateHeatmapData } from "@/lib/demo-data";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileRepos, setProfileRepos] = useState<RepoData[] | null>(null);
  const [apiProfile, setApiProfile] = useState<{
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    location: string | null;
    company: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/github/${encodeURIComponent(username)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const json = await res.json();
        if (!json.success || !json.data) {
          setError(json.error || "Failed to load profile data");
          return;
        }

        const d = json.data;
        const colorMap: Record<string, string> = Object.fromEntries(
          d.languages.map((l: { name: string; color: string }) => [l.name, l.color]),
        );

        setApiProfile({
          name: d.profile.name,
          avatarUrl: d.profile.avatarUrl,
          bio: d.profile.bio,
          location: d.profile.location,
          company: d.profile.company,
        });

        setProfileData({
          repos: d.profile.publicRepos,
          stars: d.stats.totalStars,
          followers: d.profile.followers,
          contributions: d.contributions?.totalContributions ?? d.activity.totalEvents,
          contributionHeatmap: d.contributions?.heatmap ?? generateHeatmapData(),
          languages: d.languages.map(
            (l: { name: string; color: string; percentage: number; repoCount: number }) => ({
              name: l.name,
              color: l.color,
              percentage: l.percentage,
              repoCount: l.repoCount,
            }),
          ),
          joinedYear: new Date(d.profile.createdAt).getFullYear(),
          activityBreakdown: {
            pushEvents: d.activity.pushEvents,
            prEvents: d.activity.prEvents,
            issueEvents: d.activity.issueEvents,
            reviewEvents: d.activity.reviewEvents,
          },
        });

        setProfileRepos(
          d.topRepositories.map(
            (repo: {
              name: string;
              description: string | null;
              language: string | null;
              stars: number;
              forks: number;
              pushedAt: string;
              topics: string[];
              url: string;
            }) => ({
              name: repo.name,
              description: repo.description ?? "",
              language: repo.language ?? "",
              languageColor: colorMap[repo.language ?? ""] ?? "#8b949e",
              stars: repo.stars,
              forks: repo.forks,
              updatedAt: timeAgo(repo.pushedAt),
              topics: repo.topics,
              url: repo.url,
            }),
          ),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to connect to the API");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [username]);
  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          <ArrowLeft className="size-3" />
          back to search
        </Link>
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          View on GitHub
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Profile header */}
      {apiProfile && (
        <AnimateOnView>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <img
                src={apiProfile.avatarUrl}
                alt={username}
                className="h-14 w-14 shrink-0 rounded-full border-2 border-cyan/20"
              />
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="font-mono text-lg font-bold tracking-tight">
                    {apiProfile.name ?? username}
                  </h1>
                  <span className="font-mono text-sm text-muted-foreground">
                    @{username}
                  </span>
                </div>
                {apiProfile.bio && (
                  <p className="text-sm text-muted-foreground">{apiProfile.bio}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {apiProfile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {apiProfile.location}
                    </span>
                  )}
                  {apiProfile.company && (
                    <span className="flex items-center gap-1">
                      <Building2 className="size-3" />
                      {apiProfile.company}
                    </span>
                  )}
                  {profileData?.joinedYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      Joined {profileData.joinedYear}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </AnimateOnView>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
                <div className="h-6 w-14 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-full animate-pulse rounded-full bg-secondary" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="h-4 w-28 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-full animate-pulse rounded bg-secondary" />
                <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
          <p className="font-mono text-xs text-muted-foreground flex items-center gap-2 justify-center pt-2">
            <Loader2 className="size-3 animate-spin" />
            Fetching profile data from GitHub...
          </p>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center space-y-2">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="font-mono text-xs text-muted-foreground hover:text-cyan transition-colors underline underline-offset-2"
          >
            retry
          </button>
        </div>
      )}

      {/* Profile sections */}
      {!isLoading && profileData && profileRepos && (
        <>
          <ProfileSections user={profileData} repos={profileRepos} />
          <StickyCTABar username={username} />
        </>
      )}
    </div>
  );
}
