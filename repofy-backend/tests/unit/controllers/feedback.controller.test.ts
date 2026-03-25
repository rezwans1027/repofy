import { beforeEach, describe, expect, it, vi } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

const {
  mockInsert,
  mockFrom,
  mockGetSupabaseAdmin,
  mockSendFeedbackNotificationEmail,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSupabaseAdmin: vi.fn(),
  mockSendFeedbackNotificationEmail: vi.fn(),
}));

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

vi.mock("../../../src/services/email.service", () => ({
  sendFeedbackNotificationEmail: mockSendFeedbackNotificationEmail,
}));

import { submitFeedback } from "../../../src/controllers/feedback.controller";

describe("submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });
    mockSendFeedbackNotificationEmail.mockResolvedValue(undefined);
  });

  it("returns 401 when authentication is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { category: "bug", message: "Something broke badly" };

    await submitFeedback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Authentication required",
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendFeedbackNotificationEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid category", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { category: "other", message: "Something broke badly" };

    await submitFeedback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Category must be one of: bug, feature, feedback",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 when the message is too short", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { category: "bug", message: "short" };

    await submitFeedback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Message must be at least 10 characters",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 when the message is too long", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { category: "bug", message: "x".repeat(2001) };

    await submitFeedback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Message must be at most 2000 characters",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db failed" } });
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { category: "bug", message: "Something broke badly" };

    await submitFeedback(req, res, next);

    expect(mockFrom).toHaveBeenCalledWith("feedback");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      category: "bug",
      message: "Something broke badly",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to submit feedback",
    });
    expect(mockSendFeedbackNotificationEmail).not.toHaveBeenCalled();
  });

  it("stores trimmed feedback and sends a notification email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).userEmail = "alice@test.com";
    (req as any).body = {
      category: "feature",
      message: "  Please add better exports\nfor reports.  ",
    };

    await submitFeedback(req, res, next);

    expect(mockFrom).toHaveBeenCalledWith("feedback");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      category: "feature",
      message: "Please add better exports\nfor reports.",
    });
    expect(mockSendFeedbackNotificationEmail).toHaveBeenCalledWith({
      category: "feature",
      message: "Please add better exports\nfor reports.",
      userId: "user-123",
      userEmail: "alice@test.com",
      submittedAt: expect.any(String),
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { submitted: true },
    });
  });

  it("still returns success when the notification email fails", async () => {
    mockSendFeedbackNotificationEmail.mockRejectedValue(new Error("resend failed"));
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).userEmail = "alice@test.com";
    (req as any).body = { category: "feedback", message: "This is useful feedback." };

    await submitFeedback(req, res, next);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      category: "feedback",
      message: "This is useful feedback.",
    });
    expect(mockSendFeedbackNotificationEmail).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { submitted: true },
    });
  });
});
