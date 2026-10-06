import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";
import { toTaskPatch } from "@/lib/validate";

export async function PATCH(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { id } = await ctx.params;
    const task = await getStore().updateTask(id, toTaskPatch(await req.json().catch(() => ({}))));
    return task ? NextResponse.json({ task }) : NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    await getStore().deleteTask((await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
