import { after, NextResponse, type NextRequest } from "next/server";
import { AIError, aiEnabled, dictateToTasks, type Upload } from "@/lib/ai";
import { addDays, fd, todayISO } from "@/lib/dates";
import { briefLines } from "@/lib/reminders";
import { loadSnapshot } from "@/lib/snapshot";
import { sortInto } from "@/lib/sort";
import { getStore } from "@/lib/store";
import { download, hookSecretOk, linkCode, send, tgEnabled } from "@/lib/telegram";
import type { NewTask } from "@/lib/types";
import { toNewTask } from "@/lib/validate";

interface TgFile { file_id: string; file_size?: number; mime_type?: string; file_name?: string }
interface TgMessage {
  chat: { id: number; first_name?: string; username?: string };
  text?: string; caption?: string;
  photo?: TgFile[]; document?: TgFile; voice?: TgFile; audio?: TgFile; video_note?: TgFile;
}

const HELP = `Пиши сюда всё, что пришло в голову: дело, идею для контента, заметку. Claude сам разложит: задачи попадут в «Задачи», идеи в «Контент», заметки в проекты.
Скриншот или PDF (переписка, ТЗ, правки) — Claude вытащит из него задачи.
/today — план на сегодня.
Голосовые пока не понимаю: нажми 🎤 на клавиатуре и надиктуй текстом.`;
const MAX_FILE = 4_500_000;

// Telegram calls this for every message to the bot. We answer at once and do the work after,
// so a slow Claude reply never makes Telegram resend the message.
export async function POST(req: NextRequest) {
  if (!tgEnabled() || !hookSecretOk(req.headers.get("x-telegram-bot-api-secret-token"))) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await req.json().catch(() => ({}))) as { message?: TgMessage };
  const m = update.message;
  if (m) after(() => handle(m).catch((e) => { console.error("tg", e); return send(m.chat.id, e instanceof AIError ? e.message : "Что-то пошло не так, попробуй ещё раз").catch(() => {}); }));
  return NextResponse.json({ ok: true });
}

async function handle(m: TgMessage) {
  const store = getStore();
  const chat = m.chat.id;
  const text = (m.text ?? m.caption ?? "").trim();
  const settings = await store.getSettings();

  if (text.startsWith("/start")) {
    if (text.split(/\s+/)[1] !== linkCode()) return send(chat, "Это личный бот приложения «Моя система».");
    await store.setSetting("telegram", { chat_id: chat, name: m.chat.username ? "@" + m.chat.username : m.chat.first_name ?? "" });
    return send(chat, "Готово, бот подключён ✅\n\n" + HELP);
  }
  if (settings.telegram?.chat_id !== chat) return; // not the owner: stay silent

  if (text === "/help") return send(chat, HELP);
  if (text === "/today") {
    const lines = briefLines(await loadSnapshot(store), todayISO());
    return send(chat, lines.length ? "План на сегодня:\n• " + lines.join("\n• ") : "Сегодня срочного ничего");
  }
  if (m.voice || m.audio || m.video_note) return send(chat, "Голосовые пока не понимаю: нажми 🎤 на клавиатуре Telegram и надиктуй текстом — так я пойму.");

  const file = m.photo?.at(-1) ?? (m.document && /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(m.document.mime_type ?? "") ? m.document : undefined);
  if (m.document && !file) return send(chat, "Такой файл не прочитаю: пришли снимок экрана или PDF.");
  if (file) {
    if (!aiEnabled()) return send(chat, "Чтобы читать снимки, нужен Claude: добавь ключ в настройках приложения.");
    if ((file.file_size ?? 0) > MAX_FILE) return send(chat, "Файл больше 4 МБ: пришли снимок поменьше.");
    const pdf = file.mime_type === "application/pdf";
    const upload: Upload = { kind: pdf ? "pdf" : "image", media_type: pdf ? "application/pdf" : file.mime_type ?? "image/jpeg", data: await download(file.file_id), name: file.file_name ?? "снимок" };
    const today = todayISO();
    const tasks = (await dictateToTasks(text, [upload], [])).map((t) => toNewTask(t, addDays(today, 1))).filter((t): t is NewTask => !!t);
    if (!tasks.length) return send(chat, "Задач на снимке не нашёл.");
    await store.addTasks(tasks);
    return send(chat, `Добавил задачи (${tasks.length}):\n` + tasks.map((t) => `• ${t.title} · ${t.project}, ${fd(t.due, today)}${t.time ? " " + t.time : ""}`).join("\n"));
  }

  if (!text) return;
  const th = await store.addThought(text.slice(0, 2000));
  if (!aiEnabled()) return send(chat, "Записал в «Быструю мысль» 👌");
  const done = await sortInto(store, [th]);
  return send(chat, done.length ? done.join("\n") : "Записал в «Быструю мысль» 👌");
}
