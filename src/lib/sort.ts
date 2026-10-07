import "server-only";
import { sortThoughts } from "./ai";
import { addDays, fdue, todayISO } from "./dates";
import type { Store } from "./store/types";
import { PLATFORMS, type Platform, type Thought } from "./types";
import { normProject, toNewTask } from "./validate";

const PLAT_NAME: Record<Platform, string> = { tg: "Telegram", ig: "Instagram", yt: "YouTube" };

/** Claude sorts thoughts into tasks, project notes and content ideas; sorted ones leave the inbox. */
export async function sortInto(store: Store, thoughts: Thought[]): Promise<string[]> {
  if (!thoughts.length) return [];
  const today = todayISO();
  const result = await sortThoughts(thoughts.map((t) => ({ id: t.id, text: t.text })));
  const done: string[] = [];
  const handled: string[] = [];
  for (const x of result) {
    const th = thoughts.find((t) => t.id === x.id);
    if (!th || handled.includes(th.id)) continue;
    if (x.kind === "task") {
      const t = toNewTask({ ...x, title: x.title || th.text }, addDays(today, 1));
      if (!t) continue;
      await store.addTasks([t]);
      done.push(`Задача: ${t.title} · ${t.project}, ${fdue(t.due, today)}${t.time ? " " + t.time : ""}`);
    } else if (x.kind === "idea") {
      const formats: readonly string[] = PLATFORMS[x.platform];
      const format = formats.includes(x.format) ? x.format : formats[0];
      await store.addIdea(x.title || th.text, x.platform, format);
      done.push(`Идея: ${x.title || th.text} · ${PLAT_NAME[x.platform]}`);
    } else {
      const project = normProject(x.project);
      await store.addNote(project, th.text);
      done.push(`Заметка в «${project}»: ${th.text}`);
    }
    handled.push(th.id);
  }
  await store.deleteThoughts(handled);
  return done;
}
