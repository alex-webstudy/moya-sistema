"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icons } from "./icons";
import { useApp } from "./store";

const NAV: { href: string; name: string; ico: React.ReactNode; count?: "thoughts" | "tasks"; soon?: boolean }[] = [
  { href: "/", name: "Сегодня", ico: Icons.today },
  { href: "/thoughts", name: "Быстрая мысль", ico: Icons.plus, count: "thoughts" },
  { href: "/calendar", name: "Календарь", ico: Icons.cal },
  { href: "/meetings", name: "Встречи", ico: Icons.meet },
  { href: "/goals", name: "Цели", ico: Icons.goal, soon: true },
  { href: "/projects", name: "Проекты", ico: Icons.proj },
  { href: "/tasks", name: "Задачи", ico: Icons.tasks, count: "tasks" },
  { href: "/content", name: "Контент", ico: Icons.content, soon: true },
  { href: "/clients", name: "Клиенты", ico: Icons.clients },
  { href: "/finance", name: "Финансы", ico: Icons.fin },
  { href: "/health", name: "Здоровье", ico: Icons.health },
  { href: "/lists", name: "Списки", ico: Icons.list },
  { href: "/week", name: "Итоги недели", ico: Icons.week, soon: true },
  { href: "/evening", name: "Вечер", ico: Icons.evening },
  { href: "/vault", name: "Пароли", ico: Icons.vault, soon: true },
  { href: "/settings", name: "Настройки", ico: Icons.gear },
];

/** Theme from Settings; auto is light from 7:00 to 19:00 and dark in the evening. */
function useTheme(theme: "auto" | "light" | "dark") {
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      document.body.classList.toggle("light", theme === "light" || (theme === "auto" && h >= 7 && h < 19));
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, [theme]);
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
  useTheme(app.settings.theme);
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
            <Link key={n.href} href={n.href} className={"ni" + (path === n.href ? " on" : "") + (n.soon ? " later" : "")}>
              {n.ico}
              <span>{n.name}</span>
              {n.count && counts[n.count] > 0 && <span className="count">{counts[n.count]}</span>}
              {n.soon && <span className="tag">скоро</span>}
            </Link>
          ))}
        </nav>
        <div className="rail-foot">{app.demo ? "Демо-режим: данные в памяти" : ""}</div>
      </aside>
      <main>
        {app.demo && <div className="banner">Демо-режим: база не подключена, данные сбросятся после перезапуска</div>}
        {app.migrate && <div className="banner" style={{ borderColor: "var(--warn)" }}>Новые разделы ещё не подключены к базе: выполни SQL из сообщения Claude в Supabase (SQL Editor → Run), потом обнови страницу</div>}
        {app.error && <div className="banner" style={{ borderColor: "var(--bad)" }}>{app.error}</div>}
        {app.loaded ? children : <div className="sub">Загружаю…</div>}
      </main>
      <button className="fab" aria-label="Быстрая мысль" onClick={() => setSheet(true)}>+</button>
      {sheet && <QuickThought onClose={() => setSheet(false)} />}
      <div className={"toast" + (app.toastMsg ? " on" : "")} role="status">{app.toastMsg}</div>
    </div>
  );
}
