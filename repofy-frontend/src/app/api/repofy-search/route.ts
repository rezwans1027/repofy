import { NextResponse } from "next/server";

const GITHUB_USERS_URL = "https://api.github.com/users";

export type RepofySearchProfile = {
  name: string | null;
  username: string;
  avatarUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  repos: number;
};

/**
 * GET /api/repofy-search?username=octocat
 * Returns profile info for the card: name, @username, bio, location, company, avatar.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json(
      { error: "Missing username" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${GITHUB_USERS_URL}/${encodeURIComponent(username)}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Repofy",
      },
      next: { revalidate: 60 },
    });

    if (res.status === 404) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "GitHub request failed" },
        { status: 502 }
      );
    }

    const user = await res.json();

    const profile: RepofySearchProfile = {
      name: user.name ?? null,
      username: user.login,
      avatarUrl: user.avatar_url ?? "",
      bio: user.bio?.trim() || null,
      location: user.location?.trim() || null,
      company: user.company?.trim() || null,
      repos: typeof user.public_repos === "number" ? user.public_repos : 0,
    };

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
