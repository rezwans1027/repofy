import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  api: {
    post: mockPost,
  },
}));

import { FeedbackForm } from "./feedback-form";

describe("FeedbackForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ submitted: true });
  });

  it("submits the selected bug category", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);

    await user.click(screen.getByRole("radio", { name: "Bug Report" }));
    expect(screen.getByRole("button", { name: "Submit Bug Report" })).toBeDisabled();

    await user.type(
      screen.getByRole("textbox"),
      "The feedback category should stay on bug.",
    );
    await user.click(screen.getByRole("button", { name: "Submit Bug Report" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/feedback", {
        body: {
          category: "bug",
          message: "The feedback category should stay on bug.",
        },
      });
    });
  });

  it("submits the last selected category when the user switches types", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);

    await user.click(screen.getByRole("radio", { name: "General Feedback" }));
    await user.click(screen.getByRole("radio", { name: "Feature Request" }));
    expect(screen.getByText("Selected: Feature Request")).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox"),
      "Please add better reporting filters.",
    );
    await user.click(screen.getByRole("button", { name: "Submit Feature Request" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/feedback", {
        body: {
          category: "feature",
          message: "Please add better reporting filters.",
        },
      });
    });
  });
});
