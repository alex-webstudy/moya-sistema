import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { isTable, parseNew } from "@/lib/records";
import { getStore } from "@/lib/store";

// Body: { rows: [...] }. Every row is validated against the table's schema; one bad row rejects the batch.
export async function POST(req: Request, ctx: RouteContext<"/api/rec/[table]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { table } = await ctx.params;
    if (!isTable(table)) return NextResponse.json({ error: "Нет такого раздела" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { rows?: unknown };
    const input = Array.isArray(body.rows) ? body.rows.slice(0, 200) : [];
    const parsed = input.map((x) => parseNew(table, x));
    const bad = parsed.findIndex((r) => !r.success);
    if (!input.length || bad >= 0) return NextResponse.json({ error: "Проверь поля: " + (bad >= 0 ? parsed[bad].error?.issues[0]?.path.join(".") : "пусто") }, { status: 400 });
    return NextResponse.json({ rows: await getStore().insert(table, parsed.map((r) => r.data!)) });
  } catch (e) {
    return fail(e);
  }
}
