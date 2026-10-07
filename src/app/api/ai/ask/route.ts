import { NextResponse } from "next/server";
import { AIError, askText, type Picture } from "@/lib/ai";
import { fail, unauthorized } from "@/lib/guard";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_PROMPT = 120_000; // a long meeting transcript fits
const MAX_PICTURE = 6_000_000; // base64, ~4.5 MB of file

// A long answer (week review, meeting) can take a minute or two.
export const maxDuration = 300;

// Answers one of the app's ready-made requests; the client puts the text where the owner would paste it.
export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; picture?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
    if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: "Слишком длинный текст для одного запроса" }, { status: 400 });
    const p = body.picture as Picture | undefined;
    const picture = p && typeof p.data === "string" && TYPES.includes(p.media_type) && p.data.length < MAX_PICTURE ? p : undefined;
    if (p && !picture) return NextResponse.json({ error: "Файл не подходит: нужен снимок (JPG, PNG) или PDF до 4 МБ" }, { status: 400 });
    return NextResponse.json({ text: await askText(prompt, picture) });
  } catch (e) {
    return e instanceof AIError ? fail(e, e.status) : fail(e);
  }
}
