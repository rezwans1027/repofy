import dynamic from "next/dynamic";
import { Navbar } from "@/components/layout/navbar";
import { SectionNav } from "@/components/layout/section-nav";
import { PageContainer } from "@/components/layout/page-container";
import { Footer } from "@/components/layout/footer";
import { QueryProvider } from "@/components/providers/query-provider";
import { Hero } from "@/components/sections/hero";
import { FeaturesOverview } from "@/components/sections/features-overview";

const AnalysisPreview = dynamic(() =>
  import("@/components/sections/analysis-preview").then((m) => ({ default: m.AnalysisPreview })),
);
const AdvisorPreview = dynamic(() =>
  import("@/components/sections/advisor-preview").then((m) => ({ default: m.AdvisorPreview })),
);
const ComparePreview = dynamic(() =>
  import("@/components/sections/compare-preview").then((m) => ({ default: m.ComparePreview })),
);
const HowItWorks = dynamic(() =>
  import("@/components/sections/how-it-works").then((m) => ({ default: m.HowItWorks })),
);
const Pricing = dynamic(() =>
  import("@/components/sections/pricing").then((m) => ({ default: m.Pricing })),
);
const FinalCta = dynamic(() =>
  import("@/components/sections/final-cta").then((m) => ({ default: m.FinalCta })),
);

export default function Home() {
  return (
    <QueryProvider>
      <Navbar />
      <SectionNav />
      <PageContainer>
        <Hero />
        <FeaturesOverview />
        <AdvisorPreview />
        <AnalysisPreview />
        <ComparePreview />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </PageContainer>
      <Footer />
    </QueryProvider>
  );
}
