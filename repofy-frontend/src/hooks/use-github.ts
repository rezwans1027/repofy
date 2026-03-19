import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_SHORT, STALE_MEDIUM } from "@/lib/query-client";

const searchResultSchema = z.object({
  username: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  company: z.string().nullable(),
  repos: z.number(),
  followers: z.number(),
});

const gitHubProfileSchema = z.object({
  profile: z.object({
    name: z.string().nullable(),
    avatarUrl: z.string(),
    bio: z.string().nullable(),
    location: z.string().nullable(),
    company: z.string().nullable(),
    publicRepos: z.number(),
    followers: z.number(),
    createdAt: z.string(),
  }),
  stats: z.object({ totalStars: z.number() }),
  contributions: z.object({
    totalContributions: z.number(),
    heatmap: z.array(z.array(z.number())),
  }).nullable(),
  activity: z.object({
    totalEvents: z.number(),
    pushEvents: z.number(),
    prEvents: z.number(),
    issueEvents: z.number(),
    reviewEvents: z.number(),
  }),
  languages: z.array(z.object({
    name: z.string(),
    color: z.string(),
    percentage: z.number(),
    repoCount: z.number(),
  })),
  topRepositories: z.array(z.object({
    name: z.string(),
    description: z.string().nullable(),
    language: z.string().nullable(),
    stars: z.number(),
    forks: z.number(),
    pushedAt: z.string(),
    topics: z.array(z.string()),
    url: z.string(),
  })),
});

type SearchResult = z.infer<typeof searchResultSchema>;
type GitHubProfileRaw = z.infer<typeof gitHubProfileSchema>;

export function useGitHubSearch(debouncedQuery: string) {
  const { isLoading } = useAuth();
  return useQuery({
    queryKey: ["github", "search", debouncedQuery],
    queryFn: ({ signal }) =>
      api.get<SearchResult[]>(
        `/github/search?q=${encodeURIComponent(debouncedQuery)}`,
        { signal, schema: z.array(searchResultSchema) },
      ),
    // Wait for auth to load so the cached access token is available
    enabled: !isLoading && debouncedQuery.trim().length > 0,
    staleTime: STALE_SHORT,
  });
}

export function useGitHubProfile(username: string) {
  const { isLoading } = useAuth();
  return useQuery({
    queryKey: ["github", "profile", username],
    queryFn: ({ signal }) =>
      api.get<GitHubProfileRaw>(
        `/github/${encodeURIComponent(username)}`,
        { signal, schema: gitHubProfileSchema },
      ),
    // Wait for auth to load so the cached access token is available
    enabled: !isLoading && !!username,
    staleTime: STALE_MEDIUM,
  });
}
