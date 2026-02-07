"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { fakeUsers } from "@/lib/demo-data";
import { MapPin, Building2, Search } from "lucide-react";

export default function DashboardPage() {
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return fakeUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="flex flex-col items-center pt-16 sm:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
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

            {!query.trim() && (
              <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                <Search className="size-3" />
                Type a GitHub username to search
              </p>
            )}
          </div>
        </TerminalWindow>
      </motion.div>

      <div className="mt-6 w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, i) => (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/dashboard/${user.username}`}>
                      <div className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-cyan/50 hover:bg-card/80">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-lg font-bold text-cyan">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-sm font-bold text-foreground group-hover:text-cyan transition-colors">
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
                      </div>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <p className="font-mono text-sm text-muted-foreground">
                    <span className="text-yellow-500">warn:</span> No users
                    found matching &quot;{query}&quot;
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
