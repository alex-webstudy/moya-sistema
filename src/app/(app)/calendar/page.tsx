"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/store";
import { dayNum, fd, MON, MONN, monthGrid, monthOf, WD, weekDays, weekday } from "@/lib/dates";
import { TaskEditor } from "@/components/TaskRow";
import { eventsOn, LEGEND, type CalEvent } from "@/lib/events";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Task events open the task editor: changing the time here changes the task itself. Others open their section.
// Done, paid and past items stay in place, grey and struck through.
function Ev({ e, onEdit }: { e: CalEvent; onEdit: (id: string) => void }) {
  const style = { ["--c" as string]: e.color };
  const cls = "ev" + (e.done ? " off" : "");
  const body = <>{e.time && <span className="tm">{e.time}</span>}<span>{e.title}</span></>;
  if (e.taskId) return <button type="button" className={cls} style={{ ...style, textAlign: "left", border: 0, color: "inherit", cursor: "pointer" }} title="Изменить дату и время" onClick={(x) => { x.stopPropagation(); onEdit(e.taskId!); }}>{body}</button>;
  if (e.href) return <Link className={cls} style={{ ...style, color: "inherit", textDecoration: "none" }} href={e.href} onClick={(x) => x.stopPropagation()}>{body}</Link>;
  return <div className={cls} style={style}>{body}</div>;
}

export default function Calendar() {
  const app = useApp();
  const { tasks, today } = app;
  const [editId, setEditId] = useState<string | null>(null);
  const editing = tasks.find((t) => t.id === editId);
  const editor = editing && <TaskEditor t={editing} onClose={() => setEditId(null)} />;
  const [mode, setMode] = useState<"week" | "month">("week");
  const [off, setOff] = useState(0);
  const [sel, setSel] = useState<string | null>(null);

  const nav = (label: string) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="btn" aria-label="Назад" onClick={() => setOff(off - 1)}>←</button>
      <b style={{ minWidth: 150, textAlign: "center" }}>{label}</b>
      <button className="btn" aria-label="Вперёд" onClick={() => setOff(off + 1)}>→</button>
      {off !== 0 && <button className="mini" onClick={() => setOff(0)}>сегодня</button>}
    </div>
  );
  const head = (
    <div className="head">
      <div><h1>Календарь</h1><div className="sub">Всё, у чего есть дата: задачи, тренировки, списания, оплаты клиентов, публикации, встречи и поездки. Выполненное и оплаченное становится серым и зачёркнутым. Нажми на задачу, чтобы перенести её</div></div>
      <div className="tabs" style={{ margin: 0 }}>
        {(["week", "month"] as const).map((k) => (
          <button key={k} className={mode === k ? "on" : ""} onClick={() => { setMode(k); setOff(0); }}>{k === "week" ? "Неделя" : "Месяц"}</button>
        ))}
      </div>
    </div>
  );
  const legend = (
    <div className="legend" style={{ marginBottom: 14 }}>
      {LEGEND.map(([c, l]) => <span key={l}><i className="dot" style={{ background: c }} />{l}</span>)}
    </div>
  );

  if (mode === "week") {
    const days = weekDays(today, off);
    const label = `${dayNum(days[0])} ${MON[monthOf(days[0])]} — ${dayNum(days[6])} ${MON[monthOf(days[6])]}`;
    return (
      <>
        {head}
        <div style={{ marginBottom: 12 }}>{nav(label)}</div>
        {legend}
        <div className="week">
          {days.map((day) => {
            const ev = eventsOn(day, app);
            return (
              <div key={day} className={"wday" + (day === today ? " today" : "")}>
                <div className="dh"><span>{WD[weekday(day)]}{day === today ? " · сегодня" : ""}</span><b>{dayNum(day)}</b></div>
                {ev.length ? ev.map((e, i) => <Ev key={i} e={e} onEdit={setEditId} />) : <span className="sub" style={{ fontSize: 12 }}>свободно</span>}
              </div>
            );
          })}
        </div>
        {editor}
      </>
    );
  }

  const g = monthGrid(today, off);
  const selected = sel && g.days.includes(sel) ? sel : off === 0 ? today : g.days[0];
  const sev = eventsOn(selected, app);
  return (
    <>
      {head}
      <div style={{ marginBottom: 12 }}>{nav(`${MONN[g.month]} ${g.year}`)}</div>
      {legend}
      <div className="grid g2">
        <section className="panel">
          <div className="cal mcal">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((w) => <div className="wd" key={w}>{w}</div>)}
            {Array.from({ length: g.lead }, (_, i) => <div key={"b" + i} />)}
            {g.days.map((day) => {
              const ev = eventsOn(day, app);
              return (
                <div key={day} className={"day" + (day === today ? " today" : "") + (day === selected ? " sel" : "")} onClick={() => setSel(day)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(day)}>
                  <span className="n">{dayNum(day)}</span>
                  <div className="dots">{ev.slice(0, 6).map((e, i) => <i key={i} className="dot" style={{ width: 6, height: 6, background: e.color, opacity: e.done ? 0.35 : 1 }} />)}</div>
                  {ev[0] && <span className={"t1" + (ev.every((e) => e.done) ? " off" : "")}>{(ev.find((e) => !e.done) ?? ev[0]).title}</span>}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h2>{cap(fd(selected, today))}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{sev.length ? sev.map((e, i) => <Ev key={i} e={e} onEdit={setEditId} />) : <div className="sub">Ничего не запланировано</div>}</div>
        </section>
      </div>
      {editor}
    </>
  );
}
