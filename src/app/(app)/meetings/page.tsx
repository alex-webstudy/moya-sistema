"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/store";
import { ClaudeBtn, Empty } from "@/components/ui";
import { addDays, fd } from "@/lib/dates";
import { folderOptions, folderProject } from "@/lib/folders";
import { MEETING_PROMPT, parseMeeting, type ParsedMeeting } from "@/lib/meeting";
import { prepPrompt } from "@/lib/prompts";
import type { Meeting } from "@/lib/records";

const MEETING_RE = /созвон|встреч|звонок|zoom|разбор|переговор/i;
const CST = ["договор не отправлен", "договор отправлен", "договор подписан"];

export default function Meetings() {
  const { rec, tasks, today, addRec, addTasks, removeRec, toast } = useApp();
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [parsed, setParsed] = useState<ParsedMeeting | null>(null);
  const [last, setLast] = useState<Meeting | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const opts = folderOptions(rec.folders);
  const label = (id: string | null) => opts.find((o) => o.id === id)?.label;

  const soon = tasks
    .filter((t) => !t.done && t.due >= today && t.due <= addDays(today, 3) && MEETING_RE.test(t.title))
    .sort((a, b) => a.due.localeCompare(b.due) || (a.time ?? "99").localeCompare(b.time ?? "99"));

  function aboutClient(text: string) {
    const low = text.toLowerCase();
    const c = rec.clients.find((x) => x.name.replace(/[«»"]/g, "").toLowerCase().split(/\s+/).some((w) => w.length > 2 && low.includes(w)));
    return c ? `Что известно о клиенте: ${c.name}${c.work ? ", работа: " + c.work : ""}${c.sum ? ", сумма " + c.sum.toLocaleString("ru-RU") + " сум" : ""}, ${CST[c.contract]}, ${c.paid ? "оплачено" : "не оплачено"}${c.waiting ? ", жду: " + c.waiting : ""}.` : "";
  }

  function read() {
    if (!answer.trim()) return toast("Вставь ответ Claude");
    const p = parseMeeting(answer, today);
    if (!p.summary && !p.points.length && !p.tasks.length) return toast("Не нашёл разделы СУТЬ, ВАЖНО, ВОПРОСЫ, ЗАДАЧИ");
    setParsed(p);
  }

  async function send() {
    if (!parsed) return;
    const project = folderProject(rec.folders, folder || null);
    const [m] = await addRec("meetings", [{
      title: title.trim() || "Встреча", date: today, folder_id: folder || null,
      summary: parsed.summary, points: parsed.points, questions: parsed.questions, tasks: parsed.tasks.map((t) => t.title),
    }]);
    if (!m) return;
    // Tasks Claude left in the default project go to the meeting's folder project.
    if (parsed.tasks.length) await addTasks(parsed.tasks.map((t) => (project && t.project === "Личное" ? { ...t, project } : t)));
    setLast(m); setParsed(null); setAnswer(""); setTranscript(""); setTitle("");
    toast("Встреча сохранена");
  }

  return (
    <>
      <div className="head"><div><h1>Встречи</h1><div className="sub">Перед встречей готовлю план, после разбираю расшифровку и отправляю в проект</div></div></div>

      {soon.length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <h2>Скоро созвоны · {soon.length}</h2>
          <div className="list">
            {soon.map((t) => (
              <div className="row" key={t.id} style={{ flexWrap: "wrap" }}>
                <span className="amt" style={{ width: 64, flex: "none", color: "var(--muted)", fontSize: 12, lineHeight: 1.4 }}>{fd(t.due, today)}{t.time && <><br />{t.time}</>}</span>
                <div className="t" style={{ flex: "1 1 200px" }}><b>{t.title}</b><span>{t.project}</span></div>
                <ClaudeBtn label="План в Claude ↗" prompt={() => prepPrompt(t.title, fd(t.due, today) + (t.time ? " " + t.time : ""), aboutClient(t.title))} hint="Claude распишет встречу по твоему скрипту из 12 шагов" />
              </div>
            ))}
          </div>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Берутся задачи на 3 дня вперёд со словами «созвон», «встреча», «звонок», «zoom»</div>
        </section>
      )}

      {last && (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--ok)" }}>
          <b style={{ color: "var(--ok)" }}>«{last.title}» сохранена{last.folder_id ? ` в ${label(last.folder_id)}` : ""}</b>
          <div className="sub" style={{ fontSize: 13 }}>Задач добавлено: {last.tasks.length}, открытых вопросов: {last.questions.length}.{last.folder_id && <> <Link className="mini" href={`/projects?f=${last.folder_id}`}>Открыть проект →</Link></>}</div>
        </section>
      )}

      <section className="capture">
        <b>Разобрать встречу</b>
        <div className="addbar" style={{ margin: 0 }}>
          <input className="input" placeholder="Название, например «Созвон с Ириной»" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input" style={{ flex: "0 1 260px" }} value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Папка проекта">
            <option value="">Без папки</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <textarea placeholder="1. Вставь расшифровку встречи (из Zoom, Google Meet, Telegram)" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        <div className="acts">
          <span className="sub" style={{ fontSize: 12, flex: 1 }}>2. Claude вытащит суть, договорённости, вопросы и задачи</span>
          <ClaudeBtn pri label="Разобрать в Claude ↗" prompt={() => MEETING_PROMPT(title.trim()) + transcript.trim()} hint={transcript.length > 5000 ? "Запрос скопирован: вставь его в Claude, а ответ сюда" : "Скопируй ответ Claude и вставь ниже"} onAnswer={(t) => { setAnswer(t); setParsed(null); }} />
        </div>
        <textarea placeholder="3. Вставь сюда ответ Claude" value={answer} onChange={(e) => { setAnswer(e.target.value); setParsed(null); }} />
        {!parsed && <div className="acts"><span style={{ flex: 1 }} /><button className="btn" type="button" onClick={read}>Показать итоги</button></div>}
        {parsed && (
          <>
            <MeetBody summary={parsed.summary} points={parsed.points} questions={parsed.questions} tasks={parsed.tasks.map((t) => `${t.title} · ${fd(t.due, today)}${t.time ? " " + t.time : ""}`)} />
            <div className="acts">
              <span className="sub" style={{ fontSize: 12, flex: 1 }}>{parsed.tasks.length ? `Задачи (${parsed.tasks.length}) попадут в «Задачи»` : "Задач нет"}</span>
              <button className="btn" type="button" onClick={() => setParsed(null)}>Отмена</button>
              <button className="btn pri" type="button" onClick={send}>{folder ? "Отправить в проект" : "Сохранить"}</button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Прошедшие встречи · {rec.meetings.length}</h2>
        <div className="list">
          {rec.meetings.length ? [...rec.meetings].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).map((m) => (
            <div key={m.id} style={{ borderTop: "1px solid var(--line)", padding: "4px 0" }}>
              <div className="row" style={{ borderTop: 0 }}>
                <button className="t" style={{ background: "none", border: 0, textAlign: "left", padding: 0, color: "inherit" }} aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                  <b>{m.title}</b><span>{fd(m.date, today)}{m.folder_id && label(m.folder_id) ? " · " + label(m.folder_id) : ""}</span>
                </button>
                <span className="cv sub" style={{ fontSize: 12 }}>{openId === m.id ? "▴" : "▾"}</span>
                <button className="mini" aria-label="Удалить встречу" onClick={() => confirm(`Удалить встречу «${m.title}»? Задачи останутся`) && removeRec("meetings", m.id)}>✕</button>
              </div>
              {openId === m.id && <MeetBody {...m} />}
            </div>
          )) : <Empty>Пока нет разобранных встреч</Empty>}
        </div>
      </section>
    </>
  );
}

function MeetBody({ summary, points, questions, tasks }: { summary: string; points: string[]; questions: string[]; tasks: string[] }) {
  const L = (h: string, a: string[]) => a.length > 0 && <><h3>{h}</h3><ul>{a.map((x, i) => <li key={i}>{x}</li>)}</ul></>;
  return (
    <div className="meet" style={{ paddingBottom: 8 }}>
      {summary && <><h3>Суть</h3><div>{summary}</div></>}
      {L("Важно", points)}
      {L("Открытые вопросы", questions)}
      {L("Задачи", tasks)}
    </div>
  );
}
