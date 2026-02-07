"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { ProfileSections } from "@/components/profile/profile-sections";
import { StickyCTABar } from "@/components/profile/sticky-cta-bar";
import { fakeUsers, fakeRepos } from "@/lib/demo-data";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Calendar,
} from "lucide-react";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const user = fakeUsers.find((u) => u.username === username);
  const repos = fakeRepos[username];

  if (!user || !repos) {
    notFound();
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="space-y-5 pb-20">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
      >
        <ArrowLeft className="size-3" />
        back to search
      </Link>

      {/* Profile Header */}
      <AnimateOnView>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-lg font-bold text-cyan border-2 border-cyan/20">
              {initials}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <h1 className="font-mono text-lg font-bold tracking-tight">
                  {user.name}
                </h1>
                <span className="font-mono text-sm text-muted-foreground">
                  @{user.username}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{user.bio}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {user.location}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  {user.company}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  Joined {user.joinedYear}
                </span>
              </div>
            </div>
          </div>
        </div>
      </AnimateOnView>

      {/* Profile sections */}
      <ProfileSections user={user} repos={repos} />

      <StickyCTABar username={user.username} />
    </div>
  );
}
