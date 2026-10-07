import { describe, expect, it } from "vitest";
import { eventsOn, todayTasks } from "../src/lib/events";
import { toNewTask, toTaskPatch } from "../src/lib/validate";
import type { Task } from "../src/lib/types";

describe("validate", () => {
  it("cleans Claude output into a task", () => {
    expect(toNewTask({ title: "  Созвон ", project: "Клиенты", due: "2026-10-09", time: "12:00" }, "2026-10-07"))
      .toEqual({ title: "Созвон", project: "Клиенты", due: "2026-10-09", time: "12:00" });
    expect(toNewTask({ title: "x", project: "???", due: "пятница", time: "25:00" }, "2026-10-07"))
      .toEqual({ title: "x", project: "Личное", due: "2026-10-07", time: null });
    expect(toNewTask({ title: "  " }, "2026-10-07")).toBeNull();
  });
  it("keeps only known patch fields", () => {
    expect(toTaskPatch({ done: true, id: "evil", due: "bad" })).toEqual({ done: true });
  });
});

const t = (id: string, due: string, done = false, time: string | null = null): Task =>
  ({ id, title: id, project: "Личное", due, time, done, created_at: "" });

describe("events", () => {
  it("adds training on Tue/Thu/Sat and sorts by time", () => {
    const tr = { days: [2, 4, 6], start: "10:00", end: "12:30" };
    const ev = eventsOn("2026-10-06", [t("b", "2026-10-06", false, "20:00"), t("a", "2026-10-06", false, "09:00"), t("c", "2026-10-06")], tr);
    expect(ev.map((e) => e.title)).toEqual(["a", "Тренировка до 12:30", "b", "c"]);
    expect(eventsOn("2026-10-07", [], tr).length).toBe(0);
  });
  it("lists overdue open and today's tasks, open first", () => {
    const list = todayTasks([t("done-old", "2026-10-01", true), t("late", "2026-10-05"), t("todayDone", "2026-10-06", true), t("tomorrow", "2026-10-07"), t("today", "2026-10-06")], "2026-10-06");
    expect(list.map((x) => x.id)).toEqual(["late", "today", "todayDone"]);
  });
});
