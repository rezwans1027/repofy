import { Navbar } from "@/components/layout/navbar";
import { SectionNav } from "@/components/layout/section-nav";
import { PageContainer } from "@/components/layout/page-container";
import { Footer } from "@/components/layout/footer";
import { AnalysisInput } from "@/components/sections/analysis-input";
import { ProfileSummary } from "@/components/sections/profile-summary";
import { CodeDna } from "@/components/sections/code-dna";
import { LanguageFingerprint } from "@/components/sections/language-fingerprint";
import { CommitSignature } from "@/components/sections/commit-signature";
import { Verdict } from "@/components/sections/verdict";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";

export default function Home() {
  return (
    <>
      <Navbar />
      <SectionNav />
      <PageContainer>
        <AnalysisInput />
        <ProfileSummary />
        <CodeDna />
        <LanguageFingerprint />
        <CommitSignature />
        <Verdict />
        <HowItWorks />
        <Pricing />
      </PageContainer>
      <Footer />
    </>
  );
}
