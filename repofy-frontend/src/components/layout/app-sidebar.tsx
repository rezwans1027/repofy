"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, FileText, GitCompareArrows, Lightbulb, CreditCard, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Search", icon: Search, number: 1 },
  { href: "/advisor", label: "Advisor", icon: Lightbulb, number: 2 },
  { href: "/reports", label: "Evals", icon: FileText, number: 3, comingSoon: true },
  { href: "/compare", label: "Compare", icon: GitCompareArrows, number: 4, comingSoon: true },
  { href: "/pricing", label: "Pricing", icon: CreditCard, number: 5 },
  { href: "/settings", label: "Settings", icon: Settings, number: 6 },
];

function isItemActive(href: string, pathname: string) {
  return (
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href === "/dashboard" && pathname.startsWith("/profile")) ||
    (href === "/reports" && (pathname.startsWith("/report/") || pathname.startsWith("/generate/"))) ||
    (href === "/advisor" && pathname.startsWith("/advisor/"))
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: left rail */}
      <nav className="fixed left-0 top-14 hidden h-[calc(100vh-3.5rem)] w-48 flex-col justify-center border-r border-border px-4 lg:flex">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, number }) => {
            const isActive = isItemActive(href, pathname);

            return (
              <li key={href} className="relative">
                {/* Sliding background pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-md bg-cyan/[0.06]"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}

                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                    isActive
                      ? "text-cyan"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <motion.span
                    className="font-mono text-xs opacity-50"
                    animate={isActive ? { opacity: 0.8 } : { opacity: 0.5 }}
                    transition={{ duration: 0.2 }}
                  >
                    {String(number).padStart(2, "0")}
                  </motion.span>

                  <Icon className="size-4" />

                  <span className="font-mono text-xs">{label}</span>

                  {/* Active dot indicator */}
                  <AnimatePresence mode="wait">
                    {isActive && (
                      <motion.span
                        key={href}
                        className="ml-auto flex items-center justify-center"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                          delay: 0.05,
                        }}
                      >
                        <span className="bg-cyan h-1.5 w-1.5 rounded-full" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: horizontal sticky bar */}
      <nav className="fixed top-14 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm lg:hidden">
        <div className="relative flex justify-center px-4 py-1.5 gap-6 sm:gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = isItemActive(href, pathname);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 font-mono text-xs",
                  isActive ? "text-cyan" : "text-muted-foreground"
                )}
              >
                {/* Mobile sliding underline */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-tab"
                    className="absolute inset-x-1 -bottom-1.5 h-[2px] rounded-full bg-cyan"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <Icon className="size-4.5 sm:size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
