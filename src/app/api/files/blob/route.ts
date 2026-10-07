import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";
import { blobs } from "@/lib/store/memory";

// Demo mode only: stands in for the storage bucket so uploads work without a database.
const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

async function check(req: Request) {
  const deny = await unauthorized();
  if (deny) return { deny };
  if (!getStore().demo) return { deny: NextResponse.json({ error: "Нет" }, { status: 404 }) };
  const u = new URL(req.url);
  const path = u.searchParams.get("path") ?? "";
  if (!PATH.test(path)) return { deny: NextResponse.json({ error: "Неверный путь" }, { status: 400 }) };
  return { path, name: u.searchParams.get("name") ?? "file" };
}

export async function PUT(req: Request) {
  const c = await check(req);
  if (c.deny) return c.deny;
  const data = await req.arrayBuffer();
  if (data.byteLength > 50 * 1024 * 1024) return NextResponse.json({ error: "Файл до 50 МБ" }, { status: 413 });
  blobs().set(c.path!, { data, type: req.headers.get("content-type") ?? "application/octet-stream" });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const c = await check(req);
  if (c.deny) return c.deny;
  const b = blobs().get(c.path!);
  if (!b) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  return new Response(b.data, { headers: { "content-type": b.type, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(c.name!)}` } });
}
