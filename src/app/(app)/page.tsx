"use client";
import Link from "next/link";
import { useApp } from "@/components/store";
import { TaskRow } from "@/components/TaskRow";
import { addDays, fd, weekday } from "@/lib/dates";
import { eventsOn, todayTasks } from "@/lib/events";
import { TRAINING_DAYS } from "@/lib/types";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function Today() {
  const { tasks, thoughts, today } = useApp();
  const h = new Date().getHours();
  const greet = h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
  const dateStr = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const list = todayTasks(tasks, today);
  const open = list.filter((t) => !t.done).length;
  return (
    <>
      <div className="head">
        <div>
          <h1>{greet}, Алексей</h1>
          <div className="sub">{cap(dateStr)}{TRAINING_DAYS.includes(weekday(today)) ? " · сегодня тренировка" : ""}</div>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Задачи на сегодня</div><div className="v">{open}</div><div className="n">осталось сделать</div></div>
        <div className="kpi"><div className="l">Быстрые мысли</div><div className="v">{thoughts.length}</div><div className="n">разобрать вечером</div></div>
      </div>
      <div className="grid g2">
        <section className="panel">
          <h2>Дела на сегодня <Link className="more" href="/tasks">Все задачи →</Link></h2>
          <div className="list">{list.length ? list.map((t) => <TaskRow key={t.id} t={t} />) : <div className="sub">На сегодня всё сделано</div>}</div>
        </section>
        <section className="panel">
          <h2>Ближайшие дни <Link className="more" href="/calendar">Календарь →</Link></h2>
          <div className="list">
            {[1, 2, 3].map((n) => {
              const day = addDays(today, n);
              const ev = eventsOn(day, tasks);
              return (
                <div className="row" style={{ alignItems: "flex-start" }} key={day}>
                  <div style={{ width: 72, flex: "none", fontWeight: 600 }}>{cap(fd(day, today))}</div>
                  <div className="t">
                    {ev.length ? ev.slice(0, 4).map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
                        <span className="dot" style={{ background: e.color, flex: "none", transform: "translateY(-2px)" }} />
                        <span className="amt" style={{ color: "var(--muted)", width: 40, flex: "none" }}>{e.time}</span>
                        <span style={{ minWidth: 0 }}>{e.title}</span>
                      </div>
                    )) : <span>свободно</span>}
                    {ev.length > 4 && <span>ещё {ev.length - 4}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
