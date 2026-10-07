import { activeNow, payDate } from "./accounting";
import { byDue, weekday } from "./dates";
import { nextCharge, rub } from "./money";
import type { Records } from "./records";
import type { Task, Training } from "./types";

/** done: finished, paid or past — the calendar shows it grey and struck through. */
export interface CalEvent { time: string; title: string; color: string; kind: string; done?: boolean; taskId?: string; href?: string }

export const KC = { task: "var(--accent)", train: "var(--ok)", pay: "var(--warn)", income: "var(--info)", content: "var(--ig)", other: "var(--muted)" };

export const LEGEND: [string, string][] = [
  [KC.task, "задачи"], [KC.train, "тренировки"], [KC.pay, "списания и налоги"], [KC.income, "оплаты клиентов"], [KC.content, "публикации"], [KC.other, "встречи, поездки, сроки"],
];

type Rec = Pick<Records, "charges" | "clients" | "income" | "taxes" | "ideas" | "meetings" | "trips" | "goals" | "days">;
export interface CalData { tasks: Task[]; rec: Rec; settings: { training: Training }; today: string }

const prevMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/** Everything with a date on a day, sorted by time; untimed items go last. */
export function eventsOn(day: string, { tasks, rec, settings, today }: CalData): CalEvent[] {
  const ev: CalEvent[] = tasks
    .filter((t) => t.due === day)
    .map((t) => ({ time: t.time ?? "", title: t.title, color: KC.task, kind: t.project, done: t.done, taskId: t.id }));

  const training = settings.training;
  const d = rec.days.find((x) => x.date === day);
  if (training.days.includes(weekday(day))) {
    const missed = d?.workout === false;
    ev.push({ time: training.start, title: missed ? "Тренировка пропущена" : `Тренировка до ${training.end}`, color: KC.train, kind: "Здоровье", done: d?.workout === true || missed, href: "/health" });
  } else if (d?.workout) ev.push({ time: "", title: "Тренировка", color: KC.train, kind: "Здоровье", done: true, href: "/health" });

  const month = day.slice(0, 8) + "01";
  for (const c of rec.charges) {
    if (nextCharge(c.day, month) !== day || (c.start && day < c.start) || (c.until && day > c.until)) continue;
    ev.push({ time: "", title: `${c.type === "credit" ? "Платёж" : "Подписка"}: ${c.name} · ${rub(c.sum)}`, color: KC.pay, kind: "Финансы", done: !!c.paid_to && c.paid_to >= day, href: "/finance" });
  }
  if (day.slice(8) === "10") {
    ev.push({ time: "", title: "Отчёт ИП, минималка и пенсионный", color: KC.pay, kind: "Финансы", done: rec.taxes.some((t) => t.month === prevMonth(day)), href: "/finance" });
  }

  for (const c of rec.clients) {
    if (c.pay_day && payDate(c, day) === day && activeNow(c, day)) {
      const got = rec.income.some((i) => i.client_id === c.id && i.date.slice(0, 7) === day.slice(0, 7));
      ev.push({ time: "", title: `Оплата: ${c.name} · ${rub(c.sum)}`, color: KC.income, kind: "Клиенты", done: got, href: "/clients" });
    }
    if (!c.pay_day && c.due === day) ev.push({ time: "", title: `Оплата: ${c.name} · ${rub(c.sum)}`, color: KC.income, kind: "Клиенты", done: c.paid, href: "/clients" });
    if (c.contract_until === day) ev.push({ time: "", title: `Конец договора: ${c.name}`, color: KC.other, kind: "Клиенты", done: day < today, href: "/clients" });
  }

  for (const i of rec.ideas) if (i.date === day) ev.push({ time: "", title: `Публикация: ${i.title}`, color: KC.content, kind: "Контент", done: i.status === 3, href: "/content" });
  for (const m of rec.meetings) if (m.date === day) ev.push({ time: "", title: `Встреча: ${m.title}`, color: KC.other, kind: "Встречи", done: day < today, href: "/meetings" });
  for (const t of rec.trips) if (t.date <= day && day <= (t.date2 ?? t.date)) ev.push({ time: "", title: `${t.title}${t.city ? ", " + t.city : ""}`, color: KC.other, kind: "Планы", done: (t.date2 ?? t.date) < today, href: "/lists" });
  for (const g of rec.goals) if (g.deadline === day) ev.push({ time: "", title: `Срок цели: ${g.title}`, color: KC.other, kind: "Цели", href: "/goals" });

  return ev.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}

/** Overdue and today's open tasks, plus today's done ones; open first, then by date and time. */
export function todayTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => !!t.due && ((t.due < today && !t.done) || t.due === today))
    .sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}
