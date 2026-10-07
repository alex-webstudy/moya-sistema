// Phase 3 helpers: local parsers for dictated text and Claude's answers, plus prompts for the «… в Claude ↗» buttons.
import { toUZS, type Cur } from "./money";
import type { Food, Settings } from "./records";

export const WATER_GOAL = 2.5;
const n = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

/** «320 тысяч», «45 тыс», «1,5 млн», «3 доллара», «3$», «500 руб» → amount and currency. */
export function parseAmount(s: string): { amount: number; cur: Cur } | null {
  const m = s.trim().match(/^(\d[\d\s]*(?:[.,]\d+)?)\s*(тыс\S*|т\.?|к|млн\S*|\$|доллар\S*|usd|₽|руб\S*|р\.?|сум\S*)?$/i);
  if (!m) return null;
  let amount = n(m[1]);
  const u = (m[2] ?? "").toLowerCase();
  if (/^(тыс|т\.?$|к$)/.test(u)) amount *= 1000;
  else if (u.startsWith("млн")) amount *= 1_000_000;
  const cur: Cur = /^(\$|доллар|usd)/.test(u) ? "usd" : /^(₽|руб|р\.?$)/.test(u) ? "rub" : "uzs";
  return amount > 0 ? { amount, cur } : null;
}

/** «продукты 320 тысяч, такси 45 тысяч, кофе 3 доллара» → purchases in сум. */
export function parsePurchases(text: string, rates: Settings["rates"]): { name: string; sum: number; orig: string }[] {
  const out: { name: string; sum: number; orig: string }[] = [];
  // «1,5 млн» keeps its decimal comma: only a comma not followed by a digit separates purchases.
  for (const part of text.split(/[;\n]+|,(?!\d)/)) {
    const m = part.trim().match(/^(.*?\D)[\s:–—-]*(\d[\d\s]*(?:[.,]\d+)?\s*\S*)$/);
    if (!m) continue;
    const a = parseAmount(m[2]);
    const name = m[1].replace(/[\s:–—-]+$/, "").trim();
    if (!a || !name) continue;
    const { sum, orig } = toUZS(a.amount, a.cur, rates);
    out.push({ name: name[0].toUpperCase() + name.slice(1), sum, orig });
  }
  return out;
}

const MEASURE_KEYS = { weight: /вес/i, waist: /тали/i, arms: /рук|бицеп/i, chest: /груд/i } as const;
export type MeasureVals = Partial<Record<keyof typeof MEASURE_KEYS, number>>;

/** «вес 82.7, талия 88, руки 39, грудь 105» → numbers by field. */
export function parseMeasures(text: string): MeasureVals {
  const out: MeasureVals = {};
  // A decimal comma («81,9») must not split the value, so match «word … number» pairs instead of splitting on commas.
  for (const m of text.matchAll(/([а-яё]+)[^\dа-яё]{0,6}(\d+(?:[.,]\d+)?)/gi)) {
    const k = (Object.keys(MEASURE_KEYS) as (keyof MeasureVals)[]).find((key) => MEASURE_KEYS[key].test(m[1]));
    if (k) out[k] = n(m[2]);
  }
  return out;
}

const cells = (line: string) => line.replace(/^\s*(?:[-•*–—]|\d+[.)](?=\s))\s*/, "").split("|").map((x) => x.trim());
const int = (s: string | undefined) => Math.round(n((s ?? "").replace(/[^\d.,]/g, "")) || 0);

/** Claude's food answer: «блюдо | ккал | белок» per line. */
export function parseFood(text: string): Food[] {
  return text.split("\n").map(cells).filter((c) => c.length >= 2 && c[0] && /\d/.test(c[1]))
    .map((c) => ({ name: c[0].slice(0, 200), kcal: Math.min(20000, int(c[1])), protein: Math.min(1000, int(c[2])) }));
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: [Meal, string][] = [["breakfast", "Завтрак"], ["lunch", "Обед"], ["dinner", "Ужин"], ["snack", "Перекус"]];
const MEAL_RE: [Meal, RegExp][] = [["breakfast", /завтрак/i], ["lunch", /обед/i], ["dinner", /ужин/i], ["snack", /перекус|полдник/i]];
export type MenuItem = { meal: Meal; name: string; portion: string; kcal: number; protein: number };

/** Claude's menu answer: «приём | блюдо | порция | ккал | белок» per line. */
export function parseMenu(text: string): MenuItem[] {
  const out: MenuItem[] = [];
  for (const c of text.split("\n").map(cells)) {
    if (c.length < 4) continue;
    const meal = MEAL_RE.find(([, re]) => re.test(c[0]))?.[0];
    if (!meal || !c[1] || !/\d/.test(c[3])) continue;
    out.push({ meal, name: c[1].slice(0, 200), portion: c[2].slice(0, 100), kcal: Math.min(5000, int(c[3])), protein: Math.min(500, int(c[4])) });
  }
  return out.slice(0, 40);
}

export const FOOD_PROMPT = `Посчитай калории и белок в том, что я съел за день. Порции оценивай как обычные, если не названы. Ответь только списком, одно блюдо на строку, без пояснений:
блюдо | ккал | белок в граммах

Что я ел:
`;

export const menuPrompt = (norm: number, eaten: Food[], likes: string[], dislikes: string[]) => `Я живу в Ташкенте, тренируюсь вт, чт, сб, норма ${norm} ккал в день, упор на белок. Сегодня уже съел: ${eaten.length ? eaten.map((x) => `${x.name} (${x.kcal} ккал)`).join(", ") : "ничего"}.
Предложи по 3 варианта на каждый приём пищи (завтрак, обед, ужин, перекус), чтобы день уложился в норму. Блюда из продуктов, которые легко купить в Узбекистане, местная кухня в лёгком виде тоже подходит.
Мне нравится: ${likes.join(", ") || "пока не отмечал"}, предлагай это и похожее чаще. Не предлагай: ${dislikes.join(", ") || "нет"}.
Ответь только списком, одно блюдо на строку, без пояснений:
приём | блюдо | порция | ккал | белок в граммах`;

export const shopPrompt = (likes: string[], menu: string[], have: string[]) => `Составь список продуктов на 7 дней (Ташкент, норма 2500 ккал, упор на белок). Опирайся на блюда, которые мне нравятся: ${likes.join(", ") || "не отмечал"}${menu.length ? `, и на текущее меню: ${menu.join(", ")}` : ""}. Уже в списке: ${have.join(", ") || "ничего"}, не повторяй. Каждый пункт с количеством на неделю: «Куриная грудка 2 кг», «Яйца 30 шт». Ответь только списком, один продукт на строку.`;
