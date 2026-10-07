import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { DEFAULT_SETTINGS, TABLES } from "@/lib/records";
import { getStore } from "@/lib/store";

export async function GET() {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const store = getStore();
    // Phase 2 tables may not exist yet if the new migration hasn't been run: the app keeps working without them.
    let migrate = false;
    const soft = <T,>(p: Promise<T>, empty: T) => p.catch((e) => { console.error(e); migrate = true; return empty; });
    const [tasks, thoughts, settings, ...lists] = await Promise.all([
      store.listTasks(), store.listThoughts(), soft(store.getSettings(), {}), ...TABLES.map((t) => soft(store.list(t), [])),
    ]);
    const rec = Object.fromEntries(TABLES.map((t, i) => [t, lists[i]]));
    return NextResponse.json({ tasks, thoughts, rec, settings: { ...DEFAULT_SETTINGS, ...settings }, migrate, demo: store.demo, ai: aiEnabled(), today: todayISO() });
  } catch (e) {
    return fail(e);
  }
}
