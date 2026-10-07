import { NextResponse, type NextRequest } from "next/server";
import { todayISO, TZ } from "@/lib/dates";
import { fail } from "@/lib/guard";
import { cronTokenOk, sendToAll } from "@/lib/push";
import { DEFAULT_SETTINGS } from "@/lib/records";
import { reminders } from "@/lib/reminders";
import { getStore } from "@/lib/store";

// Called every 15 minutes by pg_cron in Supabase (not by the browser, so it has its own token instead of a session).
export async function POST(req: NextRequest) {
  if (!cronTokenOk(req.headers.get("authorization"))) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  try {
    const store = getStore();
    if (!(await store.listPushSubs()).length) return NextResponse.json({ sent: [] });
    const now = new Date();
    const today = todayISO(now);
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    const [tasks, thoughts, charges, clients, invoices, days, settings] = await Promise.all([
      store.listTasks(), store.listThoughts(), store.list("charges"), store.list("clients"), store.list("invoices"), store.list("days"), store.getSettings(),
    ]);
    const due = reminders({ tasks, thoughts, rec: { charges, clients, invoices, days }, settings: { ...DEFAULT_SETTINGS, ...settings } }, today, hm, new Set());
    const sent: string[] = [];
    for (const p of due) {
      // The log decides: a reminder already sent by an earlier run is skipped.
      if (!(await store.markSent(p.key))) continue;
      if (await sendToAll(p, req.nextUrl.origin)) sent.push(p.key);
    }
    return NextResponse.json({ sent });
  } catch (e) {
    return fail(e);
  }
}
