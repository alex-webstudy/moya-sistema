import { weekday } from "./dates";
import { TRAINING_DAYS, TRAINING_TIME, type Task } from "./types";

export interface CalEvent { time: string; title: string; color: string; kind: string; done?: boolean }

export const KC = { task: "var(--accent)", train: "var(--ok)" };

/** Everything planned on a day, sorted by time; untimed items go last. */
export function eventsOn(day: string, tasks: Task[]): CalEvent[] {
  const ev: CalEvent[] = tasks
    .filter((t) => t.due === day)
    .map((t) => ({ time: t.time ?? "", title: t.title, color: KC.task, kind: t.project, done: t.done }));
  if (TRAINING_DAYS.includes(weekday(day))) ev.push({ time: TRAINING_TIME, title: "Тренировка", color: KC.train, kind: "Здоровье" });
  return ev.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}

/** Overdue and today's open tasks, plus today's done ones; open first, then by date and time. */
export function todayTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => (t.due < today && !t.done) || t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}
