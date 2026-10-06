import { NextResponse } from "next/server";
import { AIError, sortThoughts } from "@/lib/ai";
import { addDays, fd, todayISO } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";
import { PLATFORMS, type Platform } from "@/lib/types";
import { normProject, toNewTask } from "@/lib/validate";

const PLAT_NAME: Record<Platform, string> = { tg: "Telegram", ig: "Instagram", yt: "YouTube" };

// Sorts every open thought into a task, a project note or a content idea, then removes it from the inbox.
export async function POST() {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const store = getStore();
    const thoughts = await store.listThoughts();
    if (!thoughts.length) return NextResponse.json({ done: [] });
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
        done.push(`Задача: ${t.title} · ${t.project}, ${fd(t.due, today)}${t.time ? " " + t.time : ""}`);
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
    return NextResponse.json({ done });
  } catch (e) {
    return e instanceof AIError ? fail(e, e.status) : fail(e);
  }
}
