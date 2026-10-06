import { addDays, todayISO } from "../dates";
import { TABLES, type Records, type Settings, type SettingKey, type Table } from "../records";
import type { Idea, NewTask, Note, Platform, Task, TaskPatch, Thought } from "../types";
import type { Store } from "./types";

// Demo store: lives in server memory, resets on restart. Used when Supabase is not configured.
interface Data { tasks: Task[]; thoughts: Thought[]; ideas: Idea[]; rec: Records; settings: Partial<Settings> }

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
    ideas: [],
    rec: seedRecords(t, now),
    settings: {},
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
    const n = { id: crypto.randomUUID(), project, folder_id: null, text, created_at: new Date().toISOString() };
    db().rec.notes.push(n);
    return n;
  },
  async addIdea(title: string, platform: Platform, format: string) {
    const i = { id: crypto.randomUUID(), title, platform, format, created_at: new Date().toISOString() };
    db().ideas.push(i);
    return i;
  },
  async list<T extends Table>(table: T) { return [...db().rec[table]] as Records[T]; },
  async insert<T extends Table>(table: T, rows: object[]) {
    const now = new Date().toISOString();
    const out = rows.map((r) => ({ ...r, id: crypto.randomUUID(), created_at: now })) as Records[T];
    (db().rec[table] as object[]).push(...out);
    return out;
  },
  async update<T extends Table>(table: T, id: string, patch: object) {
    const row = (db().rec[table] as { id: string }[]).find((x) => x.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return { ...row } as Records[T][number];
  },
  async remove(table: Table, id: string) {
    const rec = db().rec;
    if (table === "folders") {
      // Mirror the database cascade: subfolders and their notes go too, meetings are detached.
      const gone = new Set([id]);
      for (let grew = true; grew;) {
        grew = false;
        for (const f of rec.folders) if (f.parent_id && gone.has(f.parent_id) && !gone.has(f.id)) { gone.add(f.id); grew = true; }
      }
      rec.folders = rec.folders.filter((f) => !gone.has(f.id));
      rec.notes = rec.notes.filter((n) => !n.folder_id || !gone.has(n.folder_id));
      rec.meetings.forEach((m) => { if (m.folder_id && gone.has(m.folder_id)) m.folder_id = null; });
      return;
    }
    if (table === "clients") rec.income.forEach((i) => { if (i.client_id === id) i.client_id = null; });
    (rec as Record<Table, { id: string }[]>)[table] = rec[table].filter((x) => x.id !== id);
  },
  async getSettings() { return { ...db().settings }; },
  async setSetting<K extends SettingKey>(key: K, value: Settings[K]) { db().settings[key] = value; },
};

function seedRecords(t: string, now: string): Records {
  const rec = Object.fromEntries(TABLES.map((k) => [k, []])) as unknown as Records;
  const row = <T extends object>(x: T) => ({ ...x, id: crypto.randomUUID(), created_at: now });
  const folder = (name: string, project: string | null, parent_id: string | null = null) => {
    const f = row({ name, project, parent_id });
    rec.folders.push(f);
    return f;
  };
  const blog = folder("Личный бренд", null);
  folder("Instagram", "Instagram", blog.id);
  folder("YouTube", "YouTube", blog.id);
  folder("Telegram", "Telegram", blog.id);
  folder("Курсы", "Курсы");
  const cl = folder("Клиентские проекты", "Клиенты");
  folder("Личное", "Личное");
  rec.notes.push(row({ folder_id: blog.id, project: null, text: "Пример заметки: рубрики по дням недели" }));
  const c = (name: string, work: string, contract: number, sum: number, due: number, paid: boolean, last: number, waiting = "") =>
    row({ name, work, contract, sum, due: addDays(t, due), paid, last_contact: addDays(t, last), waiting });
  rec.clients.push(
    c("Пример: Студия «Форма»", "Сайт + воронка", 0, 25_000_000, 10, false, -1, "Тексты для сайта"),
    c("Пример: Магазин «Ромашка»", "Поддержка", 2, 5_000_000, -3, false, -9, "Оплата счёта"),
    c("Пример: Денис", "Консультация", 2, 1_270_000, -6, true, -6),
  );
  rec.income.push(row({ date: addDays(t, -6), source: "Пример: Денис", note: "консультация", sum: 1_270_000, orig: "$100", client_id: rec.clients[2].id }));
  rec.charges.push(
    row({ type: "credit" as const, name: "Пример: автокредит", bank: "осталось 22 платежа", sum: 2_800_000, day: 8 }),
    row({ type: "sub" as const, name: "Пример: Claude Pro", bank: "", sum: 260_000, day: 18 }),
  );
  rec.meetings.push(row({
    title: "Пример: созвон со Студией «Форма»", date: addDays(t, -1), folder_id: cl.id,
    summary: "Обсудили запуск сайта. Старт после подписания договора.",
    points: ["Предоплата 50%", "Первая версия через 3 недели"], questions: ["Кто согласует дизайн?"], tasks: ["Отправить договор и счёт"],
  }));
  return rec;
}
