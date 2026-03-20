import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock api-client
const mockPost = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn(), post: mockPost, delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, isLoading: false, refresh: mockRefresh }),
}));

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/login";
vi.mock("next/navigation", () => navModule);

import LoginPage from "./page";

function getSubmitButton() {
  return screen.getByRole("button", { name: /sign in/i });
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/login";
  });

  it("renders login form with email and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(getSubmitButton()).toBeInTheDocument();
  });

  it("renders link to signup", () => {
    render(<LoginPage />);
    const signupButton = screen.getByRole("button", { name: /sign up/i });
    expect(signupButton).toBeInTheDocument();
  });

  it("shows email validation error for empty email", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(getSubmitButton());

    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("shows email validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "notanemail");
    await user.click(getSubmitButton());

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });

  it("shows password validation error for empty password", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.click(getSubmitButton());

    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("calls api.post /auth/login and redirects on success", async () => {
    mockPost.mockResolvedValue({ user: { id: "1", email: "test@example.com" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(getSubmitButton());

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      body: { email: "test@example.com", password: "password123" },
    });
    expect(mockRefresh).toHaveBeenCalled();
    expect(navState.push).toHaveBeenCalledWith("/dashboard");
    expect(navState.refresh).toHaveBeenCalled();
  });

  it("shows error message on authentication failure", async () => {
    const { ApiError } = await import("@/lib/api-client");
    mockPost.mockRejectedValue(new ApiError("Invalid credentials", 401));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await user.click(getSubmitButton());

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("clears field errors on typing", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Submit empty form to trigger errors
    await user.click(getSubmitButton());
    expect(screen.getByText("Email is required")).toBeInTheDocument();

    // Type in email field should clear email error
    await user.type(screen.getByPlaceholderText("you@example.com"), "a");
    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
  });
});
