import "server-only";
import { timingSafeEqual } from "node:crypto";
import { derive } from "./derive";

// Telegram bot: the token comes from @BotFather and lives only in Vercel (TELEGRAM_BOT_TOKEN).
const API = () => process.env.TELEGRAM_API ?? "https://api.telegram.org"; // overridable for tests
export const tgEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN;

export class TgError extends Error {}

export async function tg<T = unknown>(method: string, body: object): Promise<T> {
  const res = await fetch(`${API()}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!out.ok) throw new TgError(out.description ?? `Telegram ответил ${res.status}`);
  return out.result as T;
}

/** Telegram sends this header with every webhook call, so nobody else can post to the hook. */
export const hookSecret = () => derive("tg-hook-v1").toString("hex");
export function hookSecretOk(header: string | null): boolean {
  const got = Buffer.from(header ?? ""), want = Buffer.from(hookSecret());
  return got.length === want.length && timingSafeEqual(got, want);
}
/** One-time code in the «Подключить» link: whoever opens it first becomes the owner's chat. */
export const linkCode = () => derive("tg-link-v1").toString("hex").slice(0, 32);

export async function setupBot(origin: string): Promise<{ username: string; link: string }> {
  const me = await tg<{ username: string }>("getMe", {});
  await tg("setWebhook", { url: `${origin}/api/tg-hook`, secret_token: hookSecret(), allowed_updates: ["message"], drop_pending_updates: true });
  await tg("setMyCommands", { commands: [
    { command: "today", description: "План на сегодня" },
    { command: "help", description: "Что умеет бот" },
  ] });
  return { username: me.username, link: `https://t.me/${me.username}?start=${linkCode()}` };
}

export const send = (chat_id: number, text: string) => tg("sendMessage", { chat_id, text: text.slice(0, 4000), link_preview_options: { is_disabled: true } });

/** Downloads a photo or file the owner sent, as base64 for Claude. */
export async function download(file_id: string): Promise<string> {
  const f = await tg<{ file_path: string }>("getFile", { file_id });
  const res = await fetch(`${API()}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${f.file_path}`);
  if (!res.ok) throw new TgError("Не удалось скачать файл из Telegram");
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}
