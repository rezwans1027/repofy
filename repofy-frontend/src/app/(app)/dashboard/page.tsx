"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { ProfileSections } from "@/components/profile/profile-sections";
import { StickyCTABar } from "@/components/profile/sticky-cta-bar";
import { fakeUsers, fakeRepos } from "@/lib/demo-data";
import {
  MapPin,
  Building2,
  Calendar,
  Search,
  ArrowLeft,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return fakeUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
    );
  }, [query]);

  const selectedUser = selectedUsername
    ? fakeUsers.find((u) => u.username === selectedUsername) ?? null
    : null;
  const selectedRepos = selectedUsername ? fakeRepos[selectedUsername] : null;

  function handleSelect(username: string) {
    setSelectedUsername(username);
    window.history.pushState({ fromDashboard: true }, "", `/profile/${username}`);
  }

  function handleBack() {
    setSelectedUsername(null);
    window.history.pushState(null, "", "/dashboard");
  }

  useEffect(() => {
    function onPopState() {
      setSelectedUsername(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Search view ──
  if (!selectedUsername) {
    return (
      <LayoutGroup>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col items-center pt-16 sm:pt-24"
        >
          <div className="w-full max-w-2xl">
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

                {!query.trim() && (
                  <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Search className="size-3" />
                    Type a GitHub username to search
                  </p>
                )}
              </div>
            </TerminalWindow>
          </div>

          <div className="mt-6 w-full max-w-2xl space-y-3">
            {query.trim() && filteredUsers.length > 0
              ? filteredUsers.map((user, i) => (
                  <motion.div
                    key={user.username}
                    layoutId={`card-${user.username}`}
                    onClick={() => handleSelect(user.username)}
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
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-lg font-bold text-cyan">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {user.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {user.bio}
                        </p>
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
                        <span>{user.followers} followers</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              : query.trim() && (
                  <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <p className="font-mono text-sm text-muted-foreground">
                      <span className="text-yellow-500">warn:</span> No users
                      found matching &quot;{query}&quot;
                    </p>
                  </div>
                )}
          </div>
        </motion.div>
      </LayoutGroup>
    );
  }

  // ── Profile view (expanded card) ──
  if (!selectedUser || !selectedRepos) return null;

  const initials = selectedUser.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <LayoutGroup>
      <div className="space-y-8 pb-20">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          <ArrowLeft className="size-3" />
          back to search
        </motion.button>

        <motion.div
          layoutId={`card-${selectedUsername}`}
          transition={{ layout: { duration: 0.35, ease: EASE } }}
          style={{ borderRadius: 8 }}
          className="border border-border bg-card p-6"
        >
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-2xl font-bold text-cyan border-2 border-cyan/20">
              {initials}
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <h1 className="font-mono text-2xl font-bold tracking-tight">
                  {selectedUser.name}
                </h1>
                <span className="font-mono text-sm text-muted-foreground">
                  @{selectedUser.username}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedUser.bio}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {selectedUser.location}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  {selectedUser.company}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  Joined {selectedUser.joinedYear}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3, ease: EASE }}
        >
          <ProfileSections user={selectedUser} repos={selectedRepos} />
        </motion.div>

        <StickyCTABar username={selectedUser.username} />
      </div>
    </LayoutGroup>
  );
}
