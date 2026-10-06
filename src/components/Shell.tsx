"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icons } from "./icons";
import { useApp } from "./store";

const NAV = [
  { href: "/", name: "Сегодня", ico: Icons.today },
  { href: "/thoughts", name: "Быстрая мысль", ico: Icons.plus, count: "thoughts" as const },
  { href: "/calendar", name: "Календарь", ico: Icons.cal },
  { href: "/tasks", name: "Задачи", ico: Icons.tasks, count: "tasks" as const },
];

/** Auto theme: light from 7:00 to 19:00, dark in the evening. */
function useAutoTheme() {
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      document.body.classList.toggle("light", h >= 7 && h < 19);
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, []);
}

export function QuickThought({ onClose }: { onClose: () => void }) {
  const { addThought } = useApp();
  const [text, setText] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && (await addThought(text.trim()))) onClose();
  }
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={save}>
        <b>Быстрая мысль</b>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Что пришло в голову? Можно надиктовать с клавиатуры" />
        <div className="acts">
          <span className="sub" style={{ fontSize: 12, flex: 1 }}>Вечером Claude разложит по задачам, заметкам и идеям</span>
          <button className="btn" type="button" onClick={onClose}>Отмена</button>
          <button className="btn pri" type="submit">Сохранить</button>
        </div>
      </form>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const path = usePathname();
  const [sheet, setSheet] = useState(false);
  useAutoTheme();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, []);
  const counts = {
    thoughts: app.thoughts.length,
    tasks: app.tasks.filter((t) => !t.done && app.today && t.due <= app.today).length,
  };
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">Моя система<small>Алексей Кутепов</small></div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={"ni" + (path === n.href ? " on" : "")}>
              {n.ico}
              <span>{n.name}</span>
              {n.count && counts[n.count] > 0 && <span className="count">{counts[n.count]}</span>}
            </Link>
          ))}
        </nav>
        <div className="rail-foot">{app.demo ? "Демо-режим: данные в памяти" : ""}</div>
      </aside>
      <main>
        {app.demo && <div className="banner">Демо-режим: база не подключена, данные сбросятся после перезапуска</div>}
        {app.error && <div className="banner" style={{ borderColor: "var(--bad)" }}>{app.error}</div>}
        {app.loaded ? children : <div className="sub">Загружаю…</div>}
      </main>
      <button className="fab" aria-label="Быстрая мысль" onClick={() => setSheet(true)}>+</button>
      {sheet && <QuickThought onClose={() => setSheet(false)} />}
      <div className={"toast" + (app.toastMsg ? " on" : "")} role="status">{app.toastMsg}</div>
    </div>
  );
}
