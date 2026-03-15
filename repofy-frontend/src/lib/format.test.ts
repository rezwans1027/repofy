import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stripMarkdown, relativeDate, timeAgo } from "./format";

describe("stripMarkdown", () => {
  it("removes h1 headings", () => {
    expect(stripMarkdown("# Heading 1")).toBe("Heading 1");
  });

  it("removes h2 through h6 headings", () => {
    expect(stripMarkdown("## Heading 2")).toBe("Heading 2");
    expect(stripMarkdown("### Heading 3")).toBe("Heading 3");
    expect(stripMarkdown("#### Heading 4")).toBe("Heading 4");
    expect(stripMarkdown("##### Heading 5")).toBe("Heading 5");
    expect(stripMarkdown("###### Heading 6")).toBe("Heading 6");
  });

  it("removes bold formatting", () => {
    expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
  });

  it("removes italic formatting", () => {
    expect(stripMarkdown("This is *italic* text")).toBe("This is italic text");
  });

  it("removes bullet lists with dashes", () => {
    expect(stripMarkdown("- item one\n- item two")).toBe("item one\nitem two");
  });

  it("removes bullet lists with asterisks", () => {
    expect(stripMarkdown("* item one\n* item two")).toBe("item one\nitem two");
  });

  it("removes numbered lists", () => {
    expect(stripMarkdown("1. first\n2. second\n3. third")).toBe(
      "first\nsecond\nthird",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(stripMarkdown("  hello world  ")).toBe("hello world");
  });

  it("handles combined markdown", () => {
    const input = "## Summary\n\n**Bold** and *italic*\n\n- bullet one\n1. numbered";
    const expected = "Summary\n\nBold and italic\n\nbullet one\nnumbered";
    expect(stripMarkdown(input)).toBe(expected);
  });

  it("returns plain text unchanged (except trim)", () => {
    expect(stripMarkdown("plain text here")).toBe("plain text here");
  });
});

describe("relativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for same day', () => {
    expect(relativeDate("2025-06-15T08:00:00Z")).toBe("Today");
  });

  it('returns "Yesterday" for 1 day ago', () => {
    expect(relativeDate("2025-06-14T12:00:00Z")).toBe("Yesterday");
  });

  it('returns "3d ago" for 3 days ago', () => {
    expect(relativeDate("2025-06-12T12:00:00Z")).toBe("3d ago");
  });

  it("returns formatted date for 8+ days ago (same year)", () => {
    const result = relativeDate("2025-06-01T12:00:00Z");
    expect(result).toBe("Jun 1");
  });

  it("includes year for different year", () => {
    const result = relativeDate("2024-03-10T12:00:00Z");
    expect(result).toBe("Mar 10, 2024");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 60 seconds ago', () => {
    expect(timeAgo("2025-06-15T11:59:30Z")).toBe("just now");
  });

  it('returns "X min ago" for minutes', () => {
    expect(timeAgo("2025-06-15T11:55:00Z")).toBe("5 min ago");
  });

  it('returns "Xh ago" for hours', () => {
    expect(timeAgo("2025-06-15T09:00:00Z")).toBe("3h ago");
  });

  it('returns "1 day ago" for singular day', () => {
    expect(timeAgo("2025-06-14T12:00:00Z")).toBe("1 day ago");
  });

  it('returns "3 days ago" for plural days', () => {
    expect(timeAgo("2025-06-12T12:00:00Z")).toBe("3 days ago");
  });

  it('returns "1 week ago" for singular week', () => {
    expect(timeAgo("2025-06-08T12:00:00Z")).toBe("1 week ago");
  });

  it('returns "3 weeks ago" for plural weeks', () => {
    expect(timeAgo("2025-05-25T12:00:00Z")).toBe("3 weeks ago");
  });

  it('returns "2 months ago" for months', () => {
    expect(timeAgo("2025-04-15T12:00:00Z")).toBe("2 months ago");
  });

  it('returns "1 year ago" for singular year', () => {
    expect(timeAgo("2024-06-15T12:00:00Z")).toBe("1 year ago");
  });

  it('returns "2 years ago" for plural years', () => {
    expect(timeAgo("2023-06-15T12:00:00Z")).toBe("2 years ago");
  });
});
