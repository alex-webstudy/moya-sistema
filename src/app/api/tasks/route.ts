import { NextResponse } from "next/server";
import { addDays, todayISO } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";
import { toNewTask } from "@/lib/validate";
import type { NewTask } from "@/lib/types";

// Body: { tasks: [...] } — one or many; invalid items are dropped.
export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { tasks?: unknown };
    const fallback = addDays(todayISO(), 1);
    const items = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 100).map((x) => toNewTask(x, fallback)).filter((x): x is NewTask => !!x);
    if (!items.length) return NextResponse.json({ error: "Нет задач с названием" }, { status: 400 });
    return NextResponse.json({ tasks: await getStore().addTasks(items) });
  } catch (e) {
    return fail(e);
  }
}
