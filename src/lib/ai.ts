import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import * as z from "zod/v4";
import { addDays, todayISO, WD, weekday } from "./dates";
import { PROJECTS } from "./types";

export const MODEL = "claude-opus-5-5";
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export class AIError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

const ABOUT =
  "Алексей Кутепов — веб-дизайнер, «Дизайн + ИИ»: сайты на Figma/Tilda, AI-вёрстка, личный бренд, курс «Метод», консультации, услуги агентства. Живёт в Ташкенте.";

const dateLine = () => {
  const t = todayISO();
  const names = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  // Give the next 7 dates explicitly so «в пятницу» resolves without arithmetic mistakes.
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1)).map((d) => `${WD[weekday(d)]} ${d}`).join(", ");
  return `Сегодня ${t}, ${names[weekday(t)]}. Ближайшие дни: ${week}.`;
};

function apiError(e: unknown): never {
  if (e instanceof AIError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new AIError("Слишком много запросов к Claude, попробуй через минуту", 429);
  if (e instanceof Anthropic.AuthenticationError) throw new AIError("Ключ ANTHROPIC_API_KEY не подходит", 503);
  if (e instanceof Anthropic.APIError) throw new AIError("Claude сейчас недоступен (" + e.status + ")");
  throw e;
}

async function ask<T extends z.ZodType>(schema: T, content: BetaContentBlockParam[]): Promise<z.infer<T>> {
  if (!aiEnabled()) throw new AIError("Claude не подключён: добавь ANTHROPIC_API_KEY в настройки", 503);
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Simple extraction: low effort is enough and keeps the monthly bill small.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // If a safety classifier declines, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new AIError("Claude отказался обработать этот запрос");
    if (!res.parsed_output) throw new AIError("Claude ответил в неожиданном формате, попробуй ещё раз");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    apiError(e);
  }
}

export interface Picture { media_type: string; data: string }

/**
 * The same requests the «… в Claude ↗» buttons open in the Claude app, answered here instead:
 * the prompt already says what format to answer in, so the text goes straight into the app's own field.
 */
export async function askText(prompt: string, picture?: Picture): Promise<string> {
  if (!aiEnabled()) throw new AIError("Claude не подключён: добавь ANTHROPIC_API_KEY в настройки", 503);
  const content: BetaContentBlockParam[] = [];
  if (picture?.media_type === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: picture.data } });
  else if (picture) content.push({ type: "image", source: { type: "base64", media_type: picture.media_type as "image/jpeg", data: picture.data } });
  content.push({ type: "text", text: prompt });
  try {
    // Streamed so a long answer (a week review, a meeting) never hits the request timeout.
    const res = await anthropic().beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${ABOUT}\n${dateLine()}\nОтвечай по-русски, строго в том формате, который просят в запросе, без вступлений.`,
      messages: [{ role: "user", content }],
    }).finalMessage();
    if (res.stop_reason === "refusal") throw new AIError("Claude отказался обработать этот запрос");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new AIError("Claude ничего не ответил, попробуй ещё раз");
    return text;
  } catch (e) {
    apiError(e);
  }
}

const TaskOut = z.object({
  title: z.string(),
  project: z.enum(PROJECTS),
  due: z.string().describe("YYYY-MM-DD or empty when there is no deadline"),
  time: z.string().describe("HH:MM или пустая строка"),
});

export interface Upload { kind: "image" | "pdf"; media_type: string; data: string; name: string }

export async function dictateToTasks(text: string, uploads: Upload[], docs: { name: string; text: string }[]) {
  const content: BetaContentBlockParam[] = [];
  for (const u of uploads) {
    if (u.kind === "image") content.push({ type: "image", source: { type: "base64", media_type: u.media_type as "image/jpeg", data: u.data } });
    else content.push({ type: "document", title: u.name, source: { type: "base64", media_type: "application/pdf", data: u.data } });
  }
  const docText = docs.map((d) => `\n\nФайл «${d.name}»:\n${d.text}`).join("");
  content.push({
    type: "text",
    text: `${ABOUT}\n${dateLine()}\n\nРазбери на отдельные задачи всё, что Алексею нужно сделать, что он пообещал или что ему поручили: из текста ниже${uploads.length ? ", из приложенных скриншотов и документов" : ""}${docs.length ? ", из текстовых файлов (каждая правка — отдельная задача)" : ""}.
Название — коротко, с глагола. Проект — один из списка. Дата YYYY-MM-DD: относительные даты («завтра», «в пятницу») переведи по списку ближайших дней; если срока нет — пустая строка, не придумывай дату. Время HH:MM, если названо, иначе пустая строка. Ничего не выдумывай: если задач нет, верни пустой список.

Текст:
${text || "(только вложения)"}${docText}`,
  });
  const out = await ask(z.object({ tasks: z.array(TaskOut) }), content);
  return out.tasks;
}

const SortItem = z.object({
  id: z.string(),
  kind: z.enum(["task", "note", "idea"]),
  title: z.string(),
  project: z.enum(PROJECTS),
  due: z.string(),
  time: z.string(),
  platform: z.enum(["tg", "ig", "yt"]),
  format: z.enum(["post", "audio", "video", "carousel", "reels", "shorts", "long"]),
});

export async function sortThoughts(items: { id: string; text: string }[]) {
  const out = await ask(z.object({ items: z.array(SortItem) }), [
    {
      type: "text",
      text: `${ABOUT}\n${dateLine()}\n\nРазложи быстрые мысли. Для каждой реши kind:
- "task" — нужно что-то сделать: title с глагола, project, due YYYY-MM-DD или "", если срока нет, time HH:MM или "".
- "note" — информация, которую надо сохранить в проекте: title = текст заметки, project.
- "idea" — идея для контента: title, platform (tg, ig, yt) и format (tg: post|audio|video, ig: carousel|post|reels, yt: shorts|long).
Поля, которые к виду не относятся, заполни любым допустимым значением. id верни как есть.

Записи:
${items.map((n) => `${n.id}: ${n.text}`).join("\n")}`,
    },
  ]);
  return out.items;
}
