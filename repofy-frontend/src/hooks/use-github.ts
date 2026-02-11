import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

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

interface GitHubProfileRaw {
  profile: {
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    location: string | null;
    company: string | null;
    publicRepos: number;
    followers: number;
    createdAt: string;
  };
  stats: { totalStars: number };
  contributions: {
    totalContributions: number;
    heatmap: number[][];
  } | null;
  activity: {
    totalEvents: number;
    pushEvents: number;
    prEvents: number;
    issueEvents: number;
    reviewEvents: number;
  };
  languages: {
    name: string;
    color: string;
    percentage: number;
    repoCount: number;
  }[];
  topRepositories: {
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    pushedAt: string;
    topics: string[];
    url: string;
  }[];
}

export function useGitHubSearch(debouncedQuery: string) {
  return useQuery({
    queryKey: ["github", "search", debouncedQuery],
    queryFn: ({ signal }) =>
      api.get<SearchResult[]>(
        `/github/search?q=${encodeURIComponent(debouncedQuery)}`,
        { signal },
      ),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

export function useGitHubProfile(username: string) {
  return useQuery({
    queryKey: ["github", "profile", username],
    queryFn: ({ signal }) =>
      api.get<GitHubProfileRaw>(
        `/github/${encodeURIComponent(username)}`,
        { signal },
      ),
    enabled: !!username,
    staleTime: 2 * 60 * 1000,
  });
}
