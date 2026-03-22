import type { Metadata } from "next";
import { ProfilePageContent } from "@/components/profile/profile-page-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `GitHub profile analysis for @${username}. View stats, languages, repositories, and contribution activity.`,
    openGraph: {
      title: `@${username} — Repofy`,
      description: `GitHub profile analysis for @${username}.`,
      images: [`https://avatars.githubusercontent.com/${username}`],
    },
    twitter: {
      card: "summary",
      title: `@${username} — Repofy`,
      description: `GitHub profile analysis for @${username}.`,
      images: [`https://avatars.githubusercontent.com/${username}`],
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfilePageContent username={username} />;
}
