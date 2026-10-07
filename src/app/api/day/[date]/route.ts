import { NextResponse } from "next/server";
import { isISODate } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { parsePatch } from "@/lib/records";
import { getStore } from "@/lib/store";

// Health day: PUT sends only the fields that changed; the row is created on first write.
export async function PUT(req: Request, ctx: RouteContext<"/api/day/[date]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { date } = await ctx.params;
    if (!isISODate(date)) return NextResponse.json({ error: "Неверная дата" }, { status: 400 });
    const r = parsePatch("days", await req.json().catch(() => ({})));
    if (!r.success) return NextResponse.json({ error: "Проверь поля" }, { status: 400 });
    const { date: _drop, ...patch } = r.data as Record<string, unknown>;
    void _drop;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Нечего сохранять" }, { status: 400 });
    return NextResponse.json({ day: await getStore().upsertDay(date, patch) });
  } catch (e) {
    return fail(e);
  }
}
