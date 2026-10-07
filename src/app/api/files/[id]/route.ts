import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";

/** Opens a stored file: redirects to a link that works for one minute. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const f = (await store.list("files")).find((x) => x.id === id);
    if (!f) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const url = await store.signDownload(f.path, f.name);
    return NextResponse.redirect(new URL(url, _req.url), 302);
  } catch (e) {
    return fail(e);
  }
}
