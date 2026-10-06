import { isISODate, isTime } from "./dates";
import { PROJECTS, type NewTask, type TaskPatch } from "./types";

const clean = (s: unknown, max = 500) => (typeof s === "string" ? s.trim().slice(0, max) : "");

export function normProject(p: unknown): string {
  return typeof p === "string" && (PROJECTS as readonly string[]).includes(p) ? p : "Личное";
}

/** Coerce untrusted input (form, Claude output) into a valid new task, or null if it has no title. */
export function toNewTask(x: unknown, fallbackDue: string): NewTask | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const title = clean(o.title);
  if (!title) return null;
  return {
    title,
    project: normProject(o.project),
    due: isISODate(o.due) ? o.due : fallbackDue,
    time: isTime(o.time) ? o.time : null,
  };
}

export function toTaskPatch(x: unknown): TaskPatch {
  const o = (x ?? {}) as Record<string, unknown>;
  const p: TaskPatch = {};
  if ("title" in o && clean(o.title)) p.title = clean(o.title);
  if ("project" in o) p.project = normProject(o.project);
  if ("due" in o && isISODate(o.due)) p.due = o.due;
  if ("time" in o) p.time = isTime(o.time) ? o.time : null;
  if ("done" in o && typeof o.done === "boolean") p.done = o.done;
  return p;
}

export const toThoughtText = (x: unknown) => clean((x as Record<string, unknown> | null)?.text, 4000);
