"use client";
import Link from "next/link";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { useApp } from "@/components/store";
import { TaskRow } from "@/components/TaskRow";
import { ClaudeBtn, Empty } from "@/components/ui";
import { addDays, fd } from "@/lib/dates";
import { folderPath, folderProject, subtree, taskReport } from "@/lib/folders";
import { PROJECTS } from "@/lib/types";

export default function Projects() {
  const { rec, tasks, today, addRec, patchRec, removeRec, addTasks, deleteTask, toast } = useApp();
  // Links from other sections open a folder with ?f=<id>. Pages render only on the client, after state loads.
  const [cur, setCur] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(location.search).get("f")));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [task, setTask] = useState({ title: "", due: "", time: "" });
  const [showDone, setShowDone] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const folder = rec.folders.find((f) => f.id === cur) ?? null;
  const id = folder?.id ?? null;
  const path = folderPath(rec.folders, id);
  const kids = rec.folders.filter((f) => f.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const project = folderProject(rec.folders, id);
  const notes = folder ? rec.notes.filter((n) => n.folder_id === id || (!n.folder_id && folder.project && n.project === folder.project)) : [];
  const meetings = folder ? rec.meetings.filter((m) => m.folder_id === id) : [];
  // Tasks put into this folder or its subfolders; a folder linked to a section also collects that section's tasks without a folder.
  const tree = id ? subtree(rec.folders, id) : new Set<string>();
  const mine = folder ? tasks.filter((t) => (t.folder_id ? tree.has(t.folder_id) : !!folder.project && t.project === folder.project)) : [];
  const openTasks = mine.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  const doneTasks = mine.filter((t) => t.done).sort((a, b) => (b.done_at ?? b.due).localeCompare(a.done_at ?? a.due));
  const count = (fid: string) => rec.folders.filter((f) => f.parent_id === fid).length + rec.notes.filter((n) => n.folder_id === fid).length + rec.meetings.filter((m) => m.folder_id === fid).length;

  function go(fid: string | null) {
    setCur(fid); setAdding(false); setRenaming(false); setShowDone(false); setReport(null);
    history.replaceState(null, "", fid ? `?f=${fid}` : location.pathname);
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if ((await addRec("folders", [{ name: name.trim(), parent_id: id }])).length) { setName(""); setAdding(false); }
  }
  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (folder && name.trim() && (await patchRec("folders", folder.id, { name: name.trim() }))) setRenaming(false);
  }
  async function drop() {
    if (!folder) return;
    if (!confirm(`Удалить «${folder.name}» со всеми подпапками и заметками? Встречи и задачи останутся`)) return;
    if (await removeRec("folders", folder.id)) { go(folder.parent_id); toast("Папка удалена"); }
  }
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!folder || !task.title.trim()) return;
    const due = task.due || addDays(today, 1);
    if ((await addTasks([{ title: task.title.trim(), due, time: task.time || null, project: project ?? "Личное", folder_id: folder.id }])).length) setTask({ title: "", due: "", time: "" });
  }
  async function finishReport() {
    if (!folder || report === null) return;
    if (!confirm(`Сохранить отчёт в заметки папки и убрать ${doneTasks.length} выполненных задач?`)) return;
    if (!(await addRec("notes", [{ text: report.trim().slice(0, 4000), folder_id: folder.id, project }])).length) return;
    for (const t of doneTasks) await deleteTask(t.id);
    setReport(null); setShowDone(false);
    toast("Отчёт сохранён в заметках");
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim() && (await addRec("notes", [{ text: note.trim(), folder_id: id, project }])).length) setNote("");
  }

  return (
    <>
      <div className="head">
        <div>
          {folder && (
            <div className="crumbs fpath">
              <button className="mini" onClick={() => go(null)}>Проекты</button>
              {path.slice(0, -1).map((f) => <span key={f.id}>› <button className="mini" onClick={() => go(f.id)}>{f.name}</button></span>)}
            </div>
          )}
          {renaming && folder ? (
            <form className="addbar" style={{ margin: 0 }} onSubmit={rename}>
              <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn pri">Сохранить</button>
              <button className="mini" type="button" onClick={() => setRenaming(false)}>отмена</button>
            </form>
          ) : <h1>{folder?.name ?? "Проекты"}</h1>}
          {!folder && <div className="sub">Папки и подпапки с заметками, задачами и встречами. Пароли лежат отдельно</div>}
        </div>
        {folder && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={() => go(folder.parent_id)}>← Назад</button>
            <button className="mini" onClick={() => { setName(folder.name); setRenaming(true); }}>переименовать</button>
            <button className="mini" onClick={drop}>удалить</button>
          </div>
        )}
      </div>

      <div className="fgrid" style={{ marginBottom: 16 }}>
        {kids.map((f) => (
          <button key={f.id} className="fcard" onClick={() => go(f.id)}>
            {Icons.proj}<b>{f.name}</b><span>{count(f.id) ? `внутри: ${count(f.id)}` : "пусто"}{f.project ? ` · задачи «${f.project}»` : ""}</span>
          </button>
        ))}
        {adding ? (
          <form className="fcard" onSubmit={addFolder}>
            <input className="input" autoFocus placeholder="Название папки" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            <div style={{ display: "flex", gap: 8 }}><button className="btn pri">Создать</button><button className="mini" type="button" onClick={() => setAdding(false)}>отмена</button></div>
          </form>
        ) : (
          <button className="fcard add" onClick={() => { setName(""); setAdding(true); }}>+ {folder ? "Подпапка" : "Папка"}</button>
        )}
      </div>

      {folder && (
        <div className="grid g2">
          <section className="panel">
            <h2>Заметки · {notes.length}</h2>
            <form className="addbar" onSubmit={addNote}>
              <input className="input" placeholder="Новая заметка" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn pri">Добавить</button>
            </form>
            <div className="list">
              {notes.length ? notes.map((n) => (
                <div className="row" key={n.id} style={{ alignItems: "flex-start" }}>
                  <div className="t"><b style={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>{n.text}</b><span>{fd(n.created_at.slice(0, 10), today)}</span></div>
                  <button className="mini" aria-label="Удалить заметку" onClick={() => removeRec("notes", n.id)}>✕</button>
                </div>
              )) : <Empty>Заметок пока нет</Empty>}
            </div>
          </section>
          <section className="panel">
            <h2>Задачи · {openTasks.length}
              <select className="input" style={{ marginLeft: "auto", fontSize: 12, padding: "3px 6px", maxWidth: 190 }} aria-label="Собирать ещё задачи раздела" title="Кроме задач этой папки, показывать задачи раздела, у которых папка не выбрана" value={folder.project ?? ""} onChange={(e) => patchRec("folders", folder.id, { project: e.target.value || null })}>
                <option value="">только задачи папки</option>
                {PROJECTS.map((p) => <option key={p} value={p}>+ задачи «{p}» без папки</option>)}
              </select>
            </h2>
            <form className="addbar" onSubmit={addTask}>
              <input className="input" style={{ flex: "1 1 200px" }} placeholder="Новая задача по проекту" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
              <input className="input" type="date" aria-label="Дата (без даты — завтра)" title="Без даты задача ставится на завтра" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} />
              <input className="input" type="time" aria-label="Время" value={task.time} onChange={(e) => setTask({ ...task, time: e.target.value })} />
              <button className="btn pri">Добавить</button>
            </form>
            <div className="list">{openTasks.length ? openTasks.map((t) => <TaskRow key={t.id} t={t} />) : <Empty>Открытых задач нет</Empty>}</div>
            {doneTasks.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="mini" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? "▾" : "▸"} Выполнено · {doneTasks.length}</button>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setReport(taskReport(folder.name, doneTasks, (d) => `${d.slice(8)}.${d.slice(5, 7)}`))}>Составить отчёт</button>
              </div>
            )}
            {showDone && <div className="list">{doneTasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>}
          </section>
          {meetings.length > 0 && (
            <section className="panel">
              <h2>Встречи · {meetings.length} <Link className="more" href="/meetings">Все встречи →</Link></h2>
              <div className="list">
                {meetings.map((m) => (
                  <div className="row" key={m.id} style={{ alignItems: "flex-start" }}>
                    <div className="t"><b>{m.title}</b><span className="ln">{fd(m.date, today)}{m.summary ? " · " + m.summary : ""}</span>
                      {m.questions.length > 0 && <span className="ln" style={{ color: "var(--warn)" }}>Открытые вопросы: {m.questions.join("; ")}</span>}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      {report !== null && folder && (
        <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && setReport(null)}>
          <div className="sheet">
            <b>Отчёт: {folder.name}</b>
            <span className="sub" style={{ fontSize: 12 }}>Все выполненные задачи с прошлого отчёта. Текст можно поправить перед сохранением</span>
            <textarea className="input" style={{ minHeight: 240, fontFamily: "inherit" }} value={report} onChange={(e) => setReport(e.target.value)} aria-label="Текст отчёта" />
            <div className="acts">
              <button className="btn" type="button" onClick={async () => { await navigator.clipboard.writeText(report).catch(() => {}); toast("Скопировано"); }}>Скопировать</button>
              <ClaudeBtn label="Оформить для клиента в Claude ↗" onAnswer={setReport} prompt={() => `Оформи отчёт о проделанной работе для клиента: коротко, по-деловому, на русском, сгруппируй похожие задачи по смыслу, без выдуманных фактов. Верни только текст отчёта.\n\n${report}`} />
              <span style={{ flex: 1 }} />
              <button className="btn" type="button" onClick={() => setReport(null)}>Отмена</button>
              <button className="btn pri" type="button" onClick={finishReport}>Сохранить и очистить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
