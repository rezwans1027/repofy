import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import "./globals.css";

const inter = localFont({
  src: "../fonts/Inter-Variable-Latin.woff2",
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../fonts/JetBrainsMono-Variable-Latin.woff2",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://repofy.dev",
  ),
  title: {
    default: "Repofy — Hiring-Grade Developer Evaluations",
    template: "%s — Repofy",
  },
  description:
    "Analyze any GitHub profile. Get a hiring-grade developer evaluation powered by code analysis, not resumes.",
  openGraph: {
    type: "website",
    siteName: "Repofy",
    title: "Repofy — Hiring-Grade Developer Evaluations",
    description:
      "Analyze any GitHub profile. Get a hiring-grade developer evaluation powered by code analysis, not resumes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Repofy — Hiring-Grade Developer Evaluations",
    description:
      "Analyze any GitHub profile. Get a hiring-grade developer evaluation powered by code analysis, not resumes.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        id="overlay-scrollbar-target"
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-cyan focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-semibold focus:text-background"
        >
          Skip to main content
        </a>
        <ThemeProvider nonce={nonce}>
          <MotionProvider>
            <AuthProvider>
                <OverlayScrollbar />
                {children}
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
