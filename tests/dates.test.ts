import { describe, expect, it } from "vitest";
import { addDays, diffDays, fd, monthGrid, todayISO, weekDays } from "../src/lib/dates";

describe("dates", () => {
  it("uses Tashkent time for today", () => {
    // 2026-10-06 20:30 UTC is already 7 October in Tashkent (UTC+5)
    expect(todayISO(new Date("2026-10-06T20:30:00Z"))).toBe("2026-10-07");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(diffDays("2026-11-01", "2026-10-30")).toBe(2);
  });
  it("formats relative days", () => {
    expect(fd("2026-10-06", "2026-10-06")).toBe("сегодня");
    expect(fd("2026-10-07", "2026-10-06")).toBe("завтра");
    expect(fd("2026-10-05", "2026-10-06")).toBe("вчера");
    expect(fd("2026-10-12", "2026-10-06")).toBe("12 окт");
  });
  it("builds Monday-first weeks and months", () => {
    expect(weekDays("2026-10-06")[0]).toBe("2026-10-05");
    expect(weekDays("2026-10-11")[6]).toBe("2026-10-11");
    const g = monthGrid("2026-10-06");
    expect(g.lead).toBe(3); // 1 Oct 2026 is a Thursday
    expect(g.days).toHaveLength(31);
  });
});
