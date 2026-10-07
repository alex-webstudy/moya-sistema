import { weekday } from "./dates";
import type { Task, Training } from "./types";

export interface CalEvent { time: string; title: string; color: string; kind: string; done?: boolean; taskId?: string }

export const KC = { task: "var(--accent)", train: "var(--ok)" };

/** Everything planned on a day, sorted by time; untimed items go last. */
export function eventsOn(day: string, tasks: Task[], training: Training): CalEvent[] {
  const ev: CalEvent[] = tasks
    .filter((t) => t.due === day)
    .map((t) => ({ time: t.time ?? "", title: t.title, color: KC.task, kind: t.project, done: t.done, taskId: t.id }));
  if (training.days.includes(weekday(day))) ev.push({ time: training.start, title: `Тренировка до ${training.end}`, color: KC.train, kind: "Здоровье" });
  return ev.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}

/** Overdue and today's open tasks, plus today's done ones; open first, then by date and time. */
export function todayTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => (t.due < today && !t.done) || t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}
