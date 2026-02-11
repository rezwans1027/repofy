"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ReportListItem } from "@/hooks/use-reports";

interface CandidatePickerProps {
  reports: ReportListItem[];
  value: string;
  onValueChange: (id: string) => void;
  disabledId?: string;
  slot: "A" | "B";
  placeholder?: string;
}

export function CandidatePicker({
  reports,
  value,
  onValueChange,
  disabledId,
  slot,
  placeholder = "Search candidates…",
}: CandidatePickerProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();

  const borderColor =
    slot === "A"
      ? "border-cyan/50 hover:border-cyan"
      : "border-violet-400/50 hover:border-violet-400";
  const accentColor = slot === "A" ? "text-cyan" : "text-violet-400";

  const scoreColor = (score: number) =>
    score >= 80
      ? "text-emerald-400"
      : score >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const selected = reports.find((r) => r.id === value);

  return (
    <div data-testid={`candidate-picker-${slot.toLowerCase()}`} className="space-y-1.5">
      <p
        className={cn(
          "font-mono text-[10px] uppercase tracking-wider",
          accentColor
        )}
      >
        Candidate {slot}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-left font-mono text-xs transition-colors",
              borderColor,
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                <span className="font-bold">@{selected.analyzed_username}</span>
                <span className="text-muted-foreground">·</span>
                <span className={scoreColor(selected.overall_score)}>
                  {selected.overall_score}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {selected.recommendation}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Search className="size-3 text-muted-foreground" />
                {placeholder}
              </span>
            )}
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Type username or name…"
              className="font-mono text-xs"
            />
            <CommandList id={listboxId}>
              <CommandEmpty className="py-4 text-center font-mono text-xs text-muted-foreground">
                No candidates found.
              </CommandEmpty>
              <CommandGroup>
                {reports.map((r) => {
                  const isDisabled = r.id === disabledId;
                  const isSelected = r.id === value;
                  return (
                    <CommandItem
                      key={r.id}
                      value={`${r.analyzed_username} ${r.analyzed_name ?? ""}`}
                      disabled={isDisabled}
                      onSelect={() => {
                        onValueChange(r.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "font-mono text-xs",
                        isDisabled && "opacity-40"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-3.5",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex items-center gap-2 truncate">
                        <span className="font-bold">
                          @{r.analyzed_username}
                        </span>
                        {r.analyzed_name && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground truncate">
                              {r.analyzed_name}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground">·</span>
                        <span className={scoreColor(r.overall_score)}>
                          {r.overall_score}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {r.recommendation}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
