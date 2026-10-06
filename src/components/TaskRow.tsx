"use client";
import { addDays, diffDays, fd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useApp } from "./store";

export function TaskRow({ t, actions = false }: { t: Task; actions?: boolean }) {
  const { today, patchTask, deleteTask } = useApp();
  const d = diffDays(t.due, today);
  const late = !t.done && d < 0;
  return (
    <div className={"row" + (t.done ? " done" : "")}>
      <button className={"chk" + (t.done ? " on" : "")} aria-label={t.done ? "Вернуть в работу" : "Отметить выполненной"} onClick={() => patchTask(t.id, { done: !t.done })} />
      <div className="t"><b>{t.title}</b><span>{t.project}</span></div>
      <span className={"pill " + (late ? "p-bad" : d === 0 ? "p-acc" : "p-mute")}>
        {late ? "просрочено · " : ""}{fd(t.due, today)}{t.time ? " · " + t.time : ""}
      </span>
      {actions && !t.done && <button className="mini" onClick={() => patchTask(t.id, { due: addDays(today, 1) })}>на завтра</button>}
      {actions && <button className="mini" aria-label="Удалить" onClick={() => deleteTask(t.id)}>✕</button>}
    </div>
  );
}
