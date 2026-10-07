// Money: everything is stored in сум (UZS); $ and ₽ are converted by the rates from Settings.
import type { Settings } from "./records";

export const rub = (n: number) => Math.round(n || 0).toLocaleString("ru-RU") + " сум";

export const CUR = [["uzs", "сум"], ["usd", "$"], ["rub", "₽"]] as const;
export type Cur = (typeof CUR)[number][0];

/** Amount in сум plus a note of the original amount when it was entered in another currency. */
export function toUZS(amount: number, cur: Cur, rates: Settings["rates"]): { sum: number; orig: string } {
  if (cur === "uzs") return { sum: Math.round(amount), orig: "" };
  const rate = cur === "usd" ? rates.usd : rates.rub;
  return { sum: Math.round(amount * rate), orig: amount.toLocaleString("ru-RU") + (cur === "usd" ? " $" : " ₽") };
}

/** Next date (today or later) a monthly charge on `day` falls on; short months use their last day. */
export function nextCharge(day: number, today: string): string {
  const [y, m] = today.split("-").map(Number);
  const on = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  const here = on(y, m);
  if (here >= today) return here;
  return m === 12 ? on(y + 1, 1) : on(y, m + 1);
}

type Sched = { day: number; start: string | null; until: string | null; paid_to?: string | null };
const addDay = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

/**
 * Earliest payment not yet confirmed, counting from the start of this month: a payment whose day has passed
 * stays due until it is marked paid. Null when everything up to the last payment is confirmed.
 */
export function chargeNext(c: Sched, today: string): string | null {
  let from = today.slice(0, 8) + "01";
  if (c.start && c.start > from) from = c.start;
  if (c.paid_to && c.paid_to >= from) from = addDay(c.paid_to);
  const next = nextCharge(c.day, from);
  return c.until && next > c.until ? null : next;
}

/** This month's payment when it is still unconfirmed. */
export function dueThisMonth(c: Sched, today: string): string | null {
  const next = chargeNext(c, today);
  return next && next.slice(0, 7) === today.slice(0, 7) ? next : null;
}

/** The payment before `d` (for undoing a confirmation), or null before the first one. */
export function prevCharge(c: Sched, d: string): string | null {
  const [y, m] = d.split("-").map(Number);
  const p = nextCharge(c.day, m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`);
  return c.start && p < c.start ? null : p;
}

/** Payments left including the next one; null for open-ended charges. */
export function paymentsLeft(c: Sched, today: string): number | null {
  const next = chargeNext(c, today);
  if (!c.until) return null;
  if (!next) return 0;
  const [y1, m1] = next.split("-").map(Number), [y2, m2] = c.until.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

/** The 10th of this month if it hasn't passed, otherwise of the next one: the ИП report and contributions deadline. */
export function nextTaxDate(today: string): string {
  return nextCharge(10, today);
}

export const monthKey = (today: string) => today.slice(0, 7);
