"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { useSelectableList } from "@/hooks/use-selectable-list";
import { relativeDate } from "@/lib/format";

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function AdvisorPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { data: items = [], isLoading: queryLoading } = useAdviceList();
  const loading = authLoading || queryLoading;
  const deleteAdvice = useDeleteAdvice();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const {
    selected,
    selectMode,
    setSelectMode,
    toggleSelect,
    toggleSelectAll,
    exitSelectMode,
    handleDelete,
  } = useSelectableList();

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

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-4"
      >
        <h1 className="font-mono text-lg font-bold">Advisor</h1>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-secondary/50">
              <Lightbulb className="size-6 text-muted-foreground/50" />
            </div>
            <p className="mt-4 font-mono text-sm font-medium text-foreground">
              No advice generated yet
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Search for a developer and get actionable profile advice.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 font-mono text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-400/10"
            >
              Go to search
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-5"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12, filter: "blur(6px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-baseline justify-between"
      >
        <h1 className="font-mono text-lg font-bold">Advisor</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "report" : "reports"}
        </span>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12, filter: "blur(6px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center gap-2"
      >
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
      </motion.div>

      {/* Card list */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
        className="space-y-2"
      >
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
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
                  variants={itemVariants}
                  exit={{ opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  layout
                  className={`group relative flex items-center gap-4 rounded-xl border p-4 transition-colors duration-200 ${
                    isSelected
                      ? "border-primary/30 bg-primary/[0.04]"
                      : "border-border bg-card hover:border-border hover:bg-secondary/30"
                  } cursor-pointer`}
                  onClick={selectMode ? () => toggleSelect(item.id) : () => router.push(`/advisor/${item.id}`)}
                >
                  {/* Checkbox */}
                  <div className={`overflow-hidden transition-all duration-200 ease-out ${selectMode ? "w-5 opacity-100" : "w-0 -mr-4 opacity-0"}`}>
                    <div className="flex w-5 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="size-5 rounded-full"
                      />
                    </div>
                  </div>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="font-mono text-xs font-bold uppercase">
                      {item.analyzed_username.slice(0, 2)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate font-mono text-sm font-semibold text-foreground transition-colors ${!selectMode ? "group-hover:text-primary" : ""}`}>
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

                  {/* Date + Arrow */}
                  <div className="flex shrink-0 items-center">
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <Calendar className="size-3" />
                      {relativeDate(item.generated_at)}
                    </span>
                    <div className={`overflow-hidden transition-all duration-200 ease-out ${selectMode ? "w-0 opacity-0" : "w-7 opacity-100"}`}>
                      <ChevronRight className="ml-3 size-4 text-muted-foreground/30 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </motion.div>

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
              className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-center font-mono text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
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
                    className="h-8 gap-1.5 font-mono text-xs"
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
    </motion.div>
  );
}
