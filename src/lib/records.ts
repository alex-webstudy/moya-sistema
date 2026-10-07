// Phase 2 records: one schema per table, shared by the API (validation) and the client (types).
import { z } from "zod/v4";

const text = (max: number) => z.string().trim().max(max);
const name = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const money = z.number().int().min(0).max(1e15);

export const SCHEMAS = {
  folders: z.object({
    parent_id: uuid.nullable().default(null),
    name: name(120),
    project: text(60).nullable().default(null),
  }),
  notes: z.object({
    folder_id: uuid.nullable().default(null),
    project: text(60).nullable().default(null),
    text: name(4000),
  }),
  clients: z.object({
    name: name(200),
    work: text(300).default(""),
    contract: z.number().int().min(0).max(2).default(0),
    sum: money.default(0),
    due: date.nullable().default(null),
    paid: z.boolean().default(false),
    last_contact: date,
    waiting: text(300).default(""),
    // Contract: number and term; pay_day set means a monthly payment of `sum` on that day.
    contract_no: text(60).default(""),
    contract_from: date.nullable().default(null),
    contract_until: date.nullable().default(null),
    pay_day: z.number().int().min(1).max(31).nullable().default(null),
  }),
  // Invoices (счета-фактуры) issued to a client; paid by income rows that point at them.
  invoices: z.object({
    client_id: uuid,
    no: name(40),
    date,
    sum: money.min(1),
    note: text(300).default(""),
  }),
  // Contract and invoice files in private storage; `path` is set by the server when it signs the upload.
  files: z.object({
    client_id: uuid,
    invoice_id: uuid.nullable().default(null),
    kind: z.enum(["contract", "invoice", "other"]).default("other"),
    name: name(255),
    path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/),
    size: z.number().int().min(0).max(50 * 1024 * 1024),
    type: text(120).default(""),
  }),
  meetings: z.object({
    title: name(200),
    date,
    folder_id: uuid.nullable().default(null),
    summary: text(4000).default(""),
    points: z.array(text(500)).max(30).default([]),
    questions: z.array(text(500)).max(30).default([]),
    tasks: z.array(text(500)).max(50).default([]),
  }),
  income: z.object({
    date,
    source: name(200),
    note: text(300).default(""),
    sum: money.min(1),
    orig: text(60).default(""),
    client_id: uuid.nullable().default(null),
    // "rs": the ИП settlement account (taxed 1%); "card": personal card.
    account: z.enum(["rs", "card"]).default("rs"),
    invoice_id: uuid.nullable().default(null),
  }),
  charges: z.object({
    type: z.enum(["credit", "sub"]),
    name: name(200),
    bank: text(200).default(""),
    sum: money.min(1),
    day: z.number().int().min(1).max(31),
    // Instalments: first and last payment dates; empty for open-ended subscriptions.
    start: date.nullable().default(null),
    until: date.nullable().default(null),
    // Date of the last payment he confirmed; this month's total drops it once confirmed.
    paid_to: date.nullable().default(null),
  }),
  // Debts are paid down in parts and counted apart from the monthly charges.
  debts: z.object({
    name: name(200),
    note: text(300).default(""),
    total: money.min(1),
    payments: z.array(z.object({ date, sum: money.min(1) })).max(500).default([]),
  }),
  taxes: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    tax: money,
    note: text(300).default(""),
  }),
  // Phase 3: health, lists.
  days: z.object({
    date,
    workout: z.boolean().nullable().default(null),
    workout_note: text(2000).default(""),
    water: z.number().min(0).max(20).default(0),
    food_ok: z.boolean().nullable().default(null),
    food: z.array(z.object({ name: name(200), kcal: z.number().int().min(0).max(20000), protein: z.number().int().min(0).max(1000) })).max(60).default([]),
    ev_tasks: z.boolean().default(false),
    ev_tomorrow: z.boolean().default(false),
  }),
  measures: z.object({
    date,
    weight: z.number().positive().max(500).nullable().default(null),
    waist: z.number().positive().max(500).nullable().default(null),
    arms: z.number().positive().max(500).nullable().default(null),
    chest: z.number().positive().max(500).nullable().default(null),
  }),
  list_items: z.object({
    list: z.enum(["buy", "books", "films"]),
    text: name(300),
    done: z.boolean().default(false),
  }),
  purchases: z.object({
    date,
    name: name(200),
    sum: money.min(1),
    items: z.array(name(200)).max(100).default([]),
    orig: text(60).default(""),
  }),
  trips: z.object({
    title: name(200),
    city: text(120).default(""),
    date,
    date2: date.nullable().default(null),
    note: text(500).default(""),
  }),
  saved: z.object({
    url: text(2000).default(""),
    title: name(300),
    note: text(1000).default(""),
  }),
  // Phase 4: content, goals, week reviews, the password vault.
  ideas: z.object({
    title: name(300),
    // Empty platform: waits for approval with Claude's suggestion.
    platform: z.enum(["tg", "ig", "yt"]).nullable().default(null),
    format: text(20).default(""),
    why: text(300).default(""),
    approved: z.boolean().default(true),
    // 0 idea bank, 1 in work, 2 edited, 3 published.
    status: z.number().int().min(0).max(3).default(0),
    date: date.nullable().default(null),
    reach: z.number().int().min(0).max(1e9).nullable().default(null),
    leads: z.number().int().min(0).max(1e6).nullable().default(null),
    script: text(10000).default(""),
  }),
  goals: z.object({
    title: name(200),
    horizon: z.enum(["year", "quarter", "month"]).default("year"),
    start: date,
    deadline: date,
    start_val: z.number().min(-1e15).max(1e15).default(0),
    target: z.number().min(-1e15).max(1e15),
    unit: text(20).default(""),
    why: text(300).default(""),
    // "savings": the safety cushion, its target is 6 months of obligatory payments.
    kind: z.enum(["", "savings"]).default(""),
    hist: z.array(z.object({ date, v: z.number().min(-1e15).max(1e15) })).max(1000).default([]),
    habits: z.array(z.object({ id: z.string().max(40), text: name(300), freq: text(60).default(""), log: z.array(date).max(400).default([]) })).max(20).default([]),
  }),
  weeks: z.object({
    week: date, // Monday
    review: text(6000).default(""),
    focus: z.array(text(300)).max(10).default([]),
  }),
  // Encrypted in the browser with the master password; the server only ever sees ciphertext.
  vault: z.object({
    data: z.string().min(1).max(40000),
    iv: z.string().min(1).max(40),
  }),
} as const;

export type Table = keyof typeof SCHEMAS;
export const TABLES = Object.keys(SCHEMAS) as Table[];
export const isTable = (t: string): t is Table => t in SCHEMAS;

type Row<T extends Table> = z.output<(typeof SCHEMAS)[T]> & { id: string; created_at: string };
export type Folder = Row<"folders">;
export type FolderNote = Row<"notes">;
export type Client = Row<"clients">;
export type Meeting = Row<"meetings">;
export type Income = Row<"income">;
export type Charge = Row<"charges">;
export type Debt = Row<"debts">;
export type Tax = Row<"taxes">;
export type Invoice = Row<"invoices">;
export type FileRow = Row<"files">;
export type Day = Row<"days">;
export type Measure = Row<"measures">;
export type ListItem = Row<"list_items">;
export type Purchase = Row<"purchases">;
export type Trip = Row<"trips">;
export type Saved = Row<"saved">;
export type IdeaRow = Row<"ideas">;
export type Goal = Row<"goals">;
export type Week = Row<"weeks">;
export type VaultRow = Row<"vault">;
export type Food = Day["food"][number];
export type Records = { [T in Table]: Row<T>[] };

/** Validate a new row; unknown keys are dropped. */
export const parseNew = (t: Table, x: unknown) => SCHEMAS[t].safeParse(x);
/** Validate a partial update. Zod 4 fills defaults even in .partial(), so keep only the keys that were sent. */
export function parsePatch(t: Table, x: unknown) {
  const r = (SCHEMAS[t] as z.ZodObject).partial().safeParse(x);
  if (!r.success) return r;
  const sent = new Set(Object.keys((x ?? {}) as object));
  return { ...r, data: Object.fromEntries(Object.entries(r.data).filter(([k]) => sent.has(k))) };
}

// Settings: small key/value pairs.
export const SETTINGS = {
  rates: z.object({ usd: z.number().positive().max(1e7), rub: z.number().positive().max(1e6) }),
  theme: z.enum(["auto", "light", "dark"]),
  contract_tpl: z.string().max(20000),
  kcal_norm: z.number().int().min(800).max(6000),
  training: z.object({ days: z.array(z.number().int().min(0).max(6)).max(7), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  dish_prefs: z.record(z.string().max(200), z.union([z.literal(1), z.literal(-1)])),
  menu: z.object({
    date,
    items: z.array(z.object({ meal: z.enum(["breakfast", "lunch", "dinner", "snack"]), name: name(200), portion: text(100), kcal: z.number().int().min(0).max(5000), protein: z.number().int().min(0).max(500) })).max(40),
  }).nullable(),
  followers: z.object({ ig: z.array(z.object({ date, n: z.number().int().min(0).max(1e9) })).max(400), yt: z.array(z.object({ date, n: z.number().int().min(0).max(1e9) })).max(400), tg: z.array(z.object({ date, n: z.number().int().min(0).max(1e9) })).max(400) }),
  // Salt and an encrypted check value for the vault master password; no password or key is stored.
  vault_meta: z.object({ salt: z.string().max(60), iv: z.string().max(40), check: z.string().max(200) }).nullable(),
  // The owner's chat with the Telegram bot; messages from any other chat are ignored.
  telegram: z.object({ chat_id: z.number().int(), name: z.string().max(100) }).nullable(),
} as const;
export type SettingKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingKey]: z.output<(typeof SETTINGS)[K]> };
export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;

export const DEFAULT_SETTINGS: Settings = {
  rates: { usd: 12700, rub: 155 },
  theme: "auto",
  kcal_norm: 2500,
  training: { days: [2, 4, 6], start: "10:00", end: "12:30" },
  dish_prefs: {},
  menu: null,
  followers: { ig: [], yt: [], tg: [] },
  vault_meta: null,
  telegram: null,
  contract_tpl: `ДОГОВОР ОКАЗАНИЯ УСЛУГ № {{номер}}

г. {{город}}, {{дата}}

Индивидуальный предприниматель Кутепов Алексей, именуемый «Исполнитель», и {{заказчик}}, именуемый «Заказчик», заключили настоящий договор.

1. Предмет договора: {{услуги}}.
2. Стоимость услуг: {{сумма}} сум. Оплата: {{порядок_оплаты}}.
3. Срок оказания услуг: {{срок}}.

Реквизиты и подписи сторон:
Исполнитель: ИП Кутепов Алексей
Заказчик: {{заказчик}}`,
};
