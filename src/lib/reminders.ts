// What to push right now. Pure: the tick route feeds it the data and the keys already sent today.
import { needsInvoice } from "./accounting";
import { addDays, diffDays, weekday } from "./dates";
import { chargeNext, rub } from "./money";
import type { Records, Settings } from "./records";
import type { Task, Thought } from "./types";

export interface Push { key: string; title: string; body: string; url: string }
export interface Snapshot { tasks: Task[]; thoughts: Thought[]; rec: Pick<Records, "charges" | "clients" | "invoices" | "days">; settings: Pick<Settings, "training"> }

export const BRIEF = "11:00";
export const EVENING = "21:00";
export const WEEK = "20:00"; // Sunday
const EVENING_REPEAT = ["21:00", "21:30", "22:00", "22:30"];
const TASK_AHEAD = 15; // minutes before a timed task

const mins = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
/** The cron runs every 15 minutes; a reminder fires on the first run within an hour after its time. */
const due = (hm: string, at: string, window = 60) => mins(hm) >= mins(at) && mins(hm) < mins(at) + window;
const plural = (n: number, one: string, few: string, many: string) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many}`;

export function briefLines(s: Snapshot, today: string): string[] {
  const out: string[] = [];
  const open = s.tasks.filter((t) => !t.done && t.due <= today).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  if (open.length) out.push(`Задачи: ${plural(open.length, "дело", "дела", "дел")} · ${open.slice(0, 3).map((t) => (t.time ? t.time + " " : "") + t.title).join("; ")}`);
  if (s.settings.training.days.includes(weekday(today))) out.push(`Тренировка ${s.settings.training.start}–${s.settings.training.end}`);
  const tomorrow = addDays(today, 1);
  for (const c of s.rec.charges) {
    const next = chargeNext(c, today);
    if (!next || next > tomorrow) continue;
    out.push(`${next < today ? "Не отмечено списание" : next === today ? "Списание сегодня" : "Списание завтра"}: ${c.name}, ${rub(c.sum)}`);
  }
  const day = Number(today.slice(8));
  if (day === 9) out.push("Завтра отчёт ИП, минималка и пенсионный");
  if (day === 10) out.push("Сегодня отчёт ИП, минималка и пенсионный");
  if (day === 1) out.push("Финансовый разбор месяца");
  for (const c of s.rec.clients) if (c.pay_day === day) out.push(`Ждём оплату: ${c.name}, ${rub(c.sum)}`);
  const inv = s.rec.clients.filter((c) => needsInvoice(c, s.rec.invoices, today));
  if (inv.length) out.push(`Выставить счёт-фактуру: ${inv.map((c) => c.name).join(", ")}`);
  const follow = s.rec.clients.filter((c) => !c.paid && (!!c.waiting || diffDays(c.last_contact, today) <= -5));
  if (follow.length) out.push(`Пора написать: ${follow.map((c) => c.name).join(", ")}`);
  return out;
}

/** The same checklist as the «Вечер» page: done when every step there is green. */
export function eveningDone(s: Snapshot, today: string): boolean {
  const d = s.rec.days.find((x) => x.date === today);
  const open = s.tasks.filter((t) => !t.done && t.due <= today);
  const tomorrow = s.tasks.filter((t) => t.due === addDays(today, 1));
  const train = s.settings.training.days.includes(weekday(today));
  return !!d && (open.length === 0 || d.ev_tasks) && s.thoughts.length === 0 && (!train || d.workout !== null) &&
    d.water > 0 && d.food_ok !== null && (tomorrow.length > 0 || d.ev_tomorrow);
}

export function reminders(s: Snapshot, today: string, hm: string, sent: Set<string>): Push[] {
  const out: Push[] = [];
  const add = (p: Push) => { if (!sent.has(p.key)) out.push(p); };
  if (due(hm, BRIEF)) {
    const lines = briefLines(s, today);
    add({ key: `brief:${today}`, title: "План на день", body: lines.length ? lines.join("\n") : "Свободный день: срочного ничего", url: "/" });
  }
  if (weekday(today) === 0 && due(hm, WEEK)) add({ key: `week:${today}`, title: "Итоги недели", body: "Подведи итоги, выбери 3 главных дела и сделай замеры", url: "/week" });
  // Evening review repeats every 30 minutes until it is filled in.
  const slot = EVENING_REPEAT.filter((x) => due(hm, x, 30)).at(-1);
  if (slot && !eveningDone(s, today)) {
    add({ key: `evening:${today}:${slot}`, title: "Вечерний разбор", body: slot === EVENING ? "Отметь дела, воду, еду и план на завтра" : "Разбор ещё не заполнен", url: "/evening" });
  }
  for (const t of s.tasks) {
    if (t.done || t.due !== today || !t.time) continue;
    const left = mins(t.time) - mins(hm);
    if (left > 0 && left <= TASK_AHEAD) add({ key: `task:${t.id}:${today}:${t.time}`, title: t.title, body: `в ${t.time} · ${t.project}`, url: "/tasks" });
  }
  return out;
}
