// Clients as a small accounting corner: what was invoiced, what came in, what is still owed.
import { nextCharge } from "./money";
import type { Client, Income, Invoice } from "./records";

/** Money received against one invoice (it can be paid in parts). */
export const paidOn = (inv: Pick<Invoice, "id">, income: Pick<Income, "invoice_id" | "sum">[]) =>
  income.reduce((s, i) => s + (i.invoice_id === inv.id ? i.sum : 0), 0);

export type InvoiceState = "paid" | "part" | "wait";
export function invoiceState(inv: Invoice, income: Pick<Income, "invoice_id" | "sum">[]): InvoiceState {
  const p = paidOn(inv, income);
  return p >= inv.sum ? "paid" : p > 0 ? "part" : "wait";
}

const ym = (d: string) => d.slice(0, 7);
const months = (a: string, b: string) => { const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1); };

/** A monthly contract that runs this month (started, not ended). */
export const isMonthly = (c: Pick<Client, "pay_day">) => c.pay_day !== null;
export const activeNow = (c: Pick<Client, "contract_from" | "contract_until">, today: string) =>
  (!c.contract_from || ym(c.contract_from) <= ym(today)) && (!c.contract_until || ym(c.contract_until) >= ym(today));

/** A monthly client has no invoice dated this month yet. */
export function needsInvoice(c: Client, invoices: Pick<Invoice, "client_id" | "date">[], today: string) {
  return isMonthly(c) && activeNow(c, today) && !invoices.some((i) => i.client_id === c.id && ym(i.date) === ym(today));
}

/** This month's payment date for a monthly client. */
export const payDate = (c: Pick<Client, "pay_day">, today: string) => (c.pay_day ? nextCharge(c.pay_day, today.slice(0, 8) + "01") : null);

export type Ledger = { count: number; invoiced: number; paid: number; owed: number; ahead: number | null; paidAll: number };

/**
 * paid: received against this client's invoices; owed: invoiced but not yet received;
 * ahead: monthly payments still to invoice until the contract ends (null when it has no end date).
 */
export function ledger(c: Client, invoices: Invoice[], income: Income[], today: string): Ledger {
  const inv = invoices.filter((i) => i.client_id === c.id);
  const invoiced = inv.reduce((s, i) => s + i.sum, 0);
  const paid = inv.reduce((s, i) => s + Math.min(i.sum, paidOn(i, income)), 0);
  const paidAll = income.filter((i) => i.client_id === c.id).reduce((s, i) => s + i.sum, 0);
  let ahead: number | null = 0;
  if (isMonthly(c)) {
    if (!c.contract_until) ahead = null;
    else {
      // From this month (or the next, if this month is already invoiced) through the contract's last month.
      let from = ym(today);
      if (c.contract_from && ym(c.contract_from) > from) from = ym(c.contract_from);
      if (inv.some((i) => ym(i.date) === from)) from = ym(nextCharge(1, from + "-28"));
      const n = months(from, ym(c.contract_until)) + 1;
      ahead = Math.max(0, n) * c.sum;
    }
  }
  return { count: inv.length, invoiced, paid, owed: Math.max(0, invoiced - paid), ahead, paidAll };
}

/** Next invoice number: the last one plus one when it ends in digits («12/2026-3» → «12/2026-4»). */
export function nextNo(invoices: Pick<Invoice, "no" | "created_at">[]): string {
  const last = [...invoices].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)?.no;
  if (!last) return "1";
  const m = last.match(/^(.*?)(\d+)$/);
  return m ? m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0") : last + "-2";
}
