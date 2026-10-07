import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE = 50 * 1024 * 1024;

/** A one-time upload URL for a client's file. The stored name is random; the real name stays in the files table. */
export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const b = (await req.json().catch(() => ({}))) as { client_id?: unknown; name?: unknown; size?: unknown };
    if (typeof b.client_id !== "string" || !UUID.test(b.client_id)) return NextResponse.json({ error: "Не указан клиент" }, { status: 400 });
    if (typeof b.size !== "number" || b.size <= 0 || b.size > MAX_FILE) return NextResponse.json({ error: "Файл до 50 МБ" }, { status: 400 });
    const ext = (typeof b.name === "string" ? b.name.split(".").pop() ?? "" : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${b.client_id.toLowerCase()}/${crypto.randomUUID()}.${ext}`;
    return NextResponse.json({ path, url: await getStore().signUpload(path) });
  } catch (e) {
    return fail(e);
  }
}
