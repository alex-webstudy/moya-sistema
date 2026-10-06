// Meetings without the API key: Claude (in the chat app) answers in a fixed plain-text shape, the app parses it.
import { addDays } from "./dates";
import { parseLine } from "./parseLines";
import { PROJECTS, type NewTask } from "./types";

export interface ParsedMeeting { summary: string; points: string[]; questions: string[]; tasks: NewTask[] }

const HEAD = /^[#*\s]*(суть|важно|вопросы|задачи)[*\s]*:?[*\s]*(.*)$/i;
const KEY = { суть: "summary", важно: "points", вопросы: "questions", задачи: "tasks" } as const;
const bullet = (s: string) => s.replace(/^\s*(?:[-•*–—]|\d+[.)](?=\s))\s*/, "").trim();

export function parseMeeting(text: string, today: string): ParsedMeeting {
  const out: ParsedMeeting = { summary: "", points: [], questions: [], tasks: [] };
  const fallback = addDays(today, 1);
  let sec: (typeof KEY)[keyof typeof KEY] | null = null;
  const summary: string[] = [];
  for (const raw of text.split("\n")) {
    const h = raw.match(HEAD);
    let line = raw;
    if (h) {
      sec = KEY[h[1].toLowerCase() as keyof typeof KEY];
      line = h[2];
    }
    if (!sec || !line.trim()) continue;
    if (sec === "summary") summary.push(line.trim());
    else if (sec === "tasks") {
      const t = parseLine(line, today, fallback);
      if (t) out.tasks.push(t);
    } else {
      const b = bullet(line);
      if (b && !/^(нет|—|-)$/i.test(b)) out[sec].push(b);
    }
  }
  out.summary = summary.join(" ");
  return out;
}

export const MEETING_PROMPT = (title: string) => `Это расшифровка моей рабочей встречи${title ? ` «${title}»` : ""}. Разбери её и ответь строго в таком виде, без вступления и пояснений:

СУТЬ:
суть встречи в 2–3 предложениях

ВАЖНО:
- важные моменты и договорённости, до 8 пунктов, коротко

ВОПРОСЫ:
- вопросы, которые остались открытыми

ЗАДАЧИ:
дата | время | проект | задача

Задачи только мои, каждая с глагола. Дата: сегодня, завтра, день недели (пн…вс) или ДД.ММ; если срок не назван, ставь «завтра». Время ЧЧ:ММ или пусто. Проект: один из ${PROJECTS.join(", ")}.

Расшифровка:
`;
