import { describe, expect, it } from "vitest";
import { createECDH } from "node:crypto";
import { briefLines, eveningDone, reminders, type Snapshot } from "../src/lib/reminders";
import { DEFAULT_SETTINGS, SCHEMAS, type Charge, type Client, type Day } from "../src/lib/records";
import type { Task } from "../src/lib/types";

// 2026-10-08 is a Thursday (training day); 2026-10-11 is a Sunday.
const task = (x: Partial<Task>): Task => ({ id: "t" + Math.random(), title: "Дело", project: "Клиенты", due: "2026-10-08", time: null, done: false, created_at: "", ...x });
const charge = (x: Partial<Charge>) => ({ ...SCHEMAS.charges.parse({ type: "credit", name: "Автокредит", sum: 2_800_000, day: 9 }), id: "ch", created_at: "", ...x }) as Charge;
const client = (x: Partial<Client>) => ({ ...SCHEMAS.clients.parse({ name: "Ромашка", sum: 5_000_000, last_contact: "2026-10-07" }), id: "c1", created_at: "", ...x }) as Client;
const day = (x: Partial<Day>) => ({ ...SCHEMAS.days.parse({ date: "2026-10-08" }), id: "d", created_at: "", ...x }) as Day;
const snap = (x: Partial<Omit<Snapshot, "rec">> & { rec?: Partial<Snapshot["rec"]> } = {}): Snapshot => ({
  tasks: [], thoughts: [], settings: DEFAULT_SETTINGS, ...x,
  rec: { charges: [], clients: [], invoices: [], days: [], ...x.rec },
});
// Numbers are formatted with non-breaking spaces.
const sp = (x: string) => x.replace(/\s/g, " ");
const keys = (s: Snapshot, d: string, hm: string, sent: string[] = []) => reminders(s, d, hm, new Set(sent)).map((p) => p.key);

describe("reminders", () => {
  it("sends the brief once, within an hour after 11:00", () => {
    expect(keys(snap(), "2026-10-08", "10:45")).toEqual([]);
    expect(keys(snap(), "2026-10-08", "11:00")).toEqual(["brief:2026-10-08"]);
    expect(keys(snap(), "2026-10-08", "11:45")).toEqual(["brief:2026-10-08"]);
    expect(keys(snap(), "2026-10-08", "11:15", ["brief:2026-10-08"])).toEqual([]);
    expect(keys(snap(), "2026-10-08", "12:00")).toEqual([]);
  });
  it("brief lists tasks, training, charges, client payments and invoices", () => {
    const s = snap({
      tasks: [task({ title: "Созвон", time: "15:00" }), task({ title: "Старое", due: "2026-10-05" }), task({ title: "Готово", done: true })],
      rec: { charges: [charge({})], clients: [client({ pay_day: 8, contract_no: "12" })] },
    });
    const lines = briefLines(s, "2026-10-08").map(sp);
    expect(lines[0]).toBe("Задачи: 2 дела · 15:00 Созвон; Старое");
    expect(lines).toContain("Тренировка 10:00–12:30");
    expect(lines).toContain("Списание завтра: Автокредит, 2 800 000 сум");
    expect(lines).toContain("Ждём оплату: Ромашка, 5 000 000 сум");
    expect(lines).toContain("Выставить счёт-фактуру: Ромашка");
    expect(briefLines(snap({ rec: { charges: [charge({ paid_to: "2026-10-09" })] } }), "2026-10-08").map(sp)).not.toContain("Списание завтра: Автокредит, 2 800 000 сум");
    expect(briefLines(snap(), "2026-10-10")).toContain("Сегодня отчёт ИП, минималка и пенсионный");
  });
  it("repeats the evening review every 30 minutes until it is filled in", () => {
    expect(keys(snap(), "2026-10-08", "21:00")).toEqual(["evening:2026-10-08:21:00"]);
    expect(keys(snap(), "2026-10-08", "21:15", ["evening:2026-10-08:21:00"])).toEqual([]);
    expect(keys(snap(), "2026-10-08", "21:30", ["evening:2026-10-08:21:00"])).toEqual(["evening:2026-10-08:21:30"]);
    expect(keys(snap(), "2026-10-08", "23:00")).toEqual([]);
    const filled = snap({ tasks: [task({ due: "2026-10-09" })], rec: { days: [day({ workout: true, water: 1.5, food_ok: true })] } });
    expect(eveningDone(filled, "2026-10-08")).toBe(true);
    expect(keys(filled, "2026-10-08", "21:30")).toEqual([]);
  });
  it("sends the week review on Sunday at 20:00 only", () => {
    expect(keys(snap(), "2026-10-11", "20:00")).toEqual(["week:2026-10-11"]);
    expect(keys(snap(), "2026-10-08", "20:00")).toEqual([]);
  });
  it("reminds 15 minutes before a timed task", () => {
    const s = snap({ tasks: [task({ id: "a", time: "15:10" })] });
    expect(keys(s, "2026-10-08", "14:45")).toEqual([]);
    expect(keys(s, "2026-10-08", "15:00")).toEqual(["task:a:2026-10-08:15:10"]);
    expect(keys(s, "2026-10-08", "15:15")).toEqual([]);
  });
});

describe("push keys", () => {
  it("a 32-byte HMAC is a valid P-256 private key", () => {
    const e = createECDH("prime256v1");
    e.setPrivateKey(Buffer.alloc(32, 7));
    expect(e.getPublicKey().length).toBe(65);
  });
});
