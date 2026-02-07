<<<<<<< HEAD
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const USER_PROFILE_QUERY = `
  query UserProfile($login: String!) {
    user(login: $login) {
      id
      login
      name
      avatarUrl
      bio
      company
      email
      location
      url
      websiteUrl
      repositories(first: 10, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          name
          url
          description
          primaryLanguage { name }
          stargazerCount
          forkCount
        }
      }
    }
  }
`;

const VIEWER_PROFILE_QUERY = `
  query ViewerProfile {
    viewer {
      id
      login
      name
      avatarUrl
      bio
      company
      email
      location
      url
      websiteUrl
      repositories(first: 10, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          name
          url
          description
          primaryLanguage { name }
          stargazerCount
          forkCount
        }
      }
    }
  }
`;

export type GitHubProfile = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  email: string | null;
  location: string | null;
  url: string;
  websiteUrl: string | null;
  repositories: {
    nodes: Array<{
      name: string;
      url: string;
      description: string | null;
      primaryLanguage: { name: string } | null;
      stargazerCount: number;
      forkCount: number;
    }>;
  };
};

/**
 * Fetches a GitHub user profile (and repos) using the GraphQL API.
 * Use login "viewer" to fetch the authenticated user's profile.
 */
export async function getGitHubProfile(
  login: string,
  token: string
): Promise<GitHubProfile | null> {
  const isViewer = login.toLowerCase() === "viewer";

  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: isViewer ? VIEWER_PROFILE_QUERY : USER_PROFILE_QUERY,
      variables: isViewer ? undefined : { login },
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  if (json.errors?.length) {
    return null;
  }

  const user = isViewer ? json.data?.viewer : json.data?.user;
  return user ?? null;
}
