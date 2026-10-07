"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { PlaceSelect, TaskRow } from "@/components/TaskRow";
import { fromPlace, placeLabel, subtree } from "@/lib/folders";
import { diffDays, fd } from "@/lib/dates";
import { CLAUDE_PROMPT, parseLines } from "@/lib/parseLines";
import { openInClaude } from "@/lib/openInClaude";
import { prepareFiles } from "@/lib/files";
import type { NewTask, Task } from "@/lib/types";

type Filter = "today" | "week" | "all" | "done";

export default function Tasks() {
  const { tasks, rec, today, ai, addTasks, dictate, toast } = useApp();
  const [filter, setFilter] = useState<Filter>("today");
  // "" every project, "p:<section>" or "f:<folder id>" (with its subfolders).
  const [place, setPlace] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<NewTask[] | null>(null);
  const [busy, setBusy] = useState(false);

  const F: Record<Filter, [string, (t: Task) => boolean]> = {
    today: ["Сегодня", (t) => !t.done && diffDays(t.due, today) <= 0],
    week: ["Неделя", (t) => !t.done && diffDays(t.due, today) <= 7],
    all: ["Все открытые", (t) => !t.done],
    done: ["Выполнено", (t) => t.done],
  };
  const tree = place.startsWith("f:") ? subtree(rec.folders, place.slice(2)) : null;
  const inPlace = (t: Task) => !place || (tree ? !!t.folder_id && tree.has(t.folder_id) : t.project === place.slice(2));
  const mine = tasks.filter(inPlace);
  const list = mine.filter(F[filter][1]).sort((a, b) => a.due.localeCompare(b.due) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  const done = mine.filter((t) => t.done).length;

  async function add() {
    const t = text.trim();
    if (!ai) {
      // Without the API key: parse a ready-made list (e.g. written by Claude in the chat app) locally.
      if (files.length) return toast("Скриншоты разбирает Claude: пока вставь готовый список текстом");
      if (!t) return toast("Напиши задачу или вставь готовый список");
      const items = parseLines(t, today);
      if (!items.length) return toast("Задач не нашёл");
      setPreview(items);
      return;
    }
    if (!t && !files.length) return toast("Надиктуй задачи или прикрепи скриншот");
    setBusy(true);
    const prepared = await prepareFiles(files);
    if (prepared.skipped.length) toast("Пропущены: " + prepared.skipped.join(", "));
    const out = await dictate({ text: t, uploads: prepared.uploads, docs: prepared.docs });
    setBusy(false);
    if (!out) return;
    if (!out.length) return toast("Задач не нашёл");
    setPreview(out);
  }

  function askClaude() {
    openInClaude(CLAUDE_PROMPT);
    toast("Добавь в Claude расшифровку, а его ответ вставь сюда");
  }

  async function confirm() {
    if (!preview) return;
    // With a project folder picked below, new tasks go into it.
    const items = place.startsWith("f:") ? preview.map((t) => ({ ...t, ...fromPlace(rec.folders, place, t.project) })) : preview;
    if ((await addTasks(items)).length) {
      toast("Добавлено задач: " + preview.length);
      setPreview(null); setText(""); setFiles([]);
    }
  }

  return (
    <>
      <div className="head"><div><h1>Задачи</h1><div className="sub">Выполнено {done} из {mine.length}</div></div></div>
      <section className="capture" style={{ marginBottom: 16 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Новая задача или сразу несколько. Можно надиктовать: «завтра в 10 созвон с Ириной, в пятницу отправить счёт Северу». Или прикрепи скриншот переписки, файл с правками" />
        {files.length > 0 && (
          <div className="chips">
            {files.map((f, i) => (
              <button type="button" key={i} title="Убрать" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                {f.type.startsWith("image/") ? "🖼" : "📄"} {f.name} ✕
              </button>
            ))}
          </div>
        )}
        <div className="acts">
          <label className="btn" style={{ cursor: "pointer" }} title="Скриншот или файл">
            📎<input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json" hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5)); e.target.value = ""; }} />
          </label>
          <span className="sub" style={{ fontSize: 12, flex: 1 }}>{ai ? "Claude сам проставит проект, дату и время" : "Одна задача на строку: «завтра 15:00 #Клиенты Отправить договор». Без даты задача ставится на завтра"}</span>
          {!ai && <button className="btn" type="button" title="Откроет Claude с готовым запросом: останется добавить расшифровку" onClick={askClaude}>Открыть в Claude ↗</button>}
          <button className="btn pri" type="button" disabled={busy} onClick={add}>{busy ? "Разбираю…" : "Добавить"}</button>
        </div>
        {preview && (
          <>
            <div className="list" style={{ marginTop: 4 }}>
              {preview.map((t, i) => (
                <div className="row" key={i}>
                  <div className="t"><b>{t.title}</b><span>{place.startsWith("f:") ? placeLabel(rec.folders, fromPlace(rec.folders, place, t.project)) : t.project} · {fd(t.due, today)}{t.time ? " · " + t.time : ""}</span></div>
                  <button className="mini" onClick={() => setPreview(preview.filter((_, j) => j !== i))}>убрать</button>
                </div>
              ))}
            </div>
            <div className="acts">
              <button className="btn pri" type="button" disabled={!preview.length} onClick={confirm}>Добавить {preview.length} в задачи</button>
              <button className="btn" type="button" onClick={() => setPreview(null)}>Отмена</button>
            </div>
          </>
        )}
      </section>
      <div className="tabs" style={{ alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(F) as Filter[]).map((k) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{F[k][0]} · {mine.filter(F[k][1]).length}</button>
        ))}
        <span style={{ marginLeft: "auto", minWidth: 180 }}><PlaceSelect value={place} onChange={setPlace} all="Все проекты" label="Показать задачи проекта" /></span>
      </div>
      <section className="panel">
        <div className="list">{list.length ? list.map((t) => <TaskRow key={t.id} t={t} actions />) : <div className="sub" style={{ padding: "10px 0" }}>Здесь пусто</div>}</div>
      </section>
    </>
  );
}
