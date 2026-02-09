"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ArrowRight, Search, Filter, ArrowUpDown, Check, Trash2, X, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReports, useDeleteReports, type ReportListItem } from "@/hooks/use-reports";

export default function ReportsPage() {
  const { data: reports = [], isLoading: loading } = useReports();
  const deleteReports = useDeleteReports();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allRecs = ["Strong Hire", "Hire", "Weak Hire", "No Hire"] as const;

  const toggleRec = (rec: string) => {
    setSelectedRecs((prev) => {
      const next = new Set(prev);
      if (next.has(rec)) next.delete(rec);
      else next.add(rec);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRecs(new Set());
    setScoreMin(0);
    setScoreMax(100);
    setSortBy("date");
    setSortDir("desc");
  };

  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = reports.filter((r: ReportListItem) => {
      if (q && !r.analyzed_username.toLowerCase().includes(q) && !(r.analyzed_name?.toLowerCase().includes(q)))
        return false;
      if (selectedRecs.size > 0 && !selectedRecs.has(r.recommendation))
        return false;
      if (r.overall_score < scoreMin || r.overall_score > scoreMax) return false;
      return true;
    });

    return filtered.sort((a: ReportListItem, b: ReportListItem) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortBy === "score") return (a.overall_score - b.overall_score) * mul;
      return (new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime()) * mul;
    });
  }, [reports, searchQuery, selectedRecs, scoreMin, scoreMax, sortBy, sortDir]);

  const scoreColor = (score: number) =>
    score >= 80
      ? "text-emerald-400"
      : score >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const activeFilterCount = (selectedRecs.size > 0 ? 1 : 0) + (scoreMin > 0 || scoreMax < 100 ? 1 : 0);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filteredReports.length > 0 && filteredReports.every((r: ReportListItem) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredReports.forEach((r: ReportListItem) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredReports.forEach((r: ReportListItem) => next.add(r.id));
        return next;
      });
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  async function handleDelete() {
    const ids = [...selected];
    await deleteReports.mutateAsync(ids);
    setSelected(new Set());
    setSelectMode(false);
  }

  const sortOptions = [
    { by: "date" as const, dir: "desc" as const, label: "Newest first" },
    { by: "date" as const, dir: "asc" as const, label: "Oldest first" },
    { by: "score" as const, dir: "desc" as const, label: "Highest score" },
    { by: "score" as const, dir: "asc" as const, label: "Lowest score" },
  ];
  const currentSortLabel = sortOptions.find((o) => o.by === sortBy && o.dir === sortDir)?.label ?? "Newest first";

  const recStyle = (rec: string) => {
    switch (rec) {
      case "Strong Hire":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "Hire":
        return "bg-cyan/15 text-cyan border-cyan/30";
      case "Weak Hire":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "No Hire":
        return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-secondary text-muted-foreground border-border";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-secondary/30 px-4 py-3">
            <div className="flex gap-12">
              {[64, 48, 32, 56, 48].map((w, i) => (
                <Skeleton key={i} className="h-3" style={{ width: w }} />
              ))}
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-12 border-b border-border last:border-0 px-4 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-4"
      >
        <h1 className="font-mono text-lg font-bold">Reports</h1>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 font-mono text-sm text-muted-foreground">
              No reports yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Search for a developer and generate your first analysis.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-cyan hover:underline"
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
        Reports
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

        {/* Filter dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 font-mono text-xs">
              <Filter className="size-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-cyan text-[10px] font-bold text-black">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recommendation</p>
              <div className="flex flex-wrap gap-1.5">
                {allRecs.map((rec) => (
                  <button key={rec} type="button" onClick={() => toggleRec(rec)}>
                    <Badge
                      className={`border text-[10px] cursor-pointer transition-opacity ${recStyle(rec)} ${
                        selectedRecs.size > 0 && !selectedRecs.has(rec) ? "opacity-30" : ""
                      }`}
                    >
                      {rec}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Score range</p>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[scoreMin, scoreMax]}
                onValueChange={([lo, hi]) => { setScoreMin(lo); setScoreMax(hi); }}
                className="[&_[data-slot=slider-range]]:bg-cyan [&_[data-slot=slider-thumb]]:border-cyan"
              />
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={scoreMax}
                  value={scoreMin}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(Number(e.target.value) || 0, scoreMax));
                    setScoreMin(v);
                  }}
                  className="h-7 w-16 font-mono text-xs text-center"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={scoreMin}
                  max={100}
                  value={scoreMax}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(Number(e.target.value) || 0, scoreMin));
                    setScoreMax(v);
                  }}
                  className="h-7 w-16 font-mono text-xs text-center"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

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
                onClick={() => { setSortBy(opt.by); setSortDir(opt.dir); }}
              >
                <Check className={`size-3.5 ${sortBy === opt.by && sortDir === opt.dir ? "opacity-100" : "opacity-0"}`} />
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
                Score
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recommendation
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={selectMode ? 6 : 5} className="px-4 py-12 text-center">
                  <p className="font-mono text-sm text-muted-foreground">No reports match your filters</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 font-mono text-xs text-cyan hover:underline"
                  >
                    Clear all filters
                  </button>
                </td>
              </tr>
            ) : (
              filteredReports.map((report: ReportListItem) => (
                <tr
                  key={report.id}
                  className={`group border-b border-border last:border-0 transition-colors hover:bg-secondary/20 ${selectMode ? "cursor-pointer" : ""} ${selected.has(report.id) ? "bg-secondary/30" : ""}`}
                  onClick={selectMode ? () => toggleSelect(report.id) : undefined}
                >
                  <td className={`overflow-hidden transition-all duration-200 ease-out ${selectMode ? "w-10 px-3 py-3 opacity-100" : "w-0 max-w-0 p-0 opacity-0"}`}>
                    <Checkbox
                      checked={selected.has(report.id)}
                      onCheckedChange={() => toggleSelect(report.id)}
                      className="rounded-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {selectMode ? (
                      <span className="font-mono text-sm font-bold">@{report.analyzed_username}</span>
                    ) : (
                      <Link
                        href={`/report/${report.id}`}
                        className="font-mono text-sm font-bold group-hover:text-cyan transition-colors"
                      >
                        @{report.analyzed_username}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {report.analyzed_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm font-bold ${scoreColor(report.overall_score)}`}>
                      {report.overall_score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-[10px] ${recStyle(report.recommendation)}`}>
                      {report.recommendation}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(report.generated_at).toLocaleDateString("en-US", {
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
                disabled={deleteReports.isPending}
              >
                <Trash2 className="size-3.5" />
                {deleteReports.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
