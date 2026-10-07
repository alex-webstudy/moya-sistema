import { addDays, todayISO } from "../dates";
import { SCHEMAS, TABLES, type Day, type Records, type Settings, type SettingKey, type Table } from "../records";
import type { Idea, NewTask, Platform, Task, TaskPatch, Thought } from "../types";
import type { PushSub, Store } from "./types";

// Demo store: lives in server memory, resets on restart. Used when Supabase is not configured.
interface Data { tasks: Task[]; thoughts: Thought[]; rec: Records; settings: Partial<Settings>; push: PushSub[]; sent: Set<string> }

const g = globalThis as unknown as { __msDemo?: Data; __msBlobs?: Map<string, { data: ArrayBuffer; type: string }> };

function seed(): Data {
  const t = todayISO();
  const now = new Date().toISOString();
  const task = (title: string, project: string, due: number, time: string | null, done = false): Task => ({
    id: crypto.randomUUID(), title, project, due: addDays(t, due), time, done, created_at: now,
  });
  const rec = seedRecords(t, now);
  const goal = rec.goals[0].id;
  const forma = rec.folders.find((f) => f.name === "Пример: Студия «Форма»")!.id;
  const inForma = (x: Task, done_at: string | null = null): Task => ({ ...x, folder_id: forma, done_at });
  const step = (title: string, due: number, done = false): Task => ({ ...task(title, "Личное", due, null, done), goal_id: goal });
  return {
    tasks: [
      step("Открыть накопительный счёт", -3, true),
      step("Настроить автоперевод 10% с прихода", 4),
      task("Обновить доступы к хостингу у «Ромашки»", "Клиенты", -1, null),
      task("Смонтировать рилс про возражения", "Instagram", 0, "11:00"),
      inForma(task("Отправить договор «Студия Форма»", "Клиенты", 0, "15:00")),
      inForma(task("Собрать прототип главной", "Клиенты", -5, null, true), addDays(t, -5) + "T12:00:00Z"),
      inForma(task("Согласовать структуру сайта", "Клиенты", -12, null, true), addDays(t, -12) + "T12:00:00Z"),
      task("Записать урок 4 курса", "Курсы", 0, "09:30", true),
      task("Написать описание к ролику с таймкодами", "YouTube", 1, "10:00"),
      task("Созвон с Ириной, разбор воронки", "Клиенты", 3, "12:00"),
    ],
    thoughts: [
      { id: crypto.randomUUID(), text: "Снять рилс: 3 ошибки в портфолио дизайнера", created_at: now },
      { id: crypto.randomUUID(), text: "Позвонить Марине по сайту салона в четверг", created_at: now },
    ],
    rec,
    settings: {},
    push: [],
    sent: new Set(),
  };
}

const db = () => (g.__msDemo ??= seed());
/** Demo file bytes, kept in memory like everything else in demo mode. */
export const blobs = () => (g.__msBlobs ??= new Map());

export const memoryStore: Store = {
  demo: true,
  async listTasks() { return [...db().tasks]; },
  async addTasks(items: NewTask[]) {
    const now = new Date().toISOString();
    const out = items.map((x) => ({ ...x, goal_id: x.goal_id ?? null, folder_id: x.folder_id ?? null, done_at: null, id: crypto.randomUUID(), done: false, created_at: now }));
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
    const i = { ...SCHEMAS.ideas.parse({ title, platform, format }), id: crypto.randomUUID(), created_at: new Date().toISOString() };
    db().rec.ideas.push(i);
    return i as Idea;
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
      db().tasks.forEach((x) => { if (x.folder_id && gone.has(x.folder_id)) x.folder_id = null; });
      return;
    }
    if (table === "files" || table === "clients" || table === "invoices") {
      const key = table === "files" ? "id" : table === "clients" ? "client_id" : "invoice_id";
      const gone = rec.files.filter((f) => f[key] === id);
      gone.forEach((f) => blobs().delete(f.path));
      rec.files = rec.files.filter((f) => !gone.includes(f));
      if (table === "clients") rec.invoices = rec.invoices.filter((i) => i.client_id !== id);
      if (table === "invoices") rec.income.forEach((i) => { if (i.invoice_id === id) i.invoice_id = null; });
    }
    if (table === "goals") db().tasks.forEach((t) => { if (t.goal_id === id) t.goal_id = null; });
    if (table === "clients") rec.income.forEach((i) => { if (i.client_id === id) i.client_id = null; });
    (rec as Record<Table, { id: string }[]>)[table] = rec[table].filter((x) => x.id !== id);
  },
  async upsertDay(date: string, patch: object) {
    const days = db().rec.days;
    let d = days.find((x) => x.date === date);
    if (!d) {
      d = { ...(SCHEMAS.days.parse({ date }) as Day), id: crypto.randomUUID(), created_at: new Date().toISOString() };
      days.push(d);
    }
    Object.assign(d, patch);
    return { ...d };
  },
  async signUpload(path: string) { return `/api/files/blob?path=${encodeURIComponent(path)}`; },
  async signDownload(path: string, name: string) { return `/api/files/blob?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`; },
  async getSettings() { return { ...db().settings }; },
  async setSetting<K extends SettingKey>(key: K, value: Settings[K]) { db().settings[key] = value; },
  async listPushSubs() { return [...db().push]; },
  async savePushSub(sub: PushSub) { db().push = [...db().push.filter((x) => x.endpoint !== sub.endpoint), sub]; },
  async removePushSub(endpoint: string) { db().push = db().push.filter((x) => x.endpoint !== endpoint); },
  async markSent(key: string) {
    if (db().sent.has(key)) return false;
    db().sent.add(key);
    return true;
  },
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
  folder("Пример: Студия «Форма»", null, cl.id);
  folder("Личное", "Личное");
  rec.notes.push(row({ folder_id: blog.id, project: null, text: "Пример заметки: рубрики по дням недели" }));
  const c = (name: string, work: string, contract: number, sum: number, due: number | null, paid: boolean, last: number, waiting = "", extra = {}) =>
    row(SCHEMAS.clients.parse({ name, work, contract, sum, due: due === null ? null : addDays(t, due), paid, last_contact: addDays(t, last), waiting, ...extra }));
  rec.clients.push(
    c("Пример: Студия «Форма»", "Сайт + воронка", 0, 25_000_000, 10, false, -1, "Тексты для сайта"),
    c("Пример: Магазин «Ромашка»", "Поддержка сайта", 2, 5_000_000, null, false, -9, "", {
      contract_no: "12/2026", contract_from: addDays(t, -70), contract_until: addDays(t, 200), pay_day: 10,
    }),
    c("Пример: Денис", "Консультация", 2, 1_270_000, -6, true, -6),
  );
  const shop = rec.clients[1].id;
  rec.invoices.push(
    row({ client_id: shop, no: "1", date: addDays(t, -40), sum: 5_000_000, note: "" }),
    row({ client_id: shop, no: "2", date: addDays(t, -10), sum: 5_000_000, note: "" }),
  );
  const inc = (x: object) => row(SCHEMAS.income.parse(x));
  rec.income.push(
    inc({ date: addDays(t, -6), source: "Пример: Денис", note: "консультация", sum: 1_270_000, orig: "$100", client_id: rec.clients[2].id }),
    inc({ date: addDays(t, -35), source: "Пример: Магазин «Ромашка»", note: "счёт-фактура №1", sum: 5_000_000, client_id: shop, invoice_id: rec.invoices[0].id }),
    inc({ date: addDays(t, -3), source: "Пример: частный заказ", note: "правки сайта", sum: 600_000, account: "card" }));
  rec.charges.push(
    row({ type: "credit" as const, name: "Пример: автокредит", bank: "Капиталбанк", sum: 2_800_000, day: 8, start: null, until: addDays(t, 300), paid_to: null }),
    row({ type: "sub" as const, name: "Пример: Claude Pro", bank: "", sum: 260_000, day: 18, start: null, until: null, paid_to: null }),
  );
  rec.debts.push(row({ name: "Пример: долг за квартиру", note: "", total: 10_000_000, payments: [{ date: addDays(t, -2), sum: 3_000_000 }] }));
  const idea = (title: string, platform: "tg" | "ig" | "yt" | null, format: string, status: number, approved = true, extra = {}) =>
    row({ ...SCHEMAS.ideas.parse({ title, platform, format, status, approved }), ...extra });
  rec.ideas.push(
    idea("Пример: как отвечать на «дорого»", "ig", "reels", 0),
    idea("Пример: мой день в приложении", null, "", 0, false),
    idea("Пример: разбор сайта подписчика", "yt", "long", 1, true, { date: addDays(t, 3) }),
    idea("Пример: чек-лист перед звонком", "ig", "carousel", 3, true, { date: addDays(t, -2), reach: 7600, leads: 3 }),
  );
  rec.goals.push(row({
    title: "Пример: подушка безопасности", horizon: "year" as const, start: addDays(t, -40), deadline: addDays(t, 300), start_val: 0, target: 1,
    unit: "сум", why: "Спокойствие, если месяц будет пустым", kind: "savings" as const,
    hist: [{ date: addDays(t, -40), v: 0 }, { date: addDays(t, -10), v: 3_000_000 }],
    habits: [{ id: "h1", text: "С каждого прихода откладывать 10%", freq: "с каждой оплаты", log: [addDays(t, -6)] }],
  }), row({
    title: "Пример: вес 78 кг", horizon: "quarter" as const, start: addDays(t, -30), deadline: addDays(t, 60), start_val: 84, target: 78,
    unit: "кг", why: "Здоровье", kind: "" as const, hist: [{ date: addDays(t, -30), v: 84 }, { date: addDays(t, -2), v: 82.4 }], habits: [],
  }));
  rec.meetings.push(row({
    title: "Пример: созвон со Студией «Форма»", date: addDays(t, -1), folder_id: cl.id,
    summary: "Обсудили запуск сайта. Старт после подписания договора.",
    points: ["Предоплата 50%", "Первая версия через 3 недели"], questions: ["Кто согласует дизайн?"], tasks: ["Отправить договор и счёт"],
  }));
  return rec;
}
