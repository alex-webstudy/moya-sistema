import { addDays, todayISO } from "../dates";
import type { Idea, NewTask, Note, Platform, Task, TaskPatch, Thought } from "../types";
import type { Store } from "./types";

// Demo store: lives in server memory, resets on restart. Used when Supabase is not configured.
interface Data { tasks: Task[]; thoughts: Thought[]; notes: Note[]; ideas: Idea[] }

const g = globalThis as unknown as { __msDemo?: Data };

function seed(): Data {
  const t = todayISO();
  const now = new Date().toISOString();
  const task = (title: string, project: string, due: number, time: string | null, done = false): Task => ({
    id: crypto.randomUUID(), title, project, due: addDays(t, due), time, done, created_at: now,
  });
  return {
    tasks: [
      task("Обновить доступы к хостингу у «Ромашки»", "Клиенты", -1, null),
      task("Смонтировать рилс про возражения", "Instagram", 0, "11:00"),
      task("Отправить договор «Студия Форма»", "Клиенты", 0, "15:00"),
      task("Записать урок 4 курса", "Курсы", 0, "09:30", true),
      task("Написать описание к ролику с таймкодами", "YouTube", 1, "10:00"),
      task("Созвон с Ириной, разбор воронки", "Клиенты", 3, "12:00"),
    ],
    thoughts: [
      { id: crypto.randomUUID(), text: "Снять рилс: 3 ошибки в портфолио дизайнера", created_at: now },
      { id: crypto.randomUUID(), text: "Позвонить Марине по сайту салона в четверг", created_at: now },
    ],
    notes: [],
    ideas: [],
  };
}

const db = () => (g.__msDemo ??= seed());

export const memoryStore: Store = {
  demo: true,
  async listTasks() { return [...db().tasks]; },
  async addTasks(items: NewTask[]) {
    const now = new Date().toISOString();
    const out = items.map((x) => ({ ...x, id: crypto.randomUUID(), done: false, created_at: now }));
    db().tasks.push(...out);
    return out;
  },
  async updateTask(id: string, patch: TaskPatch) {
    const t = db().tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    return { ...t };
  },
  async deleteTask(id: string) { db().tasks = db().tasks.filter((x) => x.id !== id); },
  async listThoughts() { return [...db().thoughts]; },
  async addThought(text: string) {
    const th = { id: crypto.randomUUID(), text, created_at: new Date().toISOString() };
    db().thoughts.push(th);
    return th;
  },
  async deleteThoughts(ids: string[]) { db().thoughts = db().thoughts.filter((x) => !ids.includes(x.id)); },
  async addNote(project: string, text: string) {
    const n = { id: crypto.randomUUID(), project, text, created_at: new Date().toISOString() };
    db().notes.push(n);
    return n;
  },
  async addIdea(title: string, platform: Platform, format: string) {
    const i = { id: crypto.randomUUID(), title, platform, format, created_at: new Date().toISOString() };
    db().ideas.push(i);
    return i;
  },
};
