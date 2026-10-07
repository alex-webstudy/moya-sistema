import { NextResponse, type NextRequest } from "next/server";
import { todayISO, TZ } from "@/lib/dates";
import { fail } from "@/lib/guard";
import { cronTokenOk, sendToAll } from "@/lib/push";
import { reminders } from "@/lib/reminders";
import { loadSnapshot } from "@/lib/snapshot";
import { getStore } from "@/lib/store";
import { send, tgEnabled } from "@/lib/telegram";

// Called every 15 minutes by pg_cron in Supabase (not by the browser, so it has its own token instead of a session).
export async function POST(req: NextRequest) {
  if (!cronTokenOk(req.headers.get("authorization"))) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  try {
    const store = getStore();
    const snap = await loadSnapshot(store);
    const chat = tgEnabled() ? snap.settings.telegram?.chat_id : undefined;
    if (!chat && !(await store.listPushSubs()).length) return NextResponse.json({ sent: [] });
    const now = new Date();
    const today = todayISO(now);
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    const due = reminders(snap, today, hm, new Set());
    const sent: string[] = [];
    for (const p of due) {
      // The log decides: a reminder already sent by an earlier run is skipped.
      if (!(await store.markSent(p.key))) continue;
      // Every reminder goes to the phone and, once the bot is connected, to Telegram too.
      let ok = (await sendToAll(p, req.nextUrl.origin)) > 0;
      if (chat) ok = (await send(chat, `${p.title}\n${p.body}`).then(() => true, (e) => { console.error("tg", e); return false; })) || ok;
      if (ok) sent.push(p.key);
    }
    return NextResponse.json({ sent });
  } catch (e) {
    return fail(e);
  }
}
