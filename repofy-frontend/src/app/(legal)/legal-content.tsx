"use client";

import { usePathname } from "next/navigation";

export function LegalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="py-12 sm:py-16">
      {children}
    </div>
  );
}
