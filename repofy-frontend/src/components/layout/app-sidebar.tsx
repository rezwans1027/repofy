"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Search", icon: Search, number: 1 },
  { href: "/settings", label: "Settings", icon: Settings, number: 2 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: left rail */}
      <nav className="fixed left-0 top-14 hidden h-[calc(100vh-3.5rem)] w-48 flex-col justify-between border-r border-border px-4 py-6 lg:flex">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, number }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/") ||
              (href === "/dashboard" && pathname.startsWith("/profile"));

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "text-cyan bg-cyan/5"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="font-mono text-xs opacity-50">
                    {String(number).padStart(2, "0")}
                  </span>
                  <Icon className="size-4" />
                  <span className="font-mono text-xs">{label}</span>
                  {isActive && (
                    <span className="bg-cyan ml-auto h-1.5 w-1.5 rounded-full" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: horizontal sticky bar */}
      <nav className="fixed top-14 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm lg:hidden">
        <div className="flex px-4 py-2 gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/") ||
              (href === "/dashboard" && pathname.startsWith("/profile"));

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-3 py-1 font-mono text-xs transition-colors",
                  isActive ? "text-cyan" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
