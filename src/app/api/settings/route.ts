import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { isSettingKey, SETTINGS } from "@/lib/records";
import { getStore } from "@/lib/store";

// Body: { key, value } — one setting at a time.
export async function PUT(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
    if (!body.key || !isSettingKey(body.key)) return NextResponse.json({ error: "Нет такой настройки" }, { status: 400 });
    const r = SETTINGS[body.key].safeParse(body.value);
    if (!r.success) return NextResponse.json({ error: "Неверное значение" }, { status: 400 });
    await getStore().setSetting(body.key, r.data as never);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
