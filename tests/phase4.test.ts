import { describe, expect, it } from "vitest";
import { parseIdeas, toFormat } from "../src/lib/content";
import { goalPct, goalPlan, goalTarget, parseGoals } from "../src/lib/goals";
import type { Goal } from "../src/lib/records";
import { createMeta, genPassword, open, seal, unlock } from "../src/lib/vault";
import { monday, parseReview } from "../src/lib/week";

describe("content", () => {
  it("reads Claude's lines and plain ideas", () => {
    const r = parseIdeas("1. Как отвечать на «дорого» | Instagram | рилс | короткое возражение\nМой день в приложении\n- Итоги месяца | тг | голосовое | ");
    expect(r[0]).toEqual({ title: "Как отвечать на «дорого»", platform: "ig", format: "reels", why: "короткое возражение" });
    expect(r[1]).toMatchObject({ title: "Мой день в приложении", platform: null, format: "" });
    expect(r[2]).toMatchObject({ platform: "tg", format: "audio" });
  });
  it("falls back to the platform's first format", () => {
    expect(toFormat("yt", "карусель")).toBe("shorts");
  });
});

describe("goals", () => {
  const g = { title: "x", horizon: "year", start: "2026-01-01", deadline: "2026-12-31", start_val: 0, target: 100, unit: "", why: "", kind: "", hist: [{ date: "2026-07-01", v: 60 }], habits: [], id: "1", created_at: "" } as Goal;
  it("compares with a straight-line plan", () => {
    const p = goalPlan(g, 100, "2026-07-02");
    expect(p.st).toBe("ahead");
    expect(goalPlan({ ...g, hist: [{ date: "2026-07-01", v: 30 }] }, 100, "2026-07-02").st).toBe("behind");
    expect(goalPct(g, 100, 60)).toBe(60);
  });
  it("counts a falling goal (weight) the right way", () => {
    const w = { ...g, start_val: 90, target: 80, hist: [{ date: "2026-07-01", v: 84 }] };
    expect(goalPlan(w, 80, "2026-07-02").st).toBe("ahead");
    expect(goalPct(w, 80, 85)).toBe(50);
  });
  it("cushion target is six months of payments", () => {
    expect(goalTarget({ kind: "savings", target: 0 }, 10_000_000)).toBe(60_000_000);
  });
  it("parses goals with steps and habits", () => {
    const r = parseGoals(`ЦЕЛЬ: Подушка на полгода | год | 2027-06-01 | 0 | 0 | сум | спокойствие | да
ШАГ: Открыть накопительный счёт | 2026-10-10 | Личное
ПРИВЫЧКА: Откладывать 10% с прихода | с каждой оплаты
ЦЕЛЬ: Вес 78 кг | квартал | 2026-12-31 | 84 | 78 | кг | здоровье | нет
- ШАГ: Записать вес | плохая дата | Здоровье`, "2026-10-14");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ kind: "savings", unit: "сум", deadline: "2027-06-01", horizon: "year" });
    expect(r[0].steps[0]).toEqual({ title: "Открыть накопительный счёт", due: "2026-10-10", project: "Личное" });
    expect(r[0].habits[0].freq).toBe("с каждой оплаты");
    expect(r[1]).toMatchObject({ horizon: "quarter", start_val: 84, target: 78, unit: "кг" });
    expect(r[1].steps[0]).toEqual({ title: "Записать вес", due: "2026-10-14", project: "Здоровье" });
  });
  it("collects steps without a goal line", () => {
    const r = parseGoals("ШАГ: Сделать раз | 2026-10-20 | Курсы", "2026-10-14");
    expect(r[0].title).toBe("");
    expect(r[0].steps).toHaveLength(1);
  });
});

describe("week", () => {
  it("finds Monday", () => {
    expect(monday("2026-10-07")).toBe("2026-10-05");
    expect(monday("2026-10-11")).toBe("2026-10-05");
    expect(monday("2026-10-05")).toBe("2026-10-05");
  });
  it("parses the review blocks", () => {
    const r = parseReview(`**ИТОГ:** Неделя ровная.
Задачи почти все.
ПОЛУЧИЛОСЬ:
- 3 тренировки
• КП Рамису
ПРОВИСЛО:
- вода
ФОКУС НА СЛЕДУЮЩУЮ НЕДЕЛЮ:
1. Созвон с NTS
2) Пост про кейс`);
    expect(r.summary).toBe("Неделя ровная. Задачи почти все.");
    expect(r.wins).toEqual(["3 тренировки", "КП Рамису"]);
    expect(r.misses).toEqual(["вода"]);
    expect(r.focus).toEqual(["Созвон с NTS", "Пост про кейс"]);
  });
});

describe("vault", () => {
  it("opens only with the right password", async () => {
    const { meta, key } = await createMeta("верный пароль", 1000);
    const box = await seal(key, { name: "Tilda", pass: "s3cret" });
    expect(box.data).not.toContain("s3cret");
    const k2 = await unlock("верный пароль", meta, 1000);
    expect(k2).not.toBeNull();
    expect(await open(k2!, box)).toEqual({ name: "Tilda", pass: "s3cret" });
    expect(await unlock("неверный", meta, 1000)).toBeNull();
  });
  it("generates passwords", () => {
    const p = genPassword(20);
    expect(p).toHaveLength(20);
    expect(genPassword()).not.toBe(genPassword());
  });
});
