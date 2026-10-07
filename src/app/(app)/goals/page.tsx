"use client";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { useApp } from "@/components/store";
import { TaskRow } from "@/components/TaskRow";
import { ClaudeBtn, CurSelect, Empty, Fold } from "@/components/ui";
import { addDays, fd } from "@/lib/dates";
import { fmtGoal, GCOL, goalCur, goalPct, goalPlan, goalsPrompt, goalTarget, HORIZON, nextStepsPrompt, parseGoals, type GoalDraft } from "@/lib/goals";
import { chargeNext, monthKey, rub, toUZS, type Cur } from "@/lib/money";
import type { Goal } from "@/lib/records";

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
const ST = { ahead: ["опережаешь план", "p-ok"], behind: ["отстаёшь от плана", "p-bad"], ok: ["идёшь по плану", "p-acc"] } as const;
const hid = () => Math.random().toString(36).slice(2, 10);

/** Obligatory payments per month: active credits and subscriptions. */
function useMonthly() {
  const { rec, today } = useApp();
  return rec.charges.filter((c) => chargeNext(c, today)).reduce((s, c) => s + c.sum, 0);
}

export default function Goals() {
  const { rec } = useApp();
  // Opening a goal from elsewhere: /goals?g=<id>.
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get("g"));
  const g = rec.goals.find((x) => x.id === openId);
  return g ? <Detail g={g} onBack={() => setOpenId(null)} /> : <Overview onOpen={setOpenId} />;
}

function Overview({ onOpen }: { onOpen: (id: string) => void }) {
  const { rec, tasks, settings, today, addRec, addTasks, toast } = useApp();
  const monthly = useMonthly();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  function ctx() {
    const w = [...rec.measures].sort((a, b) => b.date.localeCompare(a.date)).find((m) => m.weight)?.weight;
    const last = (p: "ig" | "yt" | "tg") => settings.followers[p].at(-1)?.n;
    return {
      обязательные_платежи_в_месяц: monthly,
      пришло_в_этом_месяце: rec.income.filter((i) => i.date.startsWith(monthKey(today))).reduce((s, i) => s + i.sum, 0),
      подписчики: { Instagram: last("ig"), YouTube: last("yt"), Telegram: last("tg") },
      вес: w,
      уже_есть_цели: rec.goals.map((g) => g.title),
    };
  }
  async function create(list: GoalDraft[]) {
    let n = 0, steps = 0;
    for (const d of list.filter((x) => x.title)) {
      const [g] = await addRec("goals", [{
        title: d.title, horizon: d.horizon, start: today, deadline: d.deadline > today ? d.deadline : addDays(today, 180),
        start_val: d.start_val, target: d.target || 1, unit: d.unit, why: d.why, kind: d.kind,
        hist: [{ date: today, v: d.start_val }], habits: d.habits.map((h) => ({ id: hid(), text: h.text, freq: h.freq, log: [] })),
      }]);
      if (!g) continue;
      n++;
      if (d.steps.length) steps += (await addTasks(d.steps.map((s) => ({ title: s.title, project: s.project, due: s.due, time: null, goal_id: g.id })))).length;
    }
    return { n, steps };
  }
  async function readAnswer() {
    const list = parseGoals(answer, addDays(today, 7)).filter((g) => g.title);
    if (!list.length) return toast("Не нашёл строк «ЦЕЛЬ: …»");
    const { n, steps } = await create(list);
    if (n) { setAnswer(""); setText(""); toast(`Целей: ${n}, шагов в задачах и календаре: ${steps}`); }
  }

  const byH = (["year", "quarter", "month"] as const).map((h) => [h, rec.goals.filter((g) => g.horizon === h)] as const).filter(([, gs]) => gs.length);
  return (
    <>
      <div className="head"><div><h1>Цели</h1><div className="sub">Надиктуй, чего хочешь. Claude разобьёт каждую цель на небольшие шаги с датами и привычки, без перегруза</div></div></div>
      <section className="capture">
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: подушка на полгода к следующему лету, свозить семью на море, выйти на 70 млн сум в месяц, похудеть до 78 кг" />
        <div className="acts">
          <span className="sub" style={{ fontSize: 12, flex: 1 }}>Claude поставит цифру и дедлайн, распределит шаги по неделям, 1–2 в неделю</span>
          <ClaudeBtn pri label="Разложить на шаги в Claude ↗" prompt={() => goalsPrompt(text || "(цели напишу в чате)", today, ctx())} hint="Ответ Claude вставь в поле ниже" onAnswer={setAnswer} />
        </div>
        <div className="addbar" style={{ margin: 0 }}>
          <textarea className="input" style={{ minHeight: 44, flex: "1 1 260px" }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ Claude: строки ЦЕЛЬ / ШАГ / ПРИВЫЧКА" />
          <button className="btn" onClick={readAnswer} disabled={!answer.trim()}>Создать цели</button>
        </div>
      </section>

      {rec.goals.length > 0 && <Chart sel={sel} setSel={setSel} onOpen={onOpen} monthly={monthly} />}

      {byH.map(([h, gs]) => (
        <div key={h}>
          <div className="nav-label" style={{ padding: "12px 0 6px" }}>Цели на {HORIZON[h]}</div>
          <div className="fgrid" style={{ marginBottom: 12 }}>
            {gs.map((g) => {
              const t = goalTarget(g, monthly), pc = Math.round(goalPct(g, t, goalCur(g))), P = goalPlan(g, t, today);
              const steps = tasks.filter((x) => x.goal_id === g.id && !x.done).length;
              return (
                <button key={g.id} className="fcard" style={{ borderTop: `3px solid ${color(rec.goals, g)}` }} onClick={() => onOpen(g.id)}>
                  {Icons.proj}<b>{g.title}</b>
                  <div className="bar" style={{ margin: "2px 0", width: "100%" }}><i style={{ width: `${pc}%`, background: color(rec.goals, g) }} /></div>
                  <span>{pc}% · {ST[P.st][0]} · шагов {steps} · до {fd(g.deadline, today)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!rec.goals.length && <section className="panel"><Empty>Целей пока нет. Напиши их сверху или добавь вручную</Empty></section>}
      <div style={{ marginTop: 16 }}><Fold title="Добавить цель вручную"><ManualGoal onCreate={create} /></Fold></div>
    </>
  );
}

const color = (all: Goal[], g: Goal) => GCOL[all.indexOf(g) % GCOL.length];

function Chart({ sel, setSel, onOpen, monthly }: { sel: string | null; setSel: (s: string | null) => void; onOpen: (id: string) => void; monthly: number }) {
  const { rec, today } = useApp();
  const W = 1000, H = 300, gs = rec.goals;
  const t = (d: string) => Date.parse(d + "T00:00:00Z");
  const t0 = Math.min(...gs.map((g) => t(g.start)), t(today)), t1 = Math.max(...gs.map((g) => t(g.deadline)), t(today) + 864e5);
  const xf = (d: string) => (t(d) - t0) / (t1 - t0 || 1), yf = (p: number) => 1 - p / 100;
  const sg = gs.find((g) => g.id === sel);
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Все цели на одном графике <span className="sub" style={{ marginLeft: "auto", fontWeight: 500, fontSize: 12, marginTop: 0 }}>прогресс в % от цели</span></h2>
      <div className="gchart" style={{ height: 200, marginTop: 18 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[25, 50, 75, 100].map((p) => <line key={p} x1="0" x2={W} y1={yf(p) * H} y2={yf(p) * H} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <line x1={xf(today) * W} x2={xf(today) * W} y1="0" y2={H} stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 3" opacity=".5" vectorEffect="non-scaling-stroke" />
          {gs.map((g) => {
            const c = color(gs, g), tg = goalTarget(g, monthly), on = !sel || sel === g.id;
            const pts = g.hist.map((h) => `${(xf(h.date) * W).toFixed(1)},${(yf(goalPct(g, tg, h.v)) * H).toFixed(1)}`);
            return (
              <g key={g.id}>
                <line x1={xf(g.start) * W} y1={H} x2={xf(g.deadline) * W} y2="0" stroke={c} strokeWidth="1.2" strokeDasharray="5 5" opacity={sel === g.id ? 0.9 : sel ? 0 : 0.25} vectorEffect="non-scaling-stroke" />
                {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth={sel === g.id ? 3.2 : 2} opacity={on ? 1 : 0.18} vectorEffect="non-scaling-stroke" />}
              </g>
            );
          })}
        </svg>
        {gs.map((g) => {
          const l = g.hist.at(-1) ?? { date: g.start, v: g.start_val };
          return <span key={g.id} className="gdot" style={{ left: `${xf(l.date) * 100}%`, top: `${yf(goalPct(g, goalTarget(g, monthly), l.v)) * 100}%`, background: color(gs, g), opacity: !sel || sel === g.id ? 1 : 0.2 }} />;
        })}
        {[50, 100].map((p) => <span key={p} className="glab" style={{ left: 0, top: `${yf(p) * 100}%`, transform: "translateY(-120%)", color: "var(--muted)" }}>{p}%</span>)}
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        {gs.map((g) => (
          <button key={g.id} className={sel === g.id ? "on" : ""} style={sel === g.id ? { borderColor: color(gs, g), color: "var(--fg)" } : undefined} onClick={() => setSel(sel === g.id ? null : g.id)}>
            <i className="dot" style={{ display: "inline-block", marginRight: 6, background: color(gs, g) }} />{g.title} · {Math.round(goalPct(g, goalTarget(g, monthly), goalCur(g)))}%
          </button>
        ))}
      </div>
      {sg ? (() => {
        const tg = goalTarget(sg, monthly), P = goalPlan(sg, tg, today);
        return <div className="sub" style={{ fontSize: 13, marginTop: 8 }}>{sg.title}: сейчас {fmtGoal(P.cur, sg.unit)} из {fmtGoal(tg, sg.unit)}, по плану должно быть {fmtGoal(P.exp, sg.unit)}. Пунктир показывает, как должно расти. <button className="mini" onClick={() => onOpen(sg.id)}>Открыть папку цели →</button></div>;
      })() : <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Нажми на цель, чтобы выделить её линию и увидеть план</div>}
    </section>
  );
}

function ManualGoal({ onCreate }: { onCreate: (d: GoalDraft[]) => Promise<{ n: number }> }) {
  const { today, toast } = useApp();
  const [f, setF] = useState({ title: "", now: "", target: "", unit: "", deadline: addDays(today, 180), why: "", savings: false });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || (!f.savings && !num(f.target))) return toast("Заполни название и цель (число)");
    const { n } = await onCreate([{ title: f.title.trim(), horizon: "year", deadline: f.deadline, start_val: num(f.now), target: num(f.target) || 1, unit: f.savings ? "сум" : f.unit.trim(), why: f.why.trim(), kind: f.savings ? "savings" : "", steps: [], habits: [] }]);
    if (n) { setF({ ...f, title: "", now: "", target: "", unit: "", why: "", savings: false }); toast("Цель добавлена"); }
  }
  return (
    <form className="form" onSubmit={add}>
      <input className="input" placeholder="Название, например «Вес 78 кг»" value={f.title} onChange={set("title")} />
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" inputMode="decimal" placeholder="Сейчас" value={f.now} onChange={set("now")} style={{ flex: "1 1 90px" }} />
        {!f.savings && <input className="input" inputMode="decimal" placeholder="Цель" value={f.target} onChange={set("target")} style={{ flex: "1 1 90px" }} />}
        {!f.savings && <input className="input" placeholder="Единица: сум, кг" value={f.unit} onChange={set("unit")} style={{ flex: "1 1 110px" }} />}
        <label className="lbl" style={{ flex: "0 1 150px" }}>Дедлайн<input className="input" type="date" value={f.deadline} onChange={set("deadline")} /></label>
      </div>
      <input className="input" placeholder="Зачем (коротко)" value={f.why} onChange={set("why")} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={f.savings} onChange={set("savings")} /> Это подушка безопасности: цель считается как 6 месяцев обязательных платежей</label>
      <button className="btn pri" style={{ alignSelf: "flex-start" }}>Добавить</button>
    </form>
  );
}

function Detail({ g, onBack }: { g: Goal; onBack: () => void }) {
  const { rec, tasks, today, patchRec, removeRec, addTasks, settings, toast } = useApp();
  const monthly = useMonthly();
  const tg = goalTarget(g, monthly), cur = goalCur(g), pc = Math.round(goalPct(g, tg, cur)), P = goalPlan(g, tg, today);
  const steps = tasks.filter((t) => t.goal_id === g.id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const [val, setVal] = useState("");
  const [cur$, setCur$] = useState<Cur>("uzs");
  const [answer, setAnswer] = useState("");
  const [habit, setHabit] = useState({ text: "", freq: "" });
  const wk = addDays(today, -27);

  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (!val.trim()) return;
    const v = g.unit === "сум" ? toUZS(num(val), cur$, settings.rates).sum : num(val);
    // The cushion grows by what was put aside; other goals take the new current value.
    const next = g.kind === "savings" ? cur + v : v;
    if (await patchRec("goals", g.id, { hist: [...g.hist.filter((h) => h.date !== today), { date: today, v: next }].slice(-1000) })) { setVal(""); toast("Записал"); }
  }
  const toggleHabit = (id: string) => patchRec("goals", g.id, { habits: g.habits.map((h) => (h.id === id ? { ...h, log: h.log.includes(today) ? h.log.filter((d) => d !== today) : [...h.log, today].slice(-400) } : h)) });
  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!habit.text.trim()) return;
    if (await patchRec("goals", g.id, { habits: [...g.habits, { id: hid(), text: habit.text.trim(), freq: habit.freq.trim(), log: [] }] })) setHabit({ text: "", freq: "" });
  }
  async function readAnswer() {
    const d = parseGoals(answer, addDays(today, 7))[0];
    if (!d || (!d.steps.length && !d.habits.length)) return toast("Не нашёл строк «ШАГ:» или «ПРИВЫЧКА:»");
    const added = d.steps.length ? (await addTasks(d.steps.map((s) => ({ title: s.title, project: s.project, due: s.due, time: null, goal_id: g.id })))).length : 0;
    if (d.habits.length) await patchRec("goals", g.id, { habits: [...g.habits, ...d.habits.map((h) => ({ id: hid(), text: h.text, freq: h.freq, log: [] }))].slice(0, 20) });
    setAnswer("");
    toast(`Шагов: ${added}, привычек: ${d.habits.length}`);
  }
  return (
    <>
      <div className="head">
        <div>
          <div className="crumbs fpath"><button className="mini" onClick={onBack}>Цели</button><span>›</span><b>{g.title}</b></div>
          <h1>{g.title}</h1>{g.why && <div className="sub">Зачем: {g.why}</div>}
        </div>
        <button className="btn" onClick={onBack}>← Все цели</button>
      </div>
      <section className="panel goal" style={{ marginBottom: 16 }}>
        <div className="top"><div style={{ flex: 1, minWidth: 0 }}><span className="big">{fmtGoal(cur, g.unit)} из {fmtGoal(tg, g.unit)} · {pc}%</span></div><span className={"pill " + ST[P.st][1]}>{ST[P.st][0]}</span></div>
        <GoalChart g={g} tg={tg} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}><span>По плану сейчас должно быть {fmtGoal(P.exp, g.unit)}</span><span>{P.left > 0 ? `Осталось ${P.left} дн` : "Срок прошёл"}</span></div>
        <form className="addbar" style={{ margin: "8px 0 0" }} onSubmit={update}>
          <span className="sub" style={{ alignSelf: "center", marginTop: 0 }}>{g.kind === "savings" ? "Отложил" : "Сейчас"}</span>
          <input className="input" inputMode="decimal" placeholder={g.kind === "savings" ? "Сумма" : String(cur)} value={val} onChange={(e) => setVal(e.target.value)} style={{ flex: "0 1 140px" }} />
          {g.unit === "сум" && <CurSelect value={cur$} onChange={setCur$} />}
          <button className="btn pri">{g.kind === "savings" ? "Добавить" : "Обновить"}</button>
        </form>
        {g.kind === "savings" && <div className="sub" style={{ fontSize: 12 }}>Цель считается как 6 месяцев обязательных платежей: {rub(monthly)} в месяц сейчас</div>}
      </section>
      <div className="grid g2">
        <section className="panel goal">
          <h2>Привычки</h2>
          {g.habits.length ? g.habits.map((h) => {
            const on = h.log.includes(today), n = h.log.filter((d) => d >= wk).length;
            return (
              <div className="chk-row" key={h.id}>
                <button className={"chk" + (on ? " on" : "")} aria-label="Сделал сегодня" onClick={() => toggleHabit(h.id)} />
                <span style={{ flex: 1, minWidth: 0 }}>{h.text}</span>
                {h.freq && <span className="pill p-mute">{h.freq}</span>}
                <span className="amt" style={{ fontSize: 11, color: "var(--muted)" }}>{n}× за 4 нед</span>
                <button className="mini" aria-label="Удалить привычку" onClick={() => patchRec("goals", g.id, { habits: g.habits.filter((x) => x.id !== h.id) })}>✕</button>
              </div>
            );
          }) : <Empty>Привычек пока нет</Empty>}
          <form className="addbar" style={{ margin: "10px 0 0" }} onSubmit={addHabit}>
            <input className="input" placeholder="Новая привычка" value={habit.text} onChange={(e) => setHabit({ ...habit, text: e.target.value })} />
            <input className="input" placeholder="Как часто" value={habit.freq} onChange={(e) => setHabit({ ...habit, freq: e.target.value })} style={{ flex: "0 1 120px" }} />
            <button className="btn">+</button>
          </form>
        </section>
        <section className="panel goal">
          <h2>Шаги · {steps.filter((t) => t.done).length} из {steps.length}</h2>
          <div className="list">{steps.length ? steps.map((t) => <TaskRow key={t.id} t={t} />) : <Empty>Шагов пока нет</Empty>}</div>
          <div className="sub" style={{ fontSize: 12 }}>Шаги лежат в задачах и календаре</div>
          <div className="addbar" style={{ margin: "10px 0 0" }}>
            <ClaudeBtn label={steps.length ? "Следующие шаги в Claude ↗" : "Разбить на шаги в Claude ↗"} prompt={() => nextStepsPrompt(g, Math.round(cur), Math.round(tg), ST[P.st][0], steps.map((t) => t.title + (t.done ? " (сделано)" : "")), today)} hint="Ответ Claude вставь в поле ниже" onAnswer={setAnswer} />
          </div>
          <div className="addbar" style={{ margin: 0 }}>
            <textarea className="input" style={{ minHeight: 44, flex: "1 1 220px" }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ Claude: строки ШАГ / ПРИВЫЧКА" />
            <button className="btn" onClick={readAnswer} disabled={!answer.trim()}>Добавить</button>
          </div>
        </section>
      </div>
      <div style={{ marginTop: 16 }}>
        <Fold title="Изменить цель"><EditGoal g={g} /></Fold>
        <button className="mini" style={{ color: "var(--bad)" }} onClick={async () => { if (confirm(`Удалить цель «${g.title}»? Шаги останутся в задачах.`) && (await removeRec("goals", g.id))) onBack(); }}>Удалить цель</button>
      </div>
      {rec.goals.length > 1 && <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Другие цели: {rec.goals.filter((x) => x.id !== g.id).map((x) => x.title).join(", ")}</div>}
    </>
  );
}

function EditGoal({ g }: { g: Goal }) {
  const { patchRec, toast } = useApp();
  const [f, setF] = useState({ title: g.title, target: String(g.target), unit: g.unit, deadline: g.deadline, why: g.why, horizon: g.horizon });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    if (await patchRec("goals", g.id, { title: f.title.trim(), target: num(f.target) || g.target, unit: f.unit.trim(), deadline: f.deadline, why: f.why.trim(), horizon: f.horizon })) toast("Сохранено");
  }
  return (
    <form className="form" onSubmit={save}>
      <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Название" />
      <div className="addbar" style={{ margin: 0 }}>
        {g.kind !== "savings" && <input className="input" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} aria-label="Цель" style={{ flex: "1 1 90px" }} />}
        {g.kind !== "savings" && <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label="Единица" style={{ flex: "1 1 90px" }} />}
        <select className="input" value={f.horizon} onChange={(e) => setF({ ...f, horizon: e.target.value as Goal["horizon"] })} aria-label="Горизонт" style={{ flex: "0 1 120px" }}>
          {Object.entries(HORIZON).map(([k, n]) => <option key={k} value={k}>на {n}</option>)}
        </select>
        <input className="input" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} aria-label="Дедлайн" style={{ flex: "0 1 150px" }} />
      </div>
      <input className="input" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="Зачем" />
      <button className="btn pri" style={{ alignSelf: "flex-start" }}>Сохранить</button>
    </form>
  );
}

function GoalChart({ g, tg }: { g: Goal; tg: number }) {
  const { today } = useApp();
  const W = 1000, H = 300;
  const t = (d: string) => Date.parse(d + "T00:00:00Z");
  const tS = t(g.start), tE = Math.max(t(g.deadline), tS + 864e5);
  const vals = g.hist.map((h) => h.v);
  const vmax = Math.max(tg, g.start_val, ...vals) * 1.08 || 1, vmin = Math.min(0, tg, g.start_val, ...vals);
  const xf = (d: string) => Math.min(1, Math.max(0, (t(d) - tS) / (tE - tS))), yf = (v: number) => 1 - (v - vmin) / (vmax - vmin || 1);
  const pts = g.hist.map((h) => `${(xf(h.date) * W).toFixed(1)},${(yf(h.v) * H).toFixed(1)}`);
  const last = g.hist.at(-1) ?? { date: g.start, v: g.start_val };
  return (
    <>
      <div className="gchart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={W} y1={yf(tg) * H} y2={yf(tg) * H} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={yf(g.start_val) * H} x2={W} y2={yf(tg) * H} stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <line x1={xf(today) * W} x2={xf(today) * W} y1="0" y2={H} stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />}
        </svg>
        <span className="gdot" style={{ left: `${xf(last.date) * 100}%`, top: `${yf(last.v) * 100}%` }} />
        <span className="glab tgt" style={{ top: `${yf(tg) * 100}%` }}>цель {fmtGoal(tg, g.unit)}</span>
      </div>
      <div className="gaxis"><span>{fd(g.start, today)}</span><span>дедлайн {fd(g.deadline, today)}</span></div>
    </>
  );
}
