import { describe, it, expect, vi, afterEach } from "vitest";
import { relativeDate } from "@/lib/format";

afterEach(() => vi.useRealTimers());

describe("relativeDate", () => {
  it("returns 'Today' for a timestamp earlier today", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-07T09:00:00Z")).toBe("Today");
  });
  it("returns 'Yesterday' for the previous day", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-06T09:00:00Z")).toBe("Yesterday");
  });
  it("returns a day count for older dates", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-02T09:00:00Z")).toMatch(/5 days ago/);
  });
});
