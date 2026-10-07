"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { ClaudeBtn, Empty } from "@/components/ui";
import { PLAT, PLATS } from "@/lib/content";
import { addDays, fd, fdue, weekday } from "@/lib/dates";
import { goalCur, goalPct, goalTarget } from "@/lib/goals";
import { WATER_GOAL } from "@/lib/health";
import { chargeNext, rub } from "@/lib/money";
import { monday, parseReview, WEEK_PROMPT } from "@/lib/week";

export default function Week() {
  const { rec, tasks, today, settings, addRec, patchRec, toast } = useApp();
  const [w, setW] = useState(() => monday(today));
  const [answer, setAnswer] = useState("");
  const [item, setItem] = useState("");
  const end = addDays(w, 6), last = end < today ? end : today;
  const next = addDays(w, 7);
  const inW = (d: string | null) => !!d && d >= w && d <= end;
  const row = (wk: string) => rec.weeks.find((x) => x.week === wk);
  const cur = row(w), nxt = row(next);
  const review = cur?.review ? parseReview(cur.review) : null;

  // Week numbers.
  const wt = tasks.filter((t) => inW(t.due));
  const missed = wt.filter((t) => !t.done && !!t.due && t.due < today);
  const pubs = rec.ideas.filter((i) => i.status === 3 && inW(i.date));
  const days = rec.days.filter((d) => inW(d.date) && d.date <= today);
  const planned = [...Array(7)].map((_, i) => addDays(w, i)).filter((d) => d <= last && settings.training.days.includes(weekday(d))).length;
  const trained = days.filter((d) => d.workout).length;
  const water = days.length ? days.reduce((s, d) => s + d.water, 0) / days.length : 0;
  const foodOk = days.filter((d) => d.food_ok === true).length, foodAll = days.filter((d) => d.food_ok !== null).length;
  const income = rec.income.filter((i) => inW(i.date)).reduce((s, i) => s + i.sum, 0);
  const spent = rec.purchases.filter((p) => inW(p.date)).reduce((s, p) => s + p.sum, 0);
  const meetings = rec.meetings.filter((m) => inW(m.date));
  const monthly = rec.charges.filter((c) => chargeNext(c, today)).reduce((s, c) => s + c.sum, 0);
  const goals = rec.goals.map((g) => {
    const tg = goalTarget(g, monthly);
    const before = [...g.hist].reverse().find((h) => h.date < w)?.v ?? g.start_val;
    return { title: g.title, было: Math.round(goalPct(g, tg, before)), стало: Math.round(goalPct(g, tg, goalCur(g))) };
  });

  function data() {
    return WEEK_PROMPT + JSON.stringify({
      неделя: `${w} — ${end}`,
      задачи: { выполнено: wt.filter((t) => t.done).length, всего: wt.length, не_сделано: missed.map((t) => t.title) },
      публикации: pubs.map((i) => ({ что: i.title, где: i.platform ? PLAT[i.platform].n : "", охват: i.reach, заявки: i.leads })),
      тренировки: `${trained} из ${planned}`,
      вода_в_среднем_л: Math.round(water * 10) / 10,
      питание_правильно_дней: `${foodOk} из ${foodAll}`,
      пришло_денег: income,
      покупки: spent,
      встречи: meetings.map((m) => m.title),
      цели_в_процентах: goals,
      был_фокус_недели: cur?.focus ?? [],
      задачи_на_следующую_неделю: tasks.filter((t) => !t.done && !!t.due && inW(addDays(t.due, -7))).map((t) => t.title),
      клиенты_ждём: rec.clients.filter((c) => c.waiting).map((c) => `${c.name}: ${c.waiting}`),
    }, null, 1);
  }
  async function saveWeek(wk: string, patch: { review?: string; focus?: string[] }) {
    const r = row(wk);
    return r ? patchRec("weeks", r.id, patch) : (await addRec("weeks", [{ week: wk, ...patch }])).length > 0;
  }
  async function readAnswer() {
    const r = parseReview(answer);
    if (!r.summary && !r.wins.length && !r.focus.length) return toast("Не нашёл блоков ИТОГ / ПОЛУЧИЛОСЬ / ФОКУС");
    await saveWeek(w, { review: answer.trim().slice(0, 6000) });
    if (r.focus.length) await saveWeek(next, { focus: [...new Set([...(nxt?.focus ?? []), ...r.focus])].slice(0, 10) });
    setAnswer("");
    toast("Итоги записаны");
  }
  async function addFocus(e: React.FormEvent) {
    e.preventDefault();
    const t = item.trim();
    if (!t) return;
    if ((nxt?.focus.length ?? 0) >= 10) return toast("Не больше 10 пунктов");
    if (await saveWeek(next, { focus: [...(nxt?.focus ?? []), t.slice(0, 300)] })) setItem("");
  }

  return (
    <>
      <div className="head">
        <div><h1>Итоги недели</h1><div className="sub">{fd(w, today)} — {fd(end, today)}. Каждое воскресенье в 20:00 подводим итоги</div></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" aria-label="Прошлая неделя" onClick={() => setW(addDays(w, -7))}>‹</button>
          <button className="btn" onClick={() => setW(monday(today))} disabled={w === monday(today)}>Эта неделя</button>
          <button className="btn" aria-label="Следующая неделя" onClick={() => setW(addDays(w, 7))} disabled={w >= monday(today)}>›</button>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Задачи</div><div className="v">{wt.filter((t) => t.done).length} / {wt.length}</div><div className="n">{missed.length ? `не сделано ${missed.length}` : "выполнено за неделю"}</div></div>
        <div className="kpi"><div className="l">Публикации</div><div className="v">{pubs.length}</div><div className="n">{PLATS.map((p) => `${p.toUpperCase()} ${pubs.filter((i) => i.platform === p).length}`).join(" · ")}</div></div>
        <div className="kpi"><div className="l">Заявки с контента</div><div className="v" style={{ color: "var(--ok)" }}>{pubs.reduce((s, i) => s + (i.leads ?? 0), 0)}</div></div>
        <div className="kpi"><div className="l">Тренировки</div><div className="v">{trained} / {planned}</div><div className="n">вода {Math.round(water * 10) / 10} из {WATER_GOAL} л · еда ок {foodOk} из {foodAll}</div></div>
        <div className="kpi"><div className="l">Пришло денег</div><div className="v">{rub(income)}</div><div className="n">покупки {rub(spent)}</div></div>
      </div>

      <section className="panel meet" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
        <h2>Разбор недели</h2>
        {review ? (
          <>
            {review.summary && <div>{review.summary}</div>}
            {review.wins.length > 0 && <><h3>Получилось</h3><ul>{review.wins.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {review.misses.length > 0 && <><h3>Провисло</h3><ul>{review.misses.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          </>
        ) : <div className="sub" style={{ marginBottom: 10 }}>Claude посмотрит задачи, контент, тренировки, деньги и цели за неделю и предложит фокус на следующую. Данные уже вложены в запрос</div>}
        <div className="addbar" style={{ margin: "12px 0 0" }}>
          <ClaudeBtn pri={!review} label={review ? "Разобрать заново в Claude ↗" : "Подвести итоги в Claude ↗"} prompt={data} hint="Ответ Claude вставь в поле ниже" onAnswer={setAnswer} />
        </div>
        <div className="addbar" style={{ margin: 0 }}>
          <textarea className="input" style={{ minHeight: 44, flex: "1 1 260px" }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ Claude: ИТОГ, ПОЛУЧИЛОСЬ, ПРОВИСЛО, ФОКУС" />
          <button className="btn" onClick={readAnswer} disabled={!answer.trim()}>Записать</button>
        </div>
      </section>

      <div className="grid g2">
        <section className="panel">
          <h2>Главное на следующую неделю</h2>
          <div className="list">
            {nxt?.focus.length ? nxt.focus.map((x, i) => (
              <div className="row" key={i}><span className="pill p-acc">{i + 1}</span><div className="t">{x}</div>
                <button className="mini" aria-label="Убрать" onClick={() => saveWeek(next, { focus: nxt.focus.filter((_, j) => j !== i) })}>✕</button></div>
            )) : <Empty>Пока пусто</Empty>}
          </div>
          <form className="addbar" style={{ margin: "10px 0 0" }} onSubmit={addFocus}>
            <input className="input" placeholder="Ключевой момент на следующую неделю" value={item} onChange={(e) => setItem(e.target.value)} />
            <button className="btn">Добавить</button>
          </form>
          <div className="sub" style={{ fontSize: 12 }}>Эти пункты будут висеть на странице «Сегодня» всю следующую неделю</div>
        </section>
        <section className="panel">
          <h2>Фокус этой недели</h2>
          <div className="list">{cur?.focus.length ? cur.focus.map((x, i) => <div className="row" key={i}><span className="pill p-mute">{i + 1}</span><div className="t">{x}</div></div>) : <Empty>Фокус на эту неделю не ставили</Empty>}</div>
          {missed.length > 0 && <><h2 style={{ marginTop: 14 }}>Не сделано</h2><div className="list">{missed.map((t) => <div className="row" key={t.id}><div className="t"><b>{t.title}</b><span>{t.project} · {fdue(t.due, today)}</span></div></div>)}</div></>}
        </section>
      </div>
    </>
  );
}
