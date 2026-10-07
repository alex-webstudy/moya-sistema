import { NextResponse, type NextRequest } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { setupBot, tgEnabled, TgError } from "@/lib/telegram";

// «Подключить бота» in Settings: points the bot at this app and returns the one-time link.
export async function POST(req: NextRequest) {
  const deny = await unauthorized();
  if (deny) return deny;
  if (!tgEnabled()) return NextResponse.json({ error: "Сначала добавь TELEGRAM_BOT_TOKEN в Vercel" }, { status: 400 });
  try {
    return NextResponse.json(await setupBot(req.nextUrl.origin));
  } catch (e) {
    return e instanceof TgError ? NextResponse.json({ error: "Telegram: " + e.message }, { status: 502 }) : fail(e);
  }
}

export async function GET() {
  const deny = await unauthorized();
  if (deny) return deny;
  return NextResponse.json({ enabled: tgEnabled() });
}
