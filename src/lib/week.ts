// Week review: Monday–Sunday range, what to hand Claude, and reading its answer back.
import { addDays, weekday } from "./dates";

export const monday = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

export type Review = { summary: string; wins: string[]; misses: string[]; focus: string[] };

/** Claude answers in four blocks: ИТОГ, ПОЛУЧИЛОСЬ, ПРОВИСЛО, ФОКУС; list items start with «-» or «•». */
export function parseReview(text: string): Review {
  const r: Review = { summary: "", wins: [], misses: [], focus: [] };
  let sec: keyof Review = "summary";
  for (const raw of text.split("\n")) {
    const l = raw.replace(/\*\*/g, "").trim();
    if (!l) continue;
    const h = l.match(/^(итог\w*|получилось|провисло|фокус[^:]*)\s*:?\s*(.*)$/i);
    if (h) {
      const w = h[1].toLowerCase();
      sec = w.startsWith("итог") ? "summary" : w === "получилось" ? "wins" : w === "провисло" ? "misses" : "focus";
      if (h[2]) add(r, sec, h[2]);
      continue;
    }
    add(r, sec, l);
  }
  r.focus = r.focus.slice(0, 10);
  return r;
}
function add(r: Review, sec: keyof Review, l: string) {
  const t = l.replace(/^(?:[-•*]|\d+[.)])\s*/, "").trim().slice(0, 300);
  if (!t) return;
  if (sec === "summary") r.summary = (r.summary ? r.summary + " " : "") + t;
  else r[sec].push(t);
}

export const WEEK_PROMPT = `Подведи итоги моей недели (я предприниматель: дизайн, контент, клиенты, курс; тренировки ведёт тренер, их план не предлагай). Пиши по-русски, коротко, по-дружески и честно. Опирайся только на данные ниже.
Ответь строго в таком виде, без markdown:
ИТОГ: 2–3 предложения
ПОЛУЧИЛОСЬ:
- ...
ПРОВИСЛО:
- ...
ФОКУС НА СЛЕДУЮЩУЮ НЕДЕЛЮ:
- 3–5 ключевых пунктов

Данные:
`;
