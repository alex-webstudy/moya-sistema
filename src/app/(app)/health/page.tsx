"use client";
import { useState } from "react";
import { FoodLog, useDay, useTraining, Water, Workout } from "@/components/health";
import { useApp } from "@/components/store";
import { ClaudeBtn, Empty, Fold } from "@/components/ui";
import { dayNum, fd, monthGrid, MONN, weekDays } from "@/lib/dates";
import { MEALS, menuPrompt, parseMeasures, parseMenu, type MeasureVals } from "@/lib/health";
import type { Measure } from "@/lib/records";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const fmt = (x: number) => (Math.round(x * 100) / 100).toLocaleString("ru-RU");

export default function Health() {
  const { rec, today, patchDay } = useApp();
  const tr = useTraining();
  const isTraining = tr.on;
  const byDate = new Map(rec.days.map((d) => [d.date, d]));
  const g = monthGrid(today);
  let trPlan = 0, trDone = 0, fDays = 0, fGood = 0;
  for (const s of g.days.filter((x) => x <= today)) {
    const d = byDate.get(s);
    // A workout moved to another day still counts: done is every day trained, plan is the schedule.
    if (isTraining(s)) trPlan++;
    if (d?.workout) trDone++;
    if (d && d.food_ok !== null) { fDays++; if (d.food_ok) fGood++; }
  }
  const wk = weekDays(today).filter((x) => x <= today);
  const wWater = wk.reduce((s, x) => s + (byDate.get(x)?.water ?? 0), 0);
  const ms = [...rec.measures].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const B = ms.at(-1), A = ms.at(-2);
  const delta = (k: keyof MeasureVals, u: string) => {
    if (!A || !B || A[k] == null || B[k] == null) return "—";
    const v = Math.round((B[k]! - A[k]!) * 10) / 10;
    return `${v > 0 ? "+" : ""}${v.toLocaleString("ru-RU")} ${u}`;
  };
  const train = isTraining(today);

  return (
    <>
      <div className="head"><div><h1>Здоровье</h1><div className="sub">Тренировки с {tr.start} до {tr.end} · вода и еда каждый день · замеры раз в неделю</div></div></div>
      <div className="kpis">
        <div className="kpi"><div className="l">Тренировки, {MONN[g.month].toLowerCase()}</div><div className="v">{Math.min(trDone, trPlan)} / {trPlan}</div><div className="n">по графику на сегодня</div></div>
        <div className="kpi"><div className="l">Дни с правильным питанием</div><div className="v">{fGood} / {fDays}</div><div className="n">{fDays ? Math.round((fGood / fDays) * 100) : 0}% отмеченных дней</div></div>
        <div className="kpi"><div className="l">Вода за неделю</div><div className="v">{fmt(wWater)} л</div><div className="n">в среднем {wk.length ? fmt(wWater / wk.length) : 0} л в день</div></div>
        <div className="kpi"><div className="l">Вес</div><div className="v">{B?.weight != null ? fmt(B.weight) + " кг" : "—"}</div><div className="n">с прошлого замера {delta("weight", "кг")}</div></div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <h2>Сегодня</h2>
          <div className="step" style={{ paddingTop: 0 }}><div className="body"><h3>{train ? "Тренировка была?" : "Сегодня день отдыха"}</h3><Workout date={today} /></div></div>
          <div className="step"><div className="body"><h3>Вода</h3><Water date={today} /></div></div>
          <div className="step"><div className="body"><h3>Что ел сегодня?</h3><FoodLog date={today} /></div></div>
        </section>
        <section className="panel">
          <h2>{MONN[g.month]}</h2>
          <div className="cal">
            {WD.map((w) => <div className="wd" key={w}>{w}</div>)}
            {Array.from({ length: g.lead }, (_, i) => <div key={"b" + i} />)}
            {g.days.map((s) => {
              const d = byDate.get(s);
              const w = d?.workout ?? null;
              // Past days: tap to mark a workout (done → missed → clear; off-schedule days only done → clear).
              const next = w === null ? true : w && isTraining(s) ? false : null;
              return (
                <div key={s} className={"day" + (s === today ? " today" : "") + (s > today ? " fut" : "")}
                  {...(s <= today ? { role: "button", tabIndex: 0, title: "Отметить тренировку", style: { cursor: "pointer" }, onClick: () => patchDay(s, { workout: next }),
                    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchDay(s, { workout: next }); } } } : {})}>
                  <span className="n">{dayNum(s)}</span>
                  <div className="marks">
                    {(isTraining(s) || w === true) && <span className={"m " + (d?.workout === true ? "p-ok" : d?.workout === false ? "p-bad" : "p-mute")}>трен</span>}
                    {d && d.food_ok !== null && <span className={"m " + (d.food_ok ? "p-ok" : "p-bad")}>еда</span>}
                    {!!d?.water && <span className="m p-info">{fmt(d.water)}л</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="dot" style={{ background: "var(--ok)" }} />выполнено</span>
            <span><i className="dot" style={{ background: "var(--bad)" }} />пропуск</span>
            <span><i className="dot" style={{ background: "var(--info)" }} />вода, л</span>
            <span>нажми на прошедший день, чтобы отметить тренировку</span>
          </div>
        </section>
      </div>

      <Menu />
      <Fold title="Замеры раз в неделю" sub={B ? `${fd(B.date, today)}: вес ${B.weight ?? "—"} кг, талия ${B.waist ?? "—"} см` : "ещё не было"}>
        <Measures list={ms} delta={delta} />
      </Fold>
    </>
  );
}

function Menu() {
  const { settings, setSetting, today, toast } = useApp();
  const { day, set } = useDay(today);
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const prefs = settings.dish_prefs;
  const likes = Object.keys(prefs).filter((k) => prefs[k] > 0), dis = Object.keys(prefs).filter((k) => prefs[k] < 0);
  const menu = settings.menu;
  const eaten = day.food.reduce((s, x) => s + x.kcal, 0);

  async function save() {
    const items = parseMenu(answer);
    if (!items.length) return toast("Не нашёл строк «приём | блюдо | порция | ккал | белок»");
    if (await setSetting("menu", { date: today, items })) { setAnswer(""); setOpen(false); toast("Меню сохранено"); }
  }
  function pref(name: string, v: 1 | -1) {
    const next = { ...prefs };
    if (next[name] === v) delete next[name]; else next[name] = v;
    setSetting("dish_prefs", next);
  }

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Меню{menu && menu.date !== today ? ` от ${fd(menu.date, today)}` : " на сегодня"}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ClaudeBtn pri label="Подобрать в Claude ↗" prompt={() => menuPrompt(settings.kcal_norm, day.food, likes, dis)} hint="Вставь ответ Claude в поле ниже" />
        </span>
      </h2>
      <div className="sub" style={{ marginBottom: 10 }}>Осталось {Math.max(0, settings.kcal_norm - eaten)} ккал из {settings.kcal_norm}. <button className="mini" onClick={() => setOpen(!open)}>{open ? "скрыть поле" : "вставить ответ Claude"}</button></div>
      {open && (
        <div className="addbar">
          <textarea className="input" rows={4} placeholder="Завтрак | Сырники | 3 шт | 420 | 25" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button className="btn pri" onClick={save}>Сохранить меню</button>
        </div>
      )}
      {menu ? (
        <div className="menu-grid">
          {MEALS.map(([k, n]) => {
            const items = menu.items.filter((x) => x.meal === k);
            return items.length > 0 && (
              <div className="meal" key={k}>
                <h3>{n}</h3>
                {items.map((x, i) => (
                  <div key={i} className={"dish" + (prefs[x.name] > 0 ? " liked" : prefs[x.name] < 0 ? " disliked" : "")}>
                    <div style={{ flex: 1, minWidth: 0 }}><b>{x.name}</b><span>{x.portion ? x.portion + " · " : ""}{x.kcal} ккал · {x.protein} г белка</span></div>
                    <div className="dish-a">
                      <button className={"mini" + (prefs[x.name] > 0 ? " on" : "")} aria-label="Нравится" onClick={() => pref(x.name, 1)}>👍</button>
                      <button className={"mini" + (prefs[x.name] < 0 ? " on" : "")} aria-label="Не нравится" onClick={() => pref(x.name, -1)}>👎</button>
                      <button className="mini" onClick={async () => { if (await set({ food: [...day.food, { name: x.name, kcal: x.kcal, protein: x.protein }] })) toast("Записал в еду за сегодня"); }}>съел</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : <Empty>Нажми «Подобрать в Claude», он предложит по 3 варианта на каждый приём пищи</Empty>}
      <div className="sub" style={{ fontSize: 12, marginTop: 10 }}>
        {likes.length || dis.length ? <>{likes.length ? "Нравится: " + likes.join(", ") + ". " : ""}{dis.length ? "Не предлагаю: " + dis.join(", ") : ""}</> : "Отмечай 👍 и 👎: Claude будет чаще предлагать то, что нравится"}
      </div>
    </section>
  );
}

function Measures({ list, delta }: { list: Measure[]; delta: (k: keyof MeasureVals, u: string) => string }) {
  const { today, addRec, removeRec, toast } = useApp();
  const [v, setV] = useState<Record<keyof MeasureVals, string>>({ weight: "", waist: "", arms: "", chest: "" });
  const [text, setText] = useState("");
  const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) || null : null);

  async function save(vals: MeasureVals) {
    if (!Object.values(vals).some((x) => x)) return toast("Впиши хотя бы один замер");
    if ((await addRec("measures", [{ date: today, ...vals }])).length) { setV({ weight: "", waist: "", arms: "", chest: "" }); setText(""); toast("Замер записан"); }
  }
  const F: [keyof MeasureVals, string][] = [["weight", "Вес, кг"], ["waist", "Талия"], ["arms", "Руки"], ["chest", "Грудь"]];
  return (
    <div className="grid g2">
      <div style={{ minWidth: 0 }}>
        <form className="addbar" style={{ marginBottom: 6 }} onSubmit={(e) => { e.preventDefault(); save(Object.fromEntries(F.map(([k]) => [k, num(v[k])])) as MeasureVals); }}>
          {F.map(([k, n]) => <input key={k} className="input mono-in" inputMode="decimal" placeholder={n} aria-label={n} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />)}
          <button className="btn pri">Сохранить</button>
        </form>
        <form className="addbar" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); save(parseMeasures(text)); }}>
          <input className="input" placeholder="Или как есть: «вес 82.7, талия 88, руки 39, грудь 105»" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn">Записать</button>
        </form>
        <div className="sub" style={{ fontSize: 13, marginTop: 10 }}>С прошлого замера: вес {delta("weight", "кг")}, талия {delta("waist", "см")}, руки {delta("arms", "см")}, грудь {delta("chest", "см")}</div>
      </div>
      <div className="tbl-wrap" style={{ minWidth: 0 }}>
        {list.length ? (
          <table style={{ minWidth: 360 }}>
            <thead><tr><th>Дата</th><th className="r">Вес</th><th className="r">Талия</th><th className="r">Руки</th><th className="r">Грудь</th><th /></tr></thead>
            <tbody>
              {[...list].reverse().map((m) => (
                <tr key={m.id}><td>{fd(m.date, today)}</td>{F.map(([k]) => <td key={k} className="r amt">{m[k] ?? "—"}</td>)}<td><button className="mini" aria-label="Удалить" onClick={() => removeRec("measures", m.id)}>✕</button></td></tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Замеров пока нет</Empty>}
      </div>
    </div>
  );
}
