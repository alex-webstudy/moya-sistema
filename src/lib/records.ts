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
  }),
  charges: z.object({
    type: z.enum(["credit", "sub"]),
    name: name(200),
    bank: text(200).default(""),
    sum: money.min(1),
    day: z.number().int().min(1).max(31),
  }),
  taxes: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    tax: money,
    note: text(300).default(""),
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
export type Tax = Row<"taxes">;
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
} as const;
export type SettingKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingKey]: z.output<(typeof SETTINGS)[K]> };
export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;

export const DEFAULT_SETTINGS: Settings = {
  rates: { usd: 12700, rub: 155 },
  theme: "auto",
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
