import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/thoughts/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    await getStore().deleteThoughts([(await ctx.params).id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
