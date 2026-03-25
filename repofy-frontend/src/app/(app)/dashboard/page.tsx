import type { Metadata } from "next";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";

export const metadata: Metadata = {
  title: "Search",
  description: "Search and analyze any GitHub developer profile.",
};

export default function DashboardPage() {
  return <DashboardPageContent />;
}
