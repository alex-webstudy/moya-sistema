import { describe, expect, it } from "vitest";
import { parseLine, parseLines } from "../src/lib/parseLines";

// 2026-10-06 is a Tuesday.
const today = "2026-10-06";
const p = (s: string) => parseLine(s, today, "2026-10-07");

describe("parseLines", () => {
  it("reads the pipe format the copied prompt asks for", () => {
    expect(p("завтра | 15:00 | Клиенты | Отправить договор")).toEqual({ title: "Отправить договор", project: "Клиенты", due: "2026-10-07", time: "15:00" });
    expect(p("пт |  | Instagram | Смонтировать рилс")).toEqual({ title: "Смонтировать рилс", project: "Instagram", due: "2026-10-09", time: null });
  });

  it("reads free lines with date, time and #project in any order", () => {
    expect(p("- сегодня 9:30 Записать урок #Курсы")).toEqual({ title: "Записать урок", project: "Курсы", due: "2026-10-06", time: "09:30" });
    expect(p("15:00 послезавтра созвон с Ириной")).toEqual({ title: "созвон с Ириной", project: "Личное", due: "2026-10-08", time: "15:00" });
    expect(p("в пятницу отправить счёт")?.due).toBe("2026-10-09");
    expect(p("вт купить домен")?.due).toBe("2026-10-06");
    expect(p("12.10 сдать отчёт")?.due).toBe("2026-10-12");
    expect(p("3 янв поздравить команду")?.due).toBe("2027-01-03");
  });

  it("keeps the text when nothing matches and defaults to the fallback date", () => {
    expect(p("1. Позвонить бухгалтеру")).toEqual({ title: "Позвонить бухгалтеру", project: "Личное", due: "2026-10-07", time: null });
    expect(p("Отправить #неизвестно")?.title).toBe("Отправить #неизвестно");
    expect(p("в банк сходить")?.title).toBe("в банк сходить");
  });

  it("skips empty lines and headings", () => {
    expect(parseLines("Задачи:\n\n- завтра купить домен\n", today)).toHaveLength(1);
    expect(parseLines("Обновить портфолио", today)[0].due).toBeNull();
  });
});
