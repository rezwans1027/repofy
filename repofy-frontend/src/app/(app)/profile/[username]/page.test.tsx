import { Suspense } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { navModule } from "@/__tests__/helpers/mock-navigation";
import { createProfileFixture } from "@/__tests__/fixtures";

vi.mock("next/navigation", () => navModule);

const profileState = {
  data: null as any,
  isLoading: false,
  error: null as any,
};
vi.mock("@/hooks/use-github", () => ({
  useGitHubProfile: () => ({
    data: profileState.data,
    isLoading: profileState.isLoading,
    error: profileState.error,
  }),
}));

// Mock child components to isolate page logic
vi.mock("@/components/profile/profile-sections", () => ({
  ProfileSections: () => <div data-testid="profile-sections" />,
}));
vi.mock("@/components/profile/sticky-cta-bar", () => ({
  StickyCTABar: ({ username }: any) => (
    <div data-testid="sticky-cta-bar">{username}</div>
  ),
}));
vi.mock("@/components/ui/animate-on-view", () => ({
  AnimateOnView: ({ children }: any) => <>{children}</>,
}));

import ProfilePage from "./page";

async function renderPage() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>loading suspense</div>}>
        <ProfilePage params={Promise.resolve({ username: "testuser" })} />
      </Suspense>,
    );
  });
  return result!;
}

describe("ProfilePage", () => {
  beforeEach(() => {
    profileState.data = null;
    profileState.isLoading = false;
    profileState.error = null;
  });

  it("shows loading skeletons when isLoading is true", async () => {
    profileState.isLoading = true;

    await renderPage();

    expect(
      screen.getByText("Fetching profile data from GitHub..."),
    ).toBeInTheDocument();
  });

  it("shows error card when error exists", async () => {
    profileState.error = { message: "Not found" };

    await renderPage();

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it('renders "back to search" link with href="/dashboard"', async () => {
    await renderPage();

    const link = screen.getByText("back to search");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("renders profile header with name and @username when data is loaded", async () => {
    profileState.data = createProfileFixture();

    await renderPage();

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders external GitHub link with target=_blank", async () => {
    await renderPage();

    const link = screen.getByText("View on GitHub");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://github.com/testuser",
    );
    expect(link.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("renders StickyCTABar when data is loaded", async () => {
    profileState.data = createProfileFixture();

    await renderPage();

    expect(screen.getByTestId("sticky-cta-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sticky-cta-bar")).toHaveTextContent("testuser");
  });
});
