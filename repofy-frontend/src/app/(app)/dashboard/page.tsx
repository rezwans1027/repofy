"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { TerminalWindow } from "@/components/ui/terminal-window";
import {
  MapPin,
  Building2,
  Search,
  Loader2,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTypewriter } from "@/hooks/use-typewriter";
import { useGitHubSearch } from "@/hooks/use-github";
import { SmoothCaretInput } from "@/components/ui/smooth-caret-input";

export default function DashboardPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const { data: results = [], isFetching: isSearching } =
    useGitHubSearch(debouncedQuery);

  const searchSettled = !isSearching && debouncedQuery === query.trim();
  const headline = useTypewriter([
    "Discover a developer's DNA.",
    "Evaluate any engineer.",
    "Analyze any GitHub profile.",
  ]);

  return (
    <div className="flex flex-col items-center pt-[25vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 h-8 font-mono text-xl font-bold tracking-tight text-foreground"
      >
        <h1>{headline}<span className="animate-blink ml-px">|</span></h1>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl"
      >
        <TerminalWindow title="repofy — search">
          <div>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-cyan">$</span>
              <span className="text-muted-foreground">repofy search</span>
              <div className="relative flex-1">
                <SmoothCaretInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="username..."
                  autoFocus
                  autoComplete="off"
                  name="repofy-search-nofill"
                  data-testid="search-input"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!query.trim() && searchSettled && (
                <motion.div
                  key="hint"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 32, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="pt-4 font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Search className="size-3" />
                    Type a GitHub username to search
                  </p>
                </motion.div>
              )}
              {query.trim() && !searchSettled && (
                <motion.div
                  key="searching"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 32, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="pt-4 font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" />
                    Searching GitHub...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TerminalWindow>
      </motion.div>

      <div className="mt-6 w-full max-w-2xl space-y-3">
        <AnimatePresence mode="popLayout">
          {query.trim() && results.length > 0
            ? results.map((user, i) => (
                <motion.div
                  key={user.username}
                  data-testid={`search-result-${user.username}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/profile/${user.username}`)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/profile/${user.username}`);
                    }
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.05 }}
                  layout
                  className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:border-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
                >
                  <div className="flex items-center gap-4">
                    <Image
                      src={user.avatarUrl}
                      alt={user.username}
                      width={48}
                      height={48}
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
            : query.trim() && searchSettled && (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  className="rounded-lg border border-border bg-card p-6 text-center"
                >
                  <p className="font-mono text-sm text-muted-foreground">
                    <span className="text-yellow-500">warn:</span> No users
                    found matching &quot;{query}&quot;
                  </p>
                </motion.div>
              )}
        </AnimatePresence>
      </div>
    </div>
  );
}
