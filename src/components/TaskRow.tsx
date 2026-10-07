"use client";
import { useState } from "react";
import { addDays, diffDays, fd } from "@/lib/dates";
import { PROJECTS, type Task } from "@/lib/types";
import { useApp } from "./store";

/** Change a task's title, date, time or project. The calendar reads the same task, so both stay in sync. */
export function TaskEditor({ t, onClose }: { t: Task; onClose: () => void }) {
  const { patchTask, deleteTask, toast } = useApp();
  const [f, setF] = useState({ title: t.title, due: t.due, time: t.time ?? "", project: t.project });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.due) return toast("Нужны название и дата");
    await patchTask(t.id, { title: f.title.trim(), due: f.due, time: f.time || null, project: f.project });
    onClose();
  }
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={save}>
        <b>Изменить задачу</b>
        <input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Задача" />
        <div className="addbar" style={{ margin: 0 }}>
          <label className="lbl" style={{ flex: "1 1 150px" }}>Дата<input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} required /></label>
          <label className="lbl" style={{ flex: "1 1 110px" }}>Время<input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
          <label className="lbl" style={{ flex: "1 1 150px" }}>Проект
            <select className="input" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
              {[...new Set([...PROJECTS, t.project])].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="acts">
          <button className="mini" type="button" onClick={async () => { if (confirm("Удалить задачу?")) { await deleteTask(t.id); onClose(); } }}>удалить</button>
          {f.time && <button className="mini" type="button" onClick={() => setF({ ...f, time: "" })}>без времени</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={onClose}>Отмена</button>
          <button className="btn pri" type="submit">Сохранить</button>
        </div>
      </form>
    </div>
  );
}

export function TaskRow({ t, actions = false }: { t: Task; actions?: boolean }) {
  const { today, patchTask, deleteTask } = useApp();
  const [edit, setEdit] = useState(false);
  const d = diffDays(t.due, today);
  const late = !t.done && d < 0;
  return (
    <div className={"row" + (t.done ? " done" : "")}>
      <button className={"chk" + (t.done ? " on" : "")} aria-label={t.done ? "Вернуть в работу" : "Отметить выполненной"} onClick={() => patchTask(t.id, { done: !t.done })} />
      <button className="t" style={{ background: "none", border: 0, padding: 0, textAlign: "left", color: "inherit" }} title="Изменить дату, время или название" onClick={() => setEdit(true)}>
        <b>{t.title}</b><span>{t.project}</span>
      </button>
      <button className={"pill " + (late ? "p-bad" : d === 0 ? "p-acc" : "p-mute")} title="Изменить дату и время" onClick={() => setEdit(true)}>
        {late ? "просрочено · " : ""}{fd(t.due, today)}{t.time ? " · " + t.time : ""}
      </button>
      {actions && !t.done && <button className="mini" onClick={() => patchTask(t.id, { due: addDays(today, 1) })}>на завтра</button>}
      {actions && <button className="mini" aria-label="Удалить" onClick={() => deleteTask(t.id)}>✕</button>}
      {edit && <TaskEditor t={t} onClose={() => setEdit(false)} />}
    </div>
  );
}
