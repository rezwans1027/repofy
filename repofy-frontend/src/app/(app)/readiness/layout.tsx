import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private readiness", description: "Your private project evidence and role readiness workspace.",
  robots: { index: false, follow: false, noarchive: true },
  openGraph: { title: "Private readiness", description: "Private project evidence workspace." },
  twitter: { title: "Private readiness", description: "Private project evidence workspace." },
};
export default function ReadinessLayout({ children }: { children: React.ReactNode }) { return children; }
