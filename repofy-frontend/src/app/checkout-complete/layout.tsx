import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout Complete — Repofy",
  description: "Your payment status.",
  robots: { index: false, follow: false },
};

export default function CheckoutCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
