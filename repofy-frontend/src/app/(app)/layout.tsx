"use client";

import { Navbar } from "@/components/layout/navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { QueryProvider } from "@/components/providers/query-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <Navbar />
      <AppSidebar />
      <main className="min-h-screen pt-14 lg:pl-48">
        {/* Extra top padding on mobile for the horizontal nav */}
        <div className="pt-10 lg:pt-0">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </QueryProvider>
  );
}
