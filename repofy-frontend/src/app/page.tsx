import { Navbar } from "@/components/layout/navbar";
import { SectionNav } from "@/components/layout/section-nav";
import { PageContainer } from "@/components/layout/page-container";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { FeaturesOverview } from "@/components/sections/features-overview";
import { AnalysisPreview } from "@/components/sections/analysis-preview";
import { AdvisorPreview } from "@/components/sections/advisor-preview";
import { ComparePreview } from "@/components/sections/compare-preview";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Navbar />
      <SectionNav />
      <PageContainer>
        <Hero />
        <FeaturesOverview />
        <AnalysisPreview />
        <AdvisorPreview />
        <ComparePreview />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </PageContainer>
      <Footer />
    </>
  );
}
