import { loadFeatureCapabilities } from "@/lib/feature-capabilities";
import { IntakeUnavailable } from "@/components/readiness/intake-unavailable";
import { RepositoryPicker } from "@/components/readiness/repository-picker";

export default async function NewReadinessPage({ searchParams }: { searchParams: Promise<{ github?: string }> }) {
  const capabilities = await loadFeatureCapabilities();
  if (!capabilities.features.githubAppRepositoriesEnabled) return <IntakeUnavailable />;
  return <RepositoryPicker connectionStatus={(await searchParams).github} />;
}
