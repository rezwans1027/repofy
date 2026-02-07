"use client";

import { SECTIONS, SectionId } from "@/lib/constants";
import { useActiveSection } from "@/hooks/use-active-section";
import { cn } from "@/lib/utils";

export function SectionNav() {
  const activeSection = useActiveSection();

  const scrollTo = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Desktop: left rail */}
      <nav className="fixed left-0 top-14 hidden h-[calc(100vh-3.5rem)] w-48 flex-col justify-center border-r border-border px-4 lg:flex">
        <ul className="space-y-1">
          {SECTIONS.map(({ id, label, number }) => (
            <li key={id}>
              <button
                onClick={() => scrollTo(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  activeSection === id
                    ? "text-cyan bg-cyan/5"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-mono text-xs opacity-50">
                  {String(number).padStart(2, "0")}
                </span>
                <span className="font-mono text-xs">{label}</span>
                {activeSection === id && (
                  <span className="bg-cyan ml-auto h-1.5 w-1.5 rounded-full" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile: horizontal sticky bar */}
      <nav className="fixed top-14 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm lg:hidden">
        <div className="no-scrollbar flex overflow-x-auto px-4 py-2">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={cn(
                "whitespace-nowrap px-3 py-1 font-mono text-xs transition-colors",
                activeSection === id
                  ? "text-cyan"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
