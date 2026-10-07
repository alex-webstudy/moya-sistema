import { describe, expect, it } from "vitest";
import { chargeNext, dueThisMonth, nextCharge, paymentsLeft, prevCharge, toUZS } from "../src/lib/money";
import { parseMeeting } from "../src/lib/meeting";
import { parsePatch } from "../src/lib/records";

describe("money", () => {
  it("finds the next charge date, clamping to short months", () => {
    expect(nextCharge(10, "2026-10-06")).toBe("2026-10-10");
    expect(nextCharge(6, "2026-10-06")).toBe("2026-10-06");
    expect(nextCharge(5, "2026-10-06")).toBe("2026-11-05");
    expect(nextCharge(31, "2026-11-02")).toBe("2026-11-30");
    expect(nextCharge(3, "2026-12-20")).toBe("2027-01-03");
  });
  it("converts $ and ₽ to сум and keeps the original", () => {
    expect(toUZS(100, "usd", { usd: 12700, rub: 155 })).toEqual({ sum: 1270000, orig: "100 $" });
    expect(toUZS(5000, "uzs", { usd: 12700, rub: 155 })).toEqual({ sum: 5000, orig: "" });
  });
});

describe("parseMeeting", () => {
  it("reads the sections Claude returns", () => {
    const m = parseMeeting(`**СУТЬ:**
Обсудили редизайн сайта.
Клиент готов стартовать.

ВАЖНО:
- Бюджет 8 млн
- Старт в понедельник

## Вопросы
- Кто пишет тексты?

ЗАДАЧИ:
завтра | 15:00 | Клиенты | Отправить договор
пт |  | Клиенты | Собрать референсы`, "2026-10-06");
    expect(m.summary).toBe("Обсудили редизайн сайта. Клиент готов стартовать.");
    expect(m.points).toEqual(["Бюджет 8 млн", "Старт в понедельник"]);
    expect(m.questions).toEqual(["Кто пишет тексты?"]);
    expect(m.tasks).toEqual([
      { title: "Отправить договор", project: "Клиенты", due: "2026-10-07", time: "15:00" },
      { title: "Собрать референсы", project: "Клиенты", due: "2026-10-09", time: null },
    ]);
  });
  it("skips «нет» and keeps text on the heading line", () => {
    const m = parseMeeting("Суть: Коротко.\nВопросы:\n- нет", "2026-10-06");
    expect(m.summary).toBe("Коротко.");
    expect(m.questions).toEqual([]);
  });
});

describe("parsePatch", () => {
  it("keeps only the fields that were sent", () => {
    const r = parsePatch("clients", { paid: true });
    expect(r.success && r.data).toEqual({ paid: true });
    expect(parsePatch("clients", { contract: 5 }).success).toBe(false);
  });
});

describe("instalments", () => {
  const c = (start: string | null, until: string | null, day = 18) => ({ day, start, until });
  it("starts later, ends, and counts payments left", () => {
    expect(chargeNext(c(null, "2026-10-18"), "2026-10-07")).toBe("2026-10-18");
    expect(paymentsLeft(c(null, "2026-10-18"), "2026-10-07")).toBe(1);
    // Last payment passed but not confirmed: still due; confirmed: closed.
    expect(chargeNext(c(null, "2026-10-18"), "2026-10-19")).toBe("2026-10-18");
    expect(chargeNext({ ...c(null, "2026-10-18"), paid_to: "2026-10-18" }, "2026-10-19")).toBeNull();
    expect(paymentsLeft({ ...c(null, "2026-10-18"), paid_to: "2026-10-18" }, "2026-10-19")).toBe(0);
    expect(chargeNext(c(null, "2026-09-18"), "2026-10-07")).toBeNull();
    expect(chargeNext(c("2026-11-04", "2027-01-04", 4), "2026-10-07")).toBe("2026-11-04");
    expect(paymentsLeft(c("2026-11-04", "2027-01-04", 4), "2026-10-07")).toBe(3);
    expect(paymentsLeft(c(null, null), "2026-10-07")).toBeNull();
  });
});

describe("confirmed payments", () => {
  const sub = { day: 3, start: null, until: null };
  it("keeps this month's payment due until confirmed, then moves on", () => {
    expect(dueThisMonth(sub, "2026-10-07")).toBe("2026-10-03");
    const paid = { ...sub, paid_to: "2026-10-03" };
    expect(dueThisMonth(paid, "2026-10-07")).toBeNull();
    expect(chargeNext(paid, "2026-10-07")).toBe("2026-11-03");
    expect(dueThisMonth(paid, "2026-11-01")).toBe("2026-11-03");
    expect(prevCharge(sub, "2026-10-03")).toBe("2026-09-03");
    expect(prevCharge({ day: 4, start: "2026-11-04", until: null }, "2026-11-04")).toBeNull();
  });
  it("a payment starting next month is not due this month", () => {
    expect(dueThisMonth({ day: 1, start: "2026-11-01", until: "2026-12-01" }, "2026-10-07")).toBeNull();
  });
});
