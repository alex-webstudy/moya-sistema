"use client";
import Link from "next/link";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { useApp } from "@/components/store";
import { TaskRow } from "@/components/TaskRow";
import { Empty } from "@/components/ui";
import { fd } from "@/lib/dates";
import { folderPath, folderProject } from "@/lib/folders";
import { PROJECTS } from "@/lib/types";

export default function Projects() {
  const { rec, tasks, today, addRec, patchRec, removeRec, toast } = useApp();
  // Links from other sections open a folder with ?f=<id>. Pages render only on the client, after state loads.
  const [cur, setCur] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(location.search).get("f")));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [renaming, setRenaming] = useState(false);

  const folder = rec.folders.find((f) => f.id === cur) ?? null;
  const id = folder?.id ?? null;
  const path = folderPath(rec.folders, id);
  const kids = rec.folders.filter((f) => f.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const project = folderProject(rec.folders, id);
  const notes = folder ? rec.notes.filter((n) => n.folder_id === id || (!n.folder_id && folder.project && n.project === folder.project)) : [];
  const meetings = folder ? rec.meetings.filter((m) => m.folder_id === id) : [];
  const openTasks = project ? tasks.filter((t) => t.project === project && !t.done).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const count = (fid: string) => rec.folders.filter((f) => f.parent_id === fid).length + rec.notes.filter((n) => n.folder_id === fid).length + rec.meetings.filter((m) => m.folder_id === fid).length;

  function go(fid: string | null) {
    setCur(fid); setAdding(false); setRenaming(false);
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
            <h2>Задачи{project ? ` «${project}»` : ""} · {openTasks.length}
              <select className="input" style={{ marginLeft: "auto", fontSize: 12, padding: "3px 6px" }} aria-label="Чьи задачи показывать" value={folder.project ?? ""} onChange={(e) => patchRec("folders", folder.id, { project: e.target.value || null })}>
                <option value="">{project && !folder.project ? `как у папки выше (${project})` : "без задач"}</option>
                {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </h2>
            <div className="list">{openTasks.length ? openTasks.map((t) => <TaskRow key={t.id} t={t} />) : <Empty>{project ? "Открытых задач нет" : "Выбери проект, чьи задачи собирать в эту папку"}</Empty>}</div>
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
    </>
  );
}
