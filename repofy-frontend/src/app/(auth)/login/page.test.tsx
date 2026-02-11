import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock supabase client
const mockSignIn = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}));

// Track router calls
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from "./page";

function getSubmitButton() {
  return screen.getByRole("button", { name: /sign in/i });
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form with email and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(getSubmitButton()).toBeInTheDocument();
  });

  it("renders link to signup", () => {
    render(<LoginPage />);
    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toHaveAttribute("href", "/signup");
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

  it("calls signInWithPassword and redirects on success", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(getSubmitButton());

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows error message on authentication failure", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
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
