"use client";
import Link from "next/link";
import { useState } from "react";
import { FoodLog, useDay, useTraining, Water, Workout } from "@/components/health";
import { useApp } from "@/components/store";
import { TaskRow } from "@/components/TaskRow";
import { Empty } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { parseLine } from "@/lib/parseLines";

const WDS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export default function Evening() {
  const { tasks, thoughts, today, patchTask, addTasks, toast } = useApp();
  const { day, set } = useDay(today);
  const [title, setTitle] = useState("");
  const tomorrowISO = addDays(today, 1);
  const todays = tasks.filter((t) => (t.due < today && !t.done) || t.due === today);
  const open = todays.filter((t) => !t.done);
  const tomorrow = tasks.filter((t) => t.due === tomorrowISO);
  const tr = useTraining();
  const train = tr.on(today);

  async function moveOpen() {
    for (const t of open) await patchTask(t.id, { due: tomorrowISO });
    toast("Перенесено на завтра: " + open.length);
  }
  async function addTomorrow(e: React.FormEvent) {
    e.preventDefault();
    const t = parseLine(title, today, tomorrowISO);
    if (!t) return;
    if ((await addTasks([{ ...t, due: tomorrowISO }])).length) setTitle("");
  }

  const steps: { ok: boolean; title: string; body: React.ReactNode }[] = [
    {
      ok: open.length === 0 || day.ev_tasks, title: "Что из сегодняшнего сделано?",
      body: <>
        <div className="list">{todays.length ? todays.map((t) => <TaskRow key={t.id} t={t} />) : <Empty>На сегодня задач не было</Empty>}</div>
        {open.length > 0 && !day.ev_tasks && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={moveOpen}>Перенести невыполненные ({open.length}) на завтра</button>
          <button className="mini" onClick={() => set({ ev_tasks: true })}>оставить как есть</button>
        </div>}
      </>,
    },
    {
      ok: thoughts.length === 0, title: "Разобрать быстрые мысли" + (thoughts.length ? " · " + thoughts.length : ""),
      body: thoughts.length ? <div><Link className="btn pri" href="/thoughts">Открыть быстрые мысли →</Link></div> : <Empty>Всё разложено</Empty>,
    },
    {
      ok: !train || day.workout !== null, title: train ? "Была тренировка сегодня?" : "Сегодня день отдыха от тренировок",
      body: train ? <Workout date={today} /> : <Empty>Тренировки по графику: {tr.days.length ? tr.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WDS[d]).join(", ") : "не заданы"}, с {tr.start} до {tr.end}</Empty>,
    },
    { ok: day.water > 0, title: "Сколько воды выпил?", body: <Water date={today} /> },
    { ok: day.food_ok !== null, title: "Что ел и правильно ли питался?", body: <FoodLog date={today} /> },
    {
      ok: tomorrow.length > 0 || day.ev_tomorrow, title: "Что на завтра?",
      body: <>
        <div className="list">{tomorrow.map((t) => <TaskRow key={t.id} t={t} />)}</div>
        <form className="addbar" style={{ margin: 0 }} onSubmit={addTomorrow}>
          <input className="input" placeholder="Новое дело на завтра, можно с временем: «10:00 созвон #Клиенты»" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn">Добавить</button>
        </form>
        {!tomorrow.length && !day.ev_tomorrow && <div><button className="mini" onClick={() => set({ ev_tomorrow: true })}>завтра ничего нового</button></div>}
      </>,
    },
  ];
  const done = steps.filter((s) => s.ok).length;

  return (
    <>
      <div className="head">
        <div><h1>Вечерний разбор</h1><div className="sub">{steps.length} шагов, около 3 минут. Каждый вечер в 21:00</div></div>
        <span className={"pill " + (done === steps.length ? "p-ok" : "p-acc")} style={{ fontSize: 13, padding: "4px 12px" }}>{done} из {steps.length}</span>
      </div>
      <div className="progress" style={{ marginBottom: 16 }}><i style={{ width: (done / steps.length) * 100 + "%" }} /></div>
      <section className="panel">
        {steps.map((s, i) => (
          <div key={i} className={"step" + (s.ok ? " ok" : "")}>
            <span className="num">{s.ok ? "✓" : i + 1}</span>
            <div className="body"><h3>{s.title}</h3>{s.body}</div>
          </div>
        ))}
      </section>
      {done === steps.length && (
        <section className="panel" style={{ marginTop: 16, borderColor: "var(--ok)" }}>
          <b style={{ color: "var(--ok)" }}>День закрыт.</b> <span className="sub">Завтра утром на главной будет план дня</span>
        </section>
      )}
    </>
  );
}
