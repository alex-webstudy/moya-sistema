"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { addDays } from "@/lib/dates";

export default function Thoughts() {
  const { thoughts, ai, today, addThought, deleteThought, sortThoughts, addTasks, toast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sorted, setSorted] = useState<string[] | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && (await addThought(text.trim()))) setText("");
  }
  async function sort() {
    setBusy(true);
    const done = await sortThoughts();
    setBusy(false);
    if (done) setSorted(done);
  }
  async function toTask(id: string, title: string) {
    if ((await addTasks([{ title, project: "Личное", due: addDays(today, 1), time: null }])).length) {
      await deleteThought(id);
      toast("Перенесено в задачи на завтра");
    }
  }

  return (
    <>
      <div className="head"><div><h1>Быстрая мысль</h1><div className="sub">Записываешь сюда всё, что пришло в голову за день. Вечером Claude раскладывает это по задачам, заметкам и идеям</div></div></div>
      <form className="capture" style={{ marginBottom: 16 }} onSubmit={save}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Что пришло в голову? Можно надиктовать с клавиатуры" />
        <div className="acts"><span className="sub" style={{ fontSize: 12, flex: 1 }}>Сохранится сразу, разберём вечером</span><button className="btn pri" type="submit">Сохранить</button></div>
      </form>
      {thoughts.length > 0 && (
        <section className="panel" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <b>Разложить всё автоматически</b>
            <div className="sub" style={{ fontSize: 12 }}>{ai ? "Claude решит, что задача, что заметка проекта, а что идея для контента" : "Нужен ключ ANTHROPIC_API_KEY, пока можно переносить вручную"}</div>
          </div>
          <button className="btn pri" disabled={!ai || busy} onClick={sort}>{busy ? "Раскладываю…" : "Разложить с Claude"}</button>
        </section>
      )}
      {sorted && sorted.length > 0 && (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--ok)" }}>
          <h2 style={{ color: "var(--ok)" }}>Claude разложил {sorted.length}<button className="more" onClick={() => setSorted(null)}>скрыть</button></h2>
          {sorted.map((x, i) => <div key={i} className="sub" style={{ fontSize: 13 }}>✓ {x}</div>)}
        </section>
      )}
      <section className="panel">
        {thoughts.length ? thoughts.map((n) => (
          <div className="inbox-item" key={n.id}>
            <div><b style={{ fontWeight: 600 }}>{n.text}</b> <span className="sub" style={{ fontSize: 12 }}>· {new Date(n.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="acts">
              <button className="btn" onClick={() => toTask(n.id, n.text)}>В задачи на завтра</button>
              <button className="mini" onClick={() => deleteThought(n.id)}>удалить</button>
            </div>
          </div>
        )) : <div className="sub">Всё разобрано</div>}
      </section>
    </>
  );
}
