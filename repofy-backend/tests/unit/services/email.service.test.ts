import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/resend", () => ({
  getResend: vi.fn(),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  maskEmail: vi.fn((email: string) => {
    const at = email.indexOf("@");
    return at > 0 ? email[0] + "***" + email.slice(at) : "***";
  }),
}));

import { escapeHtml, sendFeedbackNotificationEmail, sendOtpEmail } from "../../../src/services/email.service";
import { getResend } from "../../../src/config/resend";
import { logger, maskEmail } from "../../../src/lib/logger";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("a 'b' c")).toBe("a &#39;b&#39; c");
  });

  it("escapes all five characters together", () => {
    expect(escapeHtml(`<div class="x" data-name='y'>&</div>`)).toBe(
      "&lt;div class=&quot;x&quot; data-name=&#39;y&#39;&gt;&amp;&lt;/div&gt;",
    );
  });

  it("neutralises script injection", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  });

  it("neutralises attribute injection via double quote", () => {
    expect(escapeHtml('" onmouseover="alert(1)"')).toBe(
      "&quot; onmouseover=&quot;alert(1)&quot;",
    );
  });

  it("neutralises attribute injection via single quote", () => {
    expect(escapeHtml("' onfocus='alert(1)'")).toBe(
      "&#39; onfocus=&#39;alert(1)&#39;",
    );
  });

  it("neutralises nested/combined injection patterns", () => {
    const input = `<img src="x" onerror="alert('<script>')">`;
    expect(escapeHtml(input)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;&lt;script&gt;&#39;)&quot;&gt;",
    );
  });

  it("neutralises event handler injection in tag", () => {
    expect(escapeHtml('<a href="#" onclick="steal()">')).toBe(
      "&lt;a href=&quot;#&quot; onclick=&quot;steal()&quot;&gt;",
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through string with no special characters", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("passes through unicode characters without modification", () => {
    expect(escapeHtml("Caf\u00e9 \u2603 \u2764\ufe0f")).toBe("Caf\u00e9 \u2603 \u2764\ufe0f");
  });

  it("handles string that is only special characters", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("handles repeated special characters", () => {
    expect(escapeHtml("<<<>>>")).toBe("&lt;&lt;&lt;&gt;&gt;&gt;");
  });

  it("handles ampersand at the start to avoid double-escaping confusion", () => {
    // Verifies & is escaped first, so &lt; in input becomes &amp;lt;
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("handles multiline strings", () => {
    const input = "line1 <b>\nline2 & 'stuff'";
    expect(escapeHtml(input)).toBe("line1 &lt;b&gt;\nline2 &amp; &#39;stuff&#39;");
  });
});

const mockGetResend = getResend as ReturnType<typeof vi.fn>;
const mockLogger = logger as { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

function mockResend(sendResult: { error: unknown } = { error: null }) {
  const sendFn = vi.fn().mockResolvedValue(sendResult);
  const client = { emails: { send: sendFn } };
  mockGetResend.mockReturnValue(client);
  return { client, sendFn };
}

describe("sendOtpEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resend.emails.send with correct from/to/subject", async () => {
    const { sendFn } = mockResend();

    await sendOtpEmail("alice@test.com", "123456", "Alice");

    expect(sendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Repofy <noreply@repofy.app>",
        to: "alice@test.com",
        subject: "Your Repofy verification code",
      }),
    );
  });

  it("HTML body contains escaped displayName and OTP code", async () => {
    const { sendFn } = mockResend();

    await sendOtpEmail("alice@test.com", "654321", "<script>Alice</script>");

    const html = sendFn.mock.calls[0][0].html as string;
    expect(html).toContain("&lt;script&gt;Alice&lt;/script&gt;");
    expect(html).toContain("654321");
  });

  it("logs success with masked email", async () => {
    mockResend();

    await sendOtpEmail("alice@test.com", "123456", "Alice");

    expect(maskEmail).toHaveBeenCalledWith("alice@test.com");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "OTP email sent",
      expect.objectContaining({ email: "a***@test.com" }),
    );
  });

  it("throws 'Failed to send verification email' on Resend error", async () => {
    mockResend({ error: { message: "Rate limited" } });

    await expect(
      sendOtpEmail("alice@test.com", "123456", "Alice"),
    ).rejects.toThrow("Failed to send verification email");
  });

  it("logs error with masked email on failure", async () => {
    mockResend({ error: { message: "Rate limited" } });

    await expect(
      sendOtpEmail("alice@test.com", "123456", "Alice"),
    ).rejects.toThrow();

    expect(maskEmail).toHaveBeenCalledWith("alice@test.com");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to send OTP email",
      expect.objectContaining({ email: "a***@test.com" }),
    );
  });
});

describe("sendFeedbackNotificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resend.emails.send with correct recipient, subject, and replyTo", async () => {
    const { sendFn } = mockResend();

    await sendFeedbackNotificationEmail({
      category: "bug",
      message: "Something broke",
      userId: "user-123",
      userEmail: "alice@test.com",
      submittedAt: "2026-03-25T12:00:00.000Z",
    });

    expect(sendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Repofy <noreply@repofy.app>",
        to: "feedback@test.com",
        replyTo: "alice@test.com",
        subject: "[Repofy] New Bug Report from alice@test.com",
      }),
    );
  });

  it("HTML body escapes the message and uses the user-facing category label", async () => {
    const { sendFn } = mockResend();

    await sendFeedbackNotificationEmail({
      category: "feature",
      message: "<script>alert('xss')</script>\nLine two",
      userId: "user-123",
      userEmail: "alice@test.com",
      submittedAt: "2026-03-25T12:00:00.000Z",
    });

    const html = sendFn.mock.calls[0][0].html as string;
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;<br />Line two");
    expect(html).toContain("Feature Request");
    expect(html).toContain("alice@test.com");
    expect(html).toContain("user-123");
    expect(html).toContain("2026-03-25T12:00:00.000Z");
  });

  it("omits replyTo when userEmail is unavailable", async () => {
    const { sendFn } = mockResend();

    await sendFeedbackNotificationEmail({
      category: "feedback",
      message: "General note",
      userId: "user-123",
      submittedAt: "2026-03-25T12:00:00.000Z",
    });

    expect(sendFn.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });

  it("logs success with masked recipient and sender emails", async () => {
    mockResend();

    await sendFeedbackNotificationEmail({
      category: "bug",
      message: "Something broke",
      userId: "user-123",
      userEmail: "alice@test.com",
      submittedAt: "2026-03-25T12:00:00.000Z",
    });

    expect(maskEmail).toHaveBeenCalledWith("feedback@test.com");
    expect(maskEmail).toHaveBeenCalledWith("alice@test.com");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Feedback notification email sent",
      expect.objectContaining({
        recipientEmail: "f***@test.com",
        userEmail: "a***@test.com",
        userId: "user-123",
        category: "bug",
      }),
    );
  });

  it("throws when Resend returns an error", async () => {
    mockResend({ error: { message: "Rate limited" } });

    await expect(
      sendFeedbackNotificationEmail({
        category: "bug",
        message: "Something broke",
        userId: "user-123",
        userEmail: "alice@test.com",
        submittedAt: "2026-03-25T12:00:00.000Z",
      }),
    ).rejects.toThrow("Failed to send feedback notification email");
  });

  it("logs error with masked recipient and sender emails on failure", async () => {
    mockResend({ error: { message: "Rate limited" } });

    await expect(
      sendFeedbackNotificationEmail({
        category: "bug",
        message: "Something broke",
        userId: "user-123",
        userEmail: "alice@test.com",
        submittedAt: "2026-03-25T12:00:00.000Z",
      }),
    ).rejects.toThrow();

    expect(maskEmail).toHaveBeenCalledWith("feedback@test.com");
    expect(maskEmail).toHaveBeenCalledWith("alice@test.com");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to send feedback notification email",
      expect.objectContaining({
        recipientEmail: "f***@test.com",
        userEmail: "a***@test.com",
        userId: "user-123",
        category: "bug",
      }),
    );
  });
});
