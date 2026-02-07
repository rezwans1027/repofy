"use client";

import { useState, useEffect, useRef } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { TerminalWindow } from "@/components/ui/terminal-window";
import {
  ProfileSections,
  type ProfileData,
  type RepoData,
} from "@/components/profile/profile-sections";
import { StickyCTABar } from "@/components/profile/sticky-cta-bar";
import {
  MapPin,
  Building2,
  Calendar,
  Search,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface SearchResult {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  repos: number;
  followers: number;
}

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

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileRepos, setProfileRepos] = useState<RepoData[] | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const profileAbortRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `${API_URL}/github/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (json.success) {
          setResults(json.data ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      setIsSearching(false);
    };
  }, [query]);

  async function handleSelect(user: SearchResult) {
    setSelectedUsername(user.username);
    setSelectedResult(user);
    setProfileData(null);
    setProfileRepos(null);
    setProfileError(null);
    window.history.pushState({ fromDashboard: true }, "", `/profile/${user.username}`);

    // Fetch profile data
    profileAbortRef.current?.abort();
    const controller = new AbortController();
    profileAbortRef.current = controller;
    setIsLoadingProfile(true);

    try {
      const res = await fetch(`${API_URL}/github/${encodeURIComponent(user.username)}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        setProfileError(json.error || "Failed to load profile data");
        return;
      }

      const d = json.data;
      const colorMap: Record<string, string> = Object.fromEntries(
        d.languages.map((l: { name: string; color: string }) => [l.name, l.color]),
      );

      setProfileData({
        repos: d.profile.publicRepos,
        stars: d.stats.totalStars,
        followers: d.profile.followers,
        contributions: d.activity.totalEvents,
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
      setProfileError("Failed to connect to the API");
    } finally {
      if (!controller.signal.aborted) setIsLoadingProfile(false);
    }
  }

  function handleBack() {
    profileAbortRef.current?.abort();
    setSelectedUsername(null);
    setSelectedResult(null);
    setProfileData(null);
    setProfileRepos(null);
    setIsLoadingProfile(false);
    setProfileError(null);
    window.history.pushState(null, "", "/dashboard");
  }

  useEffect(() => {
    function onPopState() {
      profileAbortRef.current?.abort();
      setSelectedUsername(null);
      setSelectedResult(null);
      setProfileData(null);
      setProfileRepos(null);
      setIsLoadingProfile(false);
      setProfileError(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Search view ──
  if (!selectedUsername) {
    return (
      <LayoutGroup>
        <div className="flex flex-col items-center pt-[25vh]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 h-8 font-mono text-xl font-bold tracking-tight text-foreground"
          >
            <TypeAnimation
              sequence={[
                "Discover a developer's DNA.",
                2000,
                "Evaluate any engineer.",
                2000,
                "Analyze any GitHub profile.",
                2000,
              ]}
              wrapper="h1"
              speed={40}
              deletionSpeed={60}
              repeat={Infinity}
              cursor={true}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl"
          >
            <TerminalWindow title="repofy — search">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-cyan">$</span>
                  <span className="text-muted-foreground">repofy search</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="username..."
                      autoFocus
                      autoComplete="off"
                      name="repofy-search-nofill"
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    />
                  </div>
                </div>

                {!query.trim() && !isSearching && (
                  <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Search className="size-3" />
                    Type a GitHub username to search
                  </p>
                )}
                {isSearching && (
                  <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" />
                    Searching GitHub...
                  </p>
                )}
              </div>
            </TerminalWindow>
          </motion.div>

          <div className="mt-6 w-full max-w-2xl space-y-3">
            {results.length > 0
              ? results.map((user, i) => (
                  <motion.div
                    key={user.username}
                    layoutId={`card-${user.username}`}
                    onClick={() => handleSelect(user)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.05,
                      layout: { duration: 0.35, ease: EASE },
                    }}
                    style={{ borderRadius: 8 }}
                    className="cursor-pointer border border-border bg-card p-4 transition-colors hover:border-cyan/50"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="h-12 w-12 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {user.name || user.username}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                        {user.bio && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {user.bio}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          {user.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {user.location}
                            </span>
                          )}
                          {user.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="size-3" />
                              {user.company}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground font-mono">
                        <span>{user.repos} repos</span>
                        <span>{user.followers.toLocaleString()} followers</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              : query.trim() && !isSearching && (
                  <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <p className="font-mono text-sm text-muted-foreground">
                      <span className="text-yellow-500">warn:</span> No users
                      found matching &quot;{query}&quot;
                    </p>
                  </div>
                )}
          </div>
        </div>
      </LayoutGroup>
    );
  }

  // ── Profile view (expanded card) ──
  if (!selectedResult) return null;

  const displayName = selectedResult.name ?? selectedResult.username;

  return (
    <LayoutGroup>
      <div className="space-y-5 pb-20">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          className="flex items-center justify-between"
        >
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
          >
            <ArrowLeft className="size-3" />
            back to search
          </button>
          <a
            href={`https://github.com/${selectedResult.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
          >
            View on GitHub
            <ExternalLink className="size-3" />
          </a>
        </motion.div>

        <motion.div
          layoutId={`card-${selectedUsername}`}
          transition={{ layout: { duration: 0.35, ease: EASE } }}
          style={{ borderRadius: 8 }}
          className="border border-border bg-card p-4"
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <img
              src={selectedResult.avatarUrl}
              alt={selectedResult.username}
              className="h-14 w-14 shrink-0 rounded-full border-2 border-cyan/20"
            />
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <h1 className="font-mono text-lg font-bold tracking-tight">
                  {displayName}
                </h1>
                <span className="font-mono text-sm text-muted-foreground">
                  @{selectedResult.username}
                </span>
              </div>
              {selectedResult.bio && (
                <p className="text-sm text-muted-foreground">
                  {selectedResult.bio}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {selectedResult.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {selectedResult.location}
                  </span>
                )}
                {selectedResult.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3" />
                    {selectedResult.company}
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
        </motion.div>

        {/* Loading state */}
        {isLoadingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Stats skeleton */}
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
            {/* Languages skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-full animate-pulse rounded-full bg-secondary" />
            </div>
            {/* Repos skeleton */}
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
          </motion.div>
        )}

        {/* Error state */}
        {!isLoadingProfile && profileError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center space-y-2"
          >
            <p className="font-mono text-sm text-red-400">
              {profileError}
            </p>
            <button
              onClick={() => {
                if (selectedResult) handleSelect(selectedResult);
              }}
              className="font-mono text-xs text-muted-foreground hover:text-cyan transition-colors underline underline-offset-2"
            >
              retry
            </button>
          </motion.div>
        )}

        {/* Loaded data */}
        {!isLoadingProfile && profileData && profileRepos && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3, ease: EASE }}
          >
            <ProfileSections user={profileData} repos={profileRepos} />
          </motion.div>
        )}

        <StickyCTABar username={selectedResult.username} />
      </div>
    </LayoutGroup>
  );
}
