import type { Metadata } from "next";
import { CREDIT_PACK_PRICE, CREDIT_PACK_SIZE } from "@/lib/constants";
import { PricingPageContent } from "@/components/pricing/pricing-page-content";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Get growth credits for AI-powered career advice. $${CREDIT_PACK_PRICE} for ${CREDIT_PACK_SIZE} credits.`,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Repofy Growth Credits",
  description:
    "2 growth credits for AI-powered career advice, skill radar, and personalized 12-week roadmaps.",
  offers: {
    "@type": "Offer",
    price: "9.00",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingPageContent />
    </>
  );
}
