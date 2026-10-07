import { describe, expect, it } from "vitest";
import { parseAmount, parseFood, parseMeasures, parseMenu, parsePurchases } from "../src/lib/health";

const rates = { usd: 12000, rub: 155 };

describe("health and lists parsers", () => {
  it("reads amounts with units", () => {
    expect(parseAmount("320 тысяч")).toEqual({ amount: 320000, cur: "uzs" });
    expect(parseAmount("1,5 млн")).toEqual({ amount: 1500000, cur: "uzs" });
    expect(parseAmount("3 доллара")).toEqual({ amount: 3, cur: "usd" });
    expect(parseAmount("3$")).toEqual({ amount: 3, cur: "usd" });
    expect(parseAmount("45 000")).toEqual({ amount: 45000, cur: "uzs" });
  });
  it("splits dictated purchases", () => {
    expect(parsePurchases("продукты 320 тысяч, такси 45 тыс, кофе 3 доллара; хлеб", rates)).toEqual([
      { name: "Продукты", sum: 320000, orig: "" },
      { name: "Такси", sum: 45000, orig: "" },
      { name: "Кофе", sum: 36000, orig: "3 $" },
    ]);
    expect(parsePurchases("ремонт 1,5 млн", rates)).toEqual([{ name: "Ремонт", sum: 1500000, orig: "" }]);
  });
  it("reads measures", () => {
    expect(parseMeasures("вес 82.7, талия 88, руки 39, грудь 105")).toEqual({ weight: 82.7, waist: 88, arms: 39, chest: 105 });
    expect(parseMeasures("Вес: 81,9 кг")).toEqual({ weight: 81.9 });
  });
  it("reads Claude's food and menu answers", () => {
    expect(parseFood("- Омлет из 3 яиц | 280 | 19 г\nПлов | 650 ккал | 22\nИтого:")).toEqual([
      { name: "Омлет из 3 яиц", kcal: 280, protein: 19 },
      { name: "Плов", kcal: 650, protein: 22 },
    ]);
    expect(parseMenu("Завтрак | Сырники | 3 шт | 420 | 25\nОбед | Шурпа | 400 мл | 380 | 28\nПримечание")).toEqual([
      { meal: "breakfast", name: "Сырники", portion: "3 шт", kcal: 420, protein: 25 },
      { meal: "lunch", name: "Шурпа", portion: "400 мл", kcal: 380, protein: 28 },
    ]);
  });
});
