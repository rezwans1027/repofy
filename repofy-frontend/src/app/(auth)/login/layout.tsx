import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Repofy",
  description: "Sign in to Repofy with your GitHub account.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
