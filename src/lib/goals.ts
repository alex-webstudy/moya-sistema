// Goals: progress against a straight-line plan, and reading Claude's plan back from a pasted answer.
import { isISODate } from "./dates";
import type { Goal } from "./records";
import { PROJECTS } from "./types";

export const HORIZON = { year: "год", quarter: "квартал", month: "месяц" } as const;
export const GCOL = ["var(--accent)", "var(--tg)", "var(--ok)", "var(--ig)", "var(--info)", "var(--warn)", "var(--yt)"];

const days = (a: string, b: string) => (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5;

/** The cushion's target is 6 months of obligatory payments; other goals keep their own number. */
export const goalTarget = (g: Pick<Goal, "kind" | "target">, monthly: number) => (g.kind === "savings" ? Math.max(1, monthly * 6) : g.target);
export const goalCur = (g: Pick<Goal, "hist" | "start_val">) => (g.hist.length ? g.hist[g.hist.length - 1].v : g.start_val);
export function goalPct(g: Pick<Goal, "start_val">, target: number, v: number) {
  return Math.max(0, Math.min(100, ((v - g.start_val) / (target - g.start_val || 1)) * 100));
}
/** Where the goal should be today if it grows evenly from start to deadline. */
export function goalPlan(g: Goal, target: number, today: string) {
  const frac = Math.min(1, Math.max(0, days(g.start, today) / (days(g.start, g.deadline) || 1)));
  const exp = g.start_val + (target - g.start_val) * frac;
  const cur = goalCur(g);
  const tol = Math.abs(target - g.start_val) * 0.05;
  const diff = (cur - exp) * Math.sign(target - g.start_val || 1);
  return { exp, cur, st: diff > tol ? "ahead" : diff < -tol ? "behind" : "ok", left: Math.round(days(today, g.deadline)) } as const;
}
export const fmtGoal = (v: number, unit: string) => (unit === "сум" ? Math.round(v).toLocaleString("ru-RU") + " сум" : (Math.round(v * 10) / 10).toLocaleString("ru-RU") + (unit ? " " + unit : ""));

export type GoalDraft = {
  title: string; horizon: Goal["horizon"]; deadline: string; start_val: number; target: number; unit: string; why: string; kind: Goal["kind"];
  steps: { title: string; due: string; project: string }[];
  habits: { text: string; freq: string }[];
};
const num = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", ".")) || 0;
const horizon = (s: string): Goal["horizon"] => (/кварт/i.test(s) ? "quarter" : /меся/i.test(s) ? "month" : "year");
const project = (s: string) => (PROJECTS as readonly string[]).find((p) => p.toLowerCase() === s.trim().toLowerCase()) ?? "Личное";

/**
 * Claude's answer: «ЦЕЛЬ: название | горизонт | дедлайн | сейчас | цель | единица | зачем | подушка да/нет»,
 * then «ШАГ: текст | ГГГГ-ММ-ДД | проект» and «ПРИВЫЧКА: текст | частота» under it.
 * Steps and habits before any ЦЕЛЬ line go to a goal with an empty title (used for «next steps» of an existing goal).
 */
export function parseGoals(text: string, fallbackDue: string): GoalDraft[] {
  const out: GoalDraft[] = [];
  const cur = () => out[out.length - 1] ?? (out.push(blank("", fallbackDue)), out[0]);
  for (const raw of text.split("\n")) {
    const m = raw.replace(/^\s*[-•*]\s*/, "").match(/^(цель|шаг|привычка)\s*[:：]\s*(.+)$/i);
    if (!m) continue;
    const p = m[2].split("|").map((x) => x.trim());
    const kind = m[1].toLowerCase();
    if (kind === "цель" && p[0]) {
      const g = blank(p[0].slice(0, 200), fallbackDue);
      g.horizon = horizon(p[1] ?? "");
      if (isISODate(p[2])) g.deadline = p[2];
      g.start_val = num(p[3] ?? "0");
      g.target = num(p[4] ?? "0");
      g.unit = (p[5] ?? "").slice(0, 20);
      g.why = (p[6] ?? "").slice(0, 300);
      g.kind = /да|yes|подушк/i.test(p[7] ?? "") ? "savings" : "";
      if (g.kind === "savings") g.unit = "сум";
      out.push(g);
    } else if (kind === "шаг" && p[0]) {
      cur().steps.push({ title: p[0].slice(0, 500), due: isISODate(p[1]) ? p[1] : fallbackDue, project: project(p[2] ?? "") });
    } else if (kind === "привычка" && p[0]) {
      cur().habits.push({ text: p[0].slice(0, 300), freq: (p[1] ?? "").slice(0, 60) });
    }
  }
  return out;
}
const blank = (title: string, deadline: string): GoalDraft => ({ title, horizon: "year", deadline, start_val: 0, target: 0, unit: "", why: "", kind: "", steps: [], habits: [] });

const RULES = (today: string) => `Сегодня ${today}. Правила плана: внедряем постепенно, без перегруза. Не больше 1–2 шагов в неделю на одну цель, первые шаги совсем маленькие, на 15–30 минут. Распредели шаги по неделям на ближайшие 6–8 недель. Каждый шаг начинается с глагола. Проект шага один из: ${PROJECTS.join(", ")}. Привычки: 1–2 регулярных действия с частотой («Вт, Чт, Сб», «каждое воскресенье», «с каждой оплаты»).`;

export const goalsPrompt = (text: string, today: string, ctx: object) => `Я надиктовал цели:
${text}

Сделай из каждой измеримую цель с реалистичным дедлайном. Деньги всегда в узбекских сумах. Текущее значение бери из моих данных: ${JSON.stringify(ctx)}.
${RULES(today)}
Ответь только строками, без пояснений и без markdown:
ЦЕЛЬ: название | год/квартал/месяц | дедлайн ГГГГ-ММ-ДД | сейчас (число) | цель (число) | единица (сум, кг, подп.) | зачем коротко | подушка да/нет
ШАГ: текст | ГГГГ-ММ-ДД | проект
ПРИВЫЧКА: текст | частота
Строки ШАГ и ПРИВЫЧКА пиши сразу под своей целью.`;

export const nextStepsPrompt = (g: Goal, cur: number, target: number, status: string, have: string[], today: string) => `Моя цель: «${g.title}», сейчас ${cur} из ${target} ${g.unit}, дедлайн ${g.deadline}, ${status}.
Уже есть шаги: ${have.join("; ") || "нет"}. Привычки: ${g.habits.map((h) => h.text).join("; ") || "нет"}.
Предложи следующие шаги и, если нужно, новые привычки, не повторяй существующие.
${RULES(today)}
Ответь только строками:
ШАГ: текст | ГГГГ-ММ-ДД | проект
ПРИВЫЧКА: текст | частота`;
