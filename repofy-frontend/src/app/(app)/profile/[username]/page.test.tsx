import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { navModule } from "@/__tests__/helpers/mock-navigation";
import { createProfileFixture } from "@/__tests__/fixtures";

vi.mock("next/navigation", () => navModule);

type ProfileFixture = ReturnType<typeof createProfileFixture>;

const profileState = {
  data: null as ProfileFixture | null,
  isLoading: false,
  error: null as { message: string } | null,
};
vi.mock("@/hooks/use-github", () => ({
  useGitHubProfile: () => ({
    data: profileState.data,
    isLoading: profileState.isLoading,
    error: profileState.error,
  }),
}));

// StickyCTABar imports Supabase hooks so keep it mocked
vi.mock("@/components/profile/sticky-cta-bar", () => ({
  StickyCTABar: ({ username }: { username: string }) => (
    <div data-testid="sticky-cta-bar">{username}</div>
  ),
}));

import { ProfilePageContent } from "@/components/profile/profile-page-content";

function renderPage() {
  return render(<ProfilePageContent username="testuser" />);
}

describe("ProfilePageContent", () => {
  beforeEach(() => {
    profileState.data = null;
    profileState.isLoading = false;
    profileState.error = null;
  });

  it("shows loading skeletons when isLoading is true", () => {
    profileState.isLoading = true;

    renderPage();

    expect(
      screen.getByText("Fetching profile data from GitHub..."),
    ).toBeInTheDocument();
  });

  it("shows error card when error exists", () => {
    profileState.error = { message: "Not found" };

    renderPage();

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it('renders "back to search" link with href="/dashboard"', () => {
    renderPage();

    const link = screen.getByText("back to search");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("renders profile header with name and @username when data is loaded", () => {
    profileState.data = createProfileFixture();

    renderPage();

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();

    // Real ProfileSections renders stat labels and language data
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Stars Earned")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
    expect(screen.getAllByText(/TypeScript/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/60%/).length).toBeGreaterThan(0);
  });

  it("renders external GitHub link with target=_blank", () => {
    renderPage();

    const link = screen.getByText("View on GitHub");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://github.com/testuser",
    );
    expect(link.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("renders StickyCTABar when data is loaded", () => {
    profileState.data = createProfileFixture();

    renderPage();

    expect(screen.getByTestId("sticky-cta-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sticky-cta-bar")).toHaveTextContent("testuser");
  });
});
