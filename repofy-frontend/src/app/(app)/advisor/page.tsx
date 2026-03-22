"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import {
  Lightbulb,
  ArrowRight,
  Search,
  ArrowUpDown,
  Check,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  User,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { useAdviceList, useDeleteAdvice, type AdviceListItem } from "@/hooks/use-advice";
import { useActiveAdviceJob } from "@/hooks/use-advice-job";
import Image from "next/image";
import { useSelectableList } from "@/hooks/use-selectable-list";
import { calculateAdviceProgress } from "@/lib/progress";
import { relativeDate } from "@/lib/format";

export default function AdvisorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading } = useAuth();
  const { data: items = [], isLoading: queryLoading } = useAdviceList();
  const loading = authLoading || queryLoading;
  const deleteAdvice = useDeleteAdvice();
  const { data: activeJob } = useActiveAdviceJob();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [jobProgress, setJobProgress] = useState(0);
  const prevActiveJobId = useRef<string | null>(null);

  // When an active job disappears (completed/failed), refresh the advice list
  useEffect(() => {
    const currentId = activeJob?.id ?? null;
    if (prevActiveJobId.current && !currentId) {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
      queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
    }
    prevActiveJobId.current = currentId;
  }, [activeJob?.id, queryClient]);

  // Live progress tick for active job card
  useEffect(() => {
    if (!activeJob?.created_at) {
      setJobProgress(0);
      return;
    }
    const tick = () => setJobProgress(calculateAdviceProgress(activeJob.created_at).progress);
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [activeJob?.created_at]);
  const {
    selected,
    selectMode,
    setSelectMode,
    toggleSelect,
    toggleSelectAll,
    exitSelectMode,
    handleDelete,
  } = useSelectableList();

  // Compute version numbers per username (V1 = oldest, V2 = next, etc.)
  const versionMap = useMemo(() => {
    const map = new Map<string, number>();
    const byUsername = new Map<string, AdviceListItem[]>();
    for (const item of items) {
      const group = byUsername.get(item.analyzed_username) ?? [];
      group.push(item);
      byUsername.set(item.analyzed_username, group);
    }
    for (const group of byUsername.values()) {
      group.sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime());
      group.forEach((item, i) => map.set(item.id, i + 1));
    }
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = items.filter((r: AdviceListItem) => {
      if (q && !r.analyzed_username.toLowerCase().includes(q) && !(r.analyzed_name?.toLowerCase().includes(q)))
        return false;
      return true;
    });

    return filtered.sort((a: AdviceListItem, b: AdviceListItem) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return (new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime()) * mul;
    });
  }, [items, searchQuery, sortDir]);

  const sortOptions = [
    { dir: "desc" as const, label: "Newest first" },
    { dir: "asc" as const, label: "Oldest first" },
  ];
  const currentSortLabel = sortOptions.find((o) => o.dir === sortDir)?.label ?? "Newest first";

  const filteredIds = useMemo(() => filteredItems.map((r) => r.id), [filteredItems]);
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((r: AdviceListItem) => selected.has(r.id));

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0 && !activeJob) {
    return (
      <div className="space-y-4">
        <AnimateOnView>
          <h1 className="font-mono text-lg font-bold">Advisor</h1>
        </AnimateOnView>
        <AnimateOnView delay={0.05}>
          <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-border bg-card">
          <div className="flex max-w-xs flex-col items-center text-center px-6 py-12">
            <div className="relative">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-cyan/20 bg-cyan/[0.06]">
                <Lightbulb className="size-7 text-cyan" />
              </div>
              <div className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-card bg-cyan/40" />
            </div>

            <h2 className="mt-6 font-mono text-sm font-semibold text-foreground">
              No advice generated yet
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Get a personalized 12-week growth roadmap, skill recommendations, and project ideas for any developer.
            </p>

            <Link
              href="/dashboard"
              className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-2.5 font-mono text-xs font-medium text-background transition-[filter] hover:brightness-110"
            >
              Search a developer
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <p className="mt-4 font-mono text-[11px] text-muted-foreground/60">
              1 credit per advisor session
            </p>
          </div>
          </div>
        </AnimateOnView>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AnimateOnView>
        <div className="flex items-baseline justify-between">
          <h1 className="font-mono text-lg font-bold">Advisor</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "report" : "reports"}
          </span>
        </div>
      </AnimateOnView>

      {/* Filter bar */}
      <AnimateOnView delay={0.05} className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username or name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-72 pl-9 font-mono text-xs"
          />
        </div>

        {/* Sort dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-mono text-xs">
              <ArrowUpDown className="size-3.5" />
              {currentSortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="font-mono text-[11px] text-muted-foreground">Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                className="gap-2 font-mono text-xs"
                onClick={() => setSortDir(opt.dir)}
              >
                <Check className={`size-3.5 ${sortDir === opt.dir ? "opacity-100" : "opacity-0"}`} />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className={`relative h-9 font-mono text-xs ml-auto overflow-hidden ${selectMode ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}`}
          onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={selectMode ? "cancel" : "select"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
              className="flex items-center gap-1.5"
            >
              {selectMode ? <X className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {selectMode ? "Cancel" : "Select"}
            </motion.span>
          </AnimatePresence>
        </Button>
      </AnimateOnView>

      {/* Active job card */}
      {activeJob && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="button"
          tabIndex={0}
          className="group relative flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-card p-4 cursor-pointer overflow-hidden hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          onClick={() => router.push(`/advisor/generate/${activeJob.analyzed_username}?jobId=${activeJob.id}`)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/advisor/generate/${activeJob.analyzed_username}?jobId=${activeJob.id}`);
            }
          }}
        >
          {/* Shimmer overlay */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full" style={{ animation: "shimmer 2s infinite", background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.06), transparent)" }} />

          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Loader2 className="size-4 animate-spin" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-emerald-400">
                @{activeJob.analyzed_username}
              </span>
              <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                Generating...
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(jobProgress, 2)}%`, transition: "width 0.15s linear" }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-400">
                {Math.round(jobProgress)}%
              </span>
            </div>
          </div>

          <ChevronRight className="size-4 shrink-0 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-400" />
        </motion.div>
      )}

      {/* Card list */}
      <AnimateOnView delay={0.1} className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 && !activeJob ? (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16"
            >
              <Search className="size-5 text-muted-foreground/30" />
              <p className="mt-3 font-mono text-sm text-muted-foreground">No advice matches your search</p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 font-mono text-xs text-emerald-400 hover:underline"
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            filteredItems.map((item: AdviceListItem) => {
              const isSelected = selected.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  layout
                  role="button"
                  tabIndex={0}
                  className={`group relative flex items-center gap-4 rounded-xl border p-4 ${
                    isSelected
                      ? "border-primary/30 bg-primary/[0.04]"
                      : "border-border bg-card hover:border-border hover:bg-secondary/30"
                  } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
                  onClick={selectMode ? () => toggleSelect(item.id) : () => router.push(`/advisor/${item.id}`)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selectMode) {
                        toggleSelect(item.id);
                      } else {
                        router.push(`/advisor/${item.id}`);
                      }
                    }
                  }}
                >
                  {/* Checkbox */}
                  <div className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${selectMode ? "w-5 opacity-100" : "w-0 -mr-4 opacity-0"}`}>
                    <div className="flex w-5 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="size-5 rounded-full"
                      />
                    </div>
                  </div>
                  {item.avatar_url ? (
                    <Image
                      src={item.avatar_url}
                      alt={item.analyzed_username}
                      width={36}
                      height={36}
                      className="size-9 shrink-0 rounded-full"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="font-mono text-xs font-bold uppercase">
                        {item.analyzed_username.slice(0, 2)}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate font-mono text-sm font-semibold text-foreground ${!selectMode ? "group-hover:text-primary" : ""}`}>
                        @{item.analyzed_username}
                      </span>
                    </div>
                    {item.analyzed_name && (
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <User className="size-3 shrink-0" />
                        {item.analyzed_name}
                      </p>
                    )}
                  </div>

                  {/* Version + Date + Arrow */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    {(versionMap.get(item.id) ?? 1) > 1 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                        V{versionMap.get(item.id)}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <Calendar className="size-3" />
                      {relativeDate(item.generated_at)}
                    </span>
                    <div className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${selectMode ? "w-0 opacity-0" : "w-7 opacity-100"}`}>
                      <ChevronRight className="ml-3 size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </AnimateOnView>

      {/* Select-all row when in select mode */}
      <AnimatePresence>
        {selectMode && filteredItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              onClick={() => toggleSelectAll(filteredIds)}
              className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-center font-mono text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground"
            >
              {allFilteredSelected ? "Deselect all" : `Select all ${filteredItems.length} items`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lg shadow-black/20">
              <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                {selected.size}
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                selected
              </span>
              <div className="mx-1 h-5 w-px bg-border" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 font-mono text-xs hover:brightness-125 transition-[filter]"
                    disabled={deleteAdvice.isPending}
                  >
                    <Trash2 className="size-3.5" />
                    {deleteAdvice.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-mono">Delete {selected.size} {selected.size === 1 ? "report" : "reports"}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The selected advisor {selected.size === 1 ? "report" : "reports"} will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-mono text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90 font-mono text-xs"
                      onClick={() => handleDelete((ids) => deleteAdvice.mutateAsync(ids))}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
