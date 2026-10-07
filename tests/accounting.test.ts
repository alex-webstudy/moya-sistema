import { describe, expect, it } from "vitest";
import { invoiceState, ledger, needsInvoice, nextNo, payDate } from "../src/lib/accounting";
import { SCHEMAS, type Client, type Income, type Invoice } from "../src/lib/records";

const client = (x: Partial<Client> = {}) => ({ ...SCHEMAS.clients.parse({ name: "Ромашка", last_contact: "2026-10-01", sum: 5_000_000, pay_day: 10, contract_from: "2026-08-01", contract_until: "2026-12-31" }), id: "c1", created_at: "", ...x }) as Client;
const inv = (id: string, date: string, sum = 5_000_000, created_at = date) => ({ id, client_id: "c1", no: id, date, sum, note: "", created_at }) as Invoice;
const inc = (invoice_id: string | null, sum: number) => ({ date: "2026-10-01", source: "x", note: "", orig: "", account: "rs", sum, client_id: "c1", invoice_id, id: Math.random().toString(), created_at: "" }) as Income;

describe("accounting", () => {
  it("invoice state follows the money linked to it", () => {
    const i = inv("1", "2026-09-05");
    expect(invoiceState(i, [])).toBe("wait");
    expect(invoiceState(i, [inc("1", 2_000_000)])).toBe("part");
    expect(invoiceState(i, [inc("1", 2_000_000), inc("1", 3_000_000)])).toBe("paid");
  });
  it("counts invoiced, paid, owed and what's ahead on the contract", () => {
    const l = ledger(client(), [inv("1", "2026-09-05"), inv("2", "2026-10-03")], [inc("1", 5_000_000), inc(null, 1_000_000)], "2026-10-07");
    expect(l).toEqual({ count: 2, invoiced: 10_000_000, paid: 5_000_000, owed: 5_000_000, ahead: 10_000_000, paidAll: 6_000_000 });
    // October not invoiced yet: Oct, Nov, Dec still ahead.
    expect(ledger(client(), [inv("1", "2026-09-05")], [], "2026-10-07").ahead).toBe(15_000_000);
    expect(ledger(client({ contract_until: null }), [], [], "2026-10-07").ahead).toBeNull();
    expect(ledger(client({ pay_day: null }), [], [], "2026-10-07").ahead).toBe(0);
  });
  it("reminds to invoice a monthly client once a month", () => {
    expect(needsInvoice(client(), [], "2026-10-07")).toBe(true);
    expect(needsInvoice(client(), [inv("2", "2026-10-03")], "2026-10-07")).toBe(false);
    expect(needsInvoice(client({ contract_until: "2026-09-30" }), [], "2026-10-07")).toBe(false);
    expect(needsInvoice(client({ pay_day: null }), [], "2026-10-07")).toBe(false);
    expect(payDate(client({ pay_day: 31 }), "2026-11-07")).toBe("2026-11-30");
  });
  it("numbers the next invoice", () => {
    expect(nextNo([])).toBe("1");
    expect(nextNo([inv("12/2026-09", "2026-09-01")])).toBe("12/2026-10");
    expect(nextNo([inv("7", "2026-09-01", 1, "a"), inv("8", "2026-10-01", 1, "b")])).toBe("9");
    expect(nextNo([inv("A", "2026-09-01")])).toBe("A-2");
  });
});
