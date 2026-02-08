"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ArrowRight, Search, ArrowUpDown, Check, Trash2, X, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdviceListItem {
  id: string;
  analyzed_username: string;
  generated_at: string;
  analyzed_name: string | null;
}

export default function AdvisorPage() {
  const [items, setItems] = useState<AdviceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("advice")
      .select("id, analyzed_username, analyzed_name, generated_at")
      .order("generated_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as AdviceListItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = items.filter((r) => {
      if (q && !r.analyzed_username.toLowerCase().includes(q) && !(r.analyzed_name?.toLowerCase().includes(q)))
        return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return (new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime()) * mul;
    });
  }, [items, searchQuery, sortDir]);

  const sortOptions = [
    { dir: "desc" as const, label: "Newest first" },
    { dir: "asc" as const, label: "Oldest first" },
  ];
  const currentSortLabel = sortOptions.find((o) => o.dir === sortDir)?.label ?? "Newest first";

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const ids = [...selected];
    await supabase.from("advice").delete().in("id", ids);
    setItems((prev) => prev.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-secondary/30 px-4 py-3">
            <div className="flex gap-12">
              {[64, 48, 48].map((w, i) => (
                <Skeleton key={i} className="h-3" style={{ width: w }} />
              ))}
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-12 border-b border-border last:border-0 px-4 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-4"
      >
        <h1 className="font-mono text-lg font-bold">Advisor</h1>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <Lightbulb className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 font-mono text-sm text-muted-foreground">
              No advice generated yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Search for a developer and get actionable profile advice.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 hover:underline"
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
      className="space-y-4"
    >
      <motion.h1
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="font-mono text-lg font-bold"
      >
        Advisor
      </motion.h1>

      {/* Filter bar */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-72 pl-8 font-mono text-xs"
          />
        </div>

        {/* Sort dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 font-mono text-xs">
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
          variant={selectMode ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 font-mono text-xs ml-auto"
          onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
        >
          {selectMode ? <X className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {selectMode ? "Cancel" : "Select"}
        </Button>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-x-auto rounded-lg border border-border bg-card"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className={`overflow-hidden transition-all duration-200 ease-out ${selectMode ? "w-10 px-3 py-3 opacity-100" : "w-0 max-w-0 p-0 opacity-0"}`}>
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  className="rounded-full"
                />
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Username
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={selectMode ? 4 : 3} className="px-4 py-12 text-center">
                  <p className="font-mono text-sm text-muted-foreground">No advice matches your search</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-2 font-mono text-xs text-emerald-400 hover:underline"
                  >
                    Clear search
                  </button>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`group border-b border-border last:border-0 transition-colors hover:bg-secondary/20 ${selectMode ? "cursor-pointer" : ""} ${selected.has(item.id) ? "bg-secondary/30" : ""}`}
                  onClick={selectMode ? () => toggleSelect(item.id) : undefined}
                >
                  <td className={`overflow-hidden transition-all duration-200 ease-out ${selectMode ? "w-10 px-3 py-3 opacity-100" : "w-0 max-w-0 p-0 opacity-0"}`}>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="rounded-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {selectMode ? (
                      <span className="font-mono text-sm font-bold">@{item.analyzed_username}</span>
                    ) : (
                      <Link
                        href={`/advisor/${item.id}`}
                        className="font-mono text-sm font-bold group-hover:text-emerald-400 transition-colors"
                      >
                        @{item.analyzed_username}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {item.analyzed_name || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(item.generated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
              <span className="font-mono text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 font-mono text-xs"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
