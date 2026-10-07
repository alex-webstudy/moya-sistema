// Content plan: platforms, formats, and reading Claude's suggestions back from a pasted answer.
import { AUTHOR } from "./prompts";
import { PLATFORMS, type Platform } from "./types";

export const PLAT: Record<Platform, { n: string; c: string }> = {
  tg: { n: "Telegram", c: "var(--tg)" },
  ig: { n: "Instagram", c: "var(--ig)" },
  yt: { n: "YouTube", c: "var(--yt)" },
};
export const FMT_NAME: Record<string, string> = { post: "Пост", audio: "Аудио", video: "Видео", carousel: "Карусель", reels: "Reels", shorts: "Shorts", long: "Длинное видео" };
export const fmtName = (p: Platform | null, f: string) => (p && (PLATFORMS[p] as readonly string[]).includes(f) ? FMT_NAME[f] : "без формата");
export const STATUS = ["Идея", "В работе", "Смонтировано", "Выложено"];
export const PLATS = Object.keys(PLATFORMS) as Platform[];

const PLAT_WORDS: [RegExp, Platform][] = [[/^(tg|телеграм|telegram|тг)/i, "tg"], [/^(ig|инст|instagram|инста)/i, "ig"], [/^(yt|ютуб|youtube|ютьюб)/i, "yt"]];
const FMT_WORDS: [RegExp, string][] = [
  [/карусел|carousel/i, "carousel"], [/рилс|reels|рилз/i, "reels"], [/шортс|shorts/i, "shorts"], [/длинн|long/i, "long"],
  [/аудио|голосов|audio|подкаст/i, "audio"], [/видео|кружок|video/i, "video"], [/пост|post/i, "post"],
];

export function toPlatform(s: string): Platform | null {
  const t = s.trim();
  return PLAT_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
}
/** A format word for the given platform, or its first format when the word doesn't fit it. */
export function toFormat(p: Platform, s: string): string {
  const f = FMT_WORDS.find(([re]) => re.test(s))?.[1];
  const ok = PLATFORMS[p] as readonly string[];
  return f && ok.includes(f) ? f : ok[0];
}

export type IdeaDraft = { title: string; platform: Platform | null; format: string; why: string };

/** Lines «идея | площадка | формат | почему»; plain lines become ideas without a suggestion. */
export function parseIdeas(text: string): IdeaDraft[] {
  return text.split("\n").map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean).map((l) => {
    const [title, p = "", f = "", why = ""] = l.split("|").map((x) => x.trim());
    const platform = toPlatform(p);
    return { title: title.slice(0, 300), platform, format: platform ? toFormat(platform, f) : "", why: why.slice(0, 300) };
  }).filter((x) => x.title);
}

export const ideasPrompt = (ideas: string, liked: string[]) => `Автор: ${AUTHOR}.
Вот мои идеи для контента, каждая с новой строки:
${ideas}

Для каждой идеи выбери, где она сработает лучше: Telegram (пост, аудио, видео), Instagram (карусель, пост, Reels) или YouTube (Shorts, длинное видео).${liked.length ? ` Лучше всего у меня заходили: ${liked.join("; ")}.` : ""}
Ответь только строками без пояснений, по одной на идею:
идея | площадка | формат | почему коротко`;

export const scriptPrompt = (title: string, p: Platform | null, f: string) => `Автор: ${AUTHOR}.
Напиши сценарий: «${title}», ${p ? PLAT[p].n : ""} ${fmtName(p, f)}.
Сильный хук в первые 2 секунды или первую строку, структура по пунктам, текст на экране, призыв в конце (записаться на консультацию или подписаться). Пиши живо, моими словами, без воды.`;

export const repackPrompt = (title: string, p: Platform | null, f: string) => `Автор: ${AUTHOR}.
Публикация «${title}» (${p ? PLAT[p].n : ""}, ${fmtName(p, f)}). Как переупаковать её в другие форматы? Дай 3–5 вариантов.
Ответь только строками: идея | площадка | формат | почему коротко`;
