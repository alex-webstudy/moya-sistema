// Turns a ready-made list (e.g. what Claude wrote in the chat app) into tasks without calling the API.
// One task per line: «завтра 15:00 #Клиенты Отправить договор». Date, time and project are optional.
import { addDays, isISODate, weekday } from "./dates";
import { PROJECTS, type NewTask } from "./types";

const REL: Record<string, number> = { "сегодня": 0, "завтра": 1, "послезавтра": 2 };
// Index = JS weekday (0 = Sunday).
const WEEKDAYS = [
  ["вс", "воскресенье"], ["пн", "понедельник"], ["вт", "вторник"], ["ср", "среда", "среду"],
  ["чт", "четверг"], ["пт", "пятница", "пятницу"], ["сб", "суббота", "субботу"],
];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Nearest date on or after `today` that matches day/month; rolls into next year if already past. */
function dayMonth(d: number, m: number, today: string, year?: number): string | null {
  let y = year ?? Number(today.slice(0, 4));
  let s = `${y}-${pad(m)}-${pad(d)}`;
  if (!isISODate(s) || Number(s.slice(8)) !== d) return null;
  if (!year && s < today) { y += 1; s = `${y}-${pad(m)}-${pad(d)}`; }
  return isISODate(s) ? s : null;
}

function readDate(line: string, today: string): [string | null, string] {
  const l = line.toLowerCase();
  const rel = l.match(/^(сегодня|завтра|послезавтра)(?=[\s,:]|$)[,:]?\s*/u);
  if (rel) return [addDays(today, REL[rel[1]]), line.slice(rel[0].length)];

  const iso = line.match(/^(\d{4}-\d{2}-\d{2})\b[,:]?\s*/);
  if (iso && isISODate(iso[1])) return [iso[1], line.slice(iso[0].length)];

  const num = line.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?!\d)[,:]?\s*/);
  if (num) {
    const y = num[3] ? Number(num[3].length === 2 ? "20" + num[3] : num[3]) : undefined;
    const d = dayMonth(Number(num[1]), Number(num[2]), today, y);
    if (d) return [d, line.slice(num[0].length)];
  }

  const word = l.match(/^(\d{1,2})\s+([а-яё]+)(?=[\s,:]|$)[,:]?\s*/u);
  if (word) {
    const m = MONTHS.findIndex((p) => word[2].startsWith(p));
    const d = m >= 0 ? dayMonth(Number(word[1]), m + 1, today) : null;
    if (d) return [d, line.slice(word[0].length)];
  }

  const wd = l.match(/^(?:во?\s+)?([а-яё]+)(?=[\s,:]|$)[,:]?\s*/u);
  if (wd) {
    const i = WEEKDAYS.findIndex((names) => names.includes(wd[1]));
    if (i >= 0) return [addDays(today, (i - weekday(today) + 7) % 7), line.slice(wd[0].length)];
  }
  return [null, line];
}

function readTime(line: string): [string | null, string] {
  const m = line.match(/^(?:в\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)[,:]?\s*/u);
  return m ? [`${pad(Number(m[1]))}:${m[2]}`, line.slice(m[0].length)] : [null, line];
}

function readProject(line: string): [string | null, string] {
  const tag = line.match(/(^|\s)#([^\s#]+)/u) ?? line.match(/(^|\s)\[([^\]]+)\]/u);
  if (!tag) return [null, line];
  const name = PROJECTS.find((p) => p.toLowerCase() === tag[2].trim().toLowerCase());
  return name ? [name, (line.slice(0, tag.index) + " " + line.slice(tag.index! + tag[0].length)).trim()] : [null, line];
}

/** Parse one line; returns null for empty lines and headings like «Задачи:». */
export function parseLine(raw: string, today: string, fallbackDue: string): NewTask | null {
  let line = raw.trim().replace(/^(?:[-•*–—]|\d+[.)](?=\s)|\[\s?[xх ]?\])\s*/iu, "").trim();
  if (!line || /:$/.test(line)) return null;

  // «завтра | 15:00 | Клиенты | Отправить договор» — the format the copied prompt asks for.
  if (line.includes("|")) {
    line = line.split("|").map((p) => p.trim()).filter(Boolean).map((p) =>
      PROJECTS.some((x) => x.toLowerCase() === p.toLowerCase()) ? "#" + p : p).join(" ");
  }

  let due: string | null = null, time: string | null = null, project: string | null = null;
  [project, line] = readProject(line);
  [due, line] = readDate(line, today);
  [time, line] = readTime(line);
  if (!due) [due, line] = readDate(line, today); // «15:00 завтра …»
  line = line.replace(/^[-–—:,.]\s*/, "").trim();
  if (!line) return null;
  return { title: line.slice(0, 500), project: project ?? "Личное", due: due ?? fallbackDue, time };
}

export function parseLines(text: string, today: string): NewTask[] {
  const fallback = addDays(today, 1);
  return text.split("\n").map((l) => parseLine(l, today, fallback)).filter((t): t is NewTask => t !== null);
}

/** Prompt the owner pastes into the Claude app together with a transcript or thoughts. */
export const CLAUDE_PROMPT = `Разбери текст ниже на задачи. Выведи только список, одна задача на строку, без пояснений, в формате:
дата | время | проект | задача

- дата: сегодня, завтра, день недели (пн, вт, ср, чт, пт, сб, вс) или ДД.ММ
- время: ЧЧ:ММ или пусто, если не названо
- проект: один из ${PROJECTS.join(", ")}
- задача: коротко, начиная с глагола

Пример:
завтра | 15:00 | Клиенты | Отправить договор «Студии Форма»
пт |  | Instagram | Смонтировать рилс про возражения

Текст:
`;
