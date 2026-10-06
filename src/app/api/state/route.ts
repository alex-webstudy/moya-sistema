import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";

export async function GET() {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const store = getStore();
    const [tasks, thoughts] = await Promise.all([store.listTasks(), store.listThoughts()]);
    return NextResponse.json({ tasks, thoughts, demo: store.demo, ai: aiEnabled(), today: todayISO() });
  } catch (e) {
    return fail(e);
  }
}
