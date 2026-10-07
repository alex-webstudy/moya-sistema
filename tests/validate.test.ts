import { describe, expect, it } from "vitest";
import { eventsOn, todayTasks } from "../src/lib/events";
import { toNewTask, toTaskPatch } from "../src/lib/validate";
import { EMPTY_RECORDS } from "./helpers";
import { subtree, taskReport } from "../src/lib/folders";
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
    const p = toTaskPatch({ done: true, id: "evil", due: "bad", folder_id: "nope" });
    expect(Object.keys(p).sort()).toEqual(["done", "done_at", "folder_id"]);
    expect(p.done_at).toMatch(/^\d{4}-/);
    expect(p.folder_id).toBeNull();
    expect(toTaskPatch({ done: false })).toEqual({ done: false, done_at: null });
    const id = "0b9f1c9e-3f4a-4c55-9d7e-2a1b3c4d5e6f";
    expect(toTaskPatch({ folder_id: id })).toEqual({ folder_id: id });
    expect(toNewTask({ title: "x", folder_id: id }, "2026-10-07")?.folder_id).toBe(id);
  });
});

const t = (id: string, due: string, done = false, time: string | null = null): Task =>
  ({ id, title: id, project: "Личное", due, time, done, created_at: "" });

describe("events", () => {
  it("adds training on Tue/Thu/Sat and sorts by time", () => {
    const tr = { days: [2, 4, 6], start: "10:00", end: "12:30" };
    const cal = (tasks: Task[], rec = {}) => ({ tasks, rec: { ...EMPTY_RECORDS(), ...rec }, settings: { training: tr }, today: "2026-10-07" });
    const ev = eventsOn("2026-10-06", cal([t("b", "2026-10-06", false, "20:00"), t("a", "2026-10-06", false, "09:00"), t("c", "2026-10-06")]));
    expect(ev.map((e) => e.title)).toEqual(["a", "Тренировка до 12:30", "b", "c"]);
    expect(eventsOn("2026-10-07", cal([])).length).toBe(0);
  });
  it("shows payments, client money and content, done ones marked", () => {
    const tr = { days: [], start: "10:00", end: "12:30" };
    const rec = {
      ...EMPTY_RECORDS(),
      charges: [
        { id: "c1", created_at: "", type: "credit" as const, name: "Ипотека", bank: "", sum: 100, day: 5, start: null, until: null, paid_to: "2026-10-05" },
        { id: "c2", created_at: "", type: "sub" as const, name: "Сервис", bank: "", sum: 10, day: 31, start: null, until: null, paid_to: null },
      ],
      clients: [{ id: "k", created_at: "", name: "Ромашка", work: "", contract: 2, sum: 5, due: null, paid: false, last_contact: "2026-10-01", waiting: "", contract_no: "", contract_from: null, contract_until: null, pay_day: 5 }],
      income: [{ id: "i", created_at: "", date: "2026-10-06", source: "Ромашка", note: "", sum: 5, orig: "", client_id: "k", account: "rs" as const, invoice_id: null }],
      ideas: [{ id: "p", created_at: "", title: "Рилс", platform: "ig" as const, format: "reels", why: "", approved: true, status: 3, date: "2026-10-05", reach: null, leads: null, script: "" }],
    };
    const ev = eventsOn("2026-10-05", { tasks: [t("x", "2026-10-05", true)], rec, settings: { training: tr }, today: "2026-10-07" });
    expect(ev.map((e) => [e.title.split(" ·")[0], !!e.done])).toEqual([
      ["x", true], ["Платёж: Ипотека", true], ["Оплата: Ромашка", true], ["Публикация: Рилс", true],
    ]);
    // A day-31 charge lands on the last day of a short month; unpaid stays active.
    expect(eventsOn("2026-11-30", { tasks: [], rec, settings: { training: tr }, today: "2026-10-07" }).map((e) => [e.title.split(" ·")[0], !!e.done])).toEqual([["Подписка: Сервис", false]]);
  });
  it("builds a project report and folder trees", () => {
    const f = (id: string, parent_id: string | null) => ({ id, parent_id, name: id, project: null, created_at: "" });
    expect([...subtree([f("a", null), f("b", "a"), f("c", "b"), f("d", null)], "a")].sort()).toEqual(["a", "b", "c"]);
    const r = taskReport("Форма", [{ title: "Второе", due: "2026-10-09", done_at: null }, { title: "Первое", due: "2026-10-20", done_at: "2026-10-02T20:00:00Z" }], (d) => d);
    // done_at is read in Tashkent time: 20:00 UTC is already the 3rd.
    expect(r.split("\n")).toEqual(["Отчёт по проекту «Форма»", "Период: 2026-10-03 — 2026-10-09", "", "Выполнено задач: 2", "• 2026-10-03 — Первое", "• 2026-10-09 — Второе"]);
  });
  it("lists overdue open and today's tasks, open first", () => {
    const list = todayTasks([t("done-old", "2026-10-01", true), t("late", "2026-10-05"), t("todayDone", "2026-10-06", true), t("tomorrow", "2026-10-07"), t("today", "2026-10-06")], "2026-10-06");
    expect(list.map((x) => x.id)).toEqual(["late", "today", "todayDone"]);
  });
});
