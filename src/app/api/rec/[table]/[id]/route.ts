import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { isTable, parsePatch } from "@/lib/records";
import { getStore } from "@/lib/store";

export async function PATCH(req: Request, ctx: RouteContext<"/api/rec/[table]/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { table, id } = await ctx.params;
    if (!isTable(table)) return NextResponse.json({ error: "Нет такого раздела" }, { status: 404 });
    const r = parsePatch(table, await req.json().catch(() => ({})));
    if (!r.success || !Object.keys(r.data).length) return NextResponse.json({ error: "Нечего сохранять" }, { status: 400 });
    const row = await getStore().update(table, id, r.data);
    return row ? NextResponse.json({ row }) : NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/rec/[table]/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { table, id } = await ctx.params;
    if (!isTable(table)) return NextResponse.json({ error: "Нет такого раздела" }, { status: 404 });
    await getStore().remove(table, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
