import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";

const b64url = /^[A-Za-z0-9_-]{8,200}$/;

export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; device?: unknown };
    const endpoint = typeof b.endpoint === "string" && b.endpoint.startsWith("https://") && b.endpoint.length < 1000 ? b.endpoint : "";
    const p256dh = typeof b.keys?.p256dh === "string" && b64url.test(b.keys.p256dh) ? b.keys.p256dh : "";
    const auth = typeof b.keys?.auth === "string" && b64url.test(b.keys.auth) ? b.keys.auth : "";
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: "Браузер не дал подписку на уведомления" }, { status: 400 });
    const device = typeof b.device === "string" ? b.device.slice(0, 60) : "";
    await getStore().savePushSub({ endpoint, p256dh, auth, device });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
    if (typeof b.endpoint === "string") await getStore().removePushSub(b.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
