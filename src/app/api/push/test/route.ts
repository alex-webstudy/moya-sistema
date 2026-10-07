import { NextResponse, type NextRequest } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { sendToAll } from "@/lib/push";
import { getStore } from "@/lib/store";

export async function POST(req: NextRequest) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    if (!(await getStore().listPushSubs()).length) return NextResponse.json({ error: "Нет устройств с включёнными напоминаниями" }, { status: 400 });
    const n = await sendToAll({ key: "test", title: "Моя система", body: "Напоминания работают", url: "/settings" }, req.nextUrl.origin);
    return n ? NextResponse.json({ sent: n }) : NextResponse.json({ error: "Не дошло до устройства: выключи и включи напоминания заново" }, { status: 502 });
  } catch (e) {
    return fail(e);
  }
}
