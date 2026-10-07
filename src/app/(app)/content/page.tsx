"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { ClaudeBtn, Empty } from "@/components/ui";
import { fmtName, ideasPrompt, parseIdeas, PLAT, PLATS, repackPrompt, scriptPrompt, STATUS, FMT_NAME } from "@/lib/content";
import { fd } from "@/lib/dates";
import type { IdeaRow } from "@/lib/records";
import { PLATFORMS, type Platform } from "@/lib/types";

type Tab = "ideas" | "plan" | "stats";
const Dot = ({ p }: { p: Platform | null }) => <span className="dot" style={{ background: p ? PLAT[p].c : "var(--faint)" }} />;
const int = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(/\s/g, "")) || 0)));

export default function Content() {
  const { rec } = useApp();
  const [tab, setTab] = useState<Tab>("ideas");
  const [pf, setPf] = useState<Platform | "all">("all");
  const match = (i: IdeaRow) => pf === "all" || i.platform === pf;
  const bank = rec.ideas.filter((i) => i.approved && i.status === 0);
  return (
    <>
      <div className="head"><div><h1>Контент</h1><div className="sub">Банк идей, план публикаций и что приносит заявки</div></div></div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {([["ideas", `Банк идей · ${bank.length}`], ["plan", "План"], ["stats", "Статистика"]] as [Tab, string][]).map(([k, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} style={{ fontSize: 14, padding: "6px 16px" }}>{n}</button>
        ))}
      </div>
      <div className="tabs">
        <button className={pf === "all" ? "on" : ""} onClick={() => setPf("all")}>Все площадки</button>
        {PLATS.map((p) => <button key={p} className={pf === p ? "on" : ""} onClick={() => setPf(p)}><Dot p={p} /> {PLAT[p].n}</button>)}
      </div>
      {tab === "ideas" && <Ideas match={match} />}
      {tab === "plan" && <Plan match={match} />}
      {tab === "stats" && <Stats pf={pf} />}
    </>
  );
}

function Ideas({ match }: { match: (i: IdeaRow) => boolean }) {
  const { rec, addRec, patchRec, removeRec, toast } = useApp();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const waiting = rec.ideas.filter((i) => !i.approved);
  const bank = rec.ideas.filter((i) => i.approved && i.status === 0 && match(i)).reverse();
  const liked = rec.ideas.filter((i) => i.status === 3 && (i.leads ?? 0) > 0).sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0)).slice(0, 5).map((i) => `${i.title} (${fmtName(i.platform, i.format)}, заявок ${i.leads})`);

  async function save() {
    const list = parseIdeas(text);
    if (!list.length) return toast("Напиши хотя бы одну идею");
    if ((await addRec("ideas", list.map((x) => ({ ...x, approved: false })))).length) { setText(""); toast(`Идей на утверждение: ${list.length}`); }
  }
  async function readAnswer() {
    const list = parseIdeas(answer).filter((x) => x.platform);
    if (!list.length) return toast("Не нашёл строк «идея | площадка | формат»");
    const fresh: typeof list = [];
    for (const x of list) {
      const same = waiting.find((w) => w.title.toLowerCase() === x.title.toLowerCase());
      if (same) await patchRec("ideas", same.id, { platform: x.platform, format: x.format, why: x.why });
      else fresh.push(x);
    }
    if (fresh.length) await addRec("ideas", fresh.map((x) => ({ ...x, approved: false })));
    setAnswer("");
    toast(`Предложения разобраны: ${list.length}`);
  }
  const approve = (i: IdeaRow, status: 0 | 1) => patchRec("ideas", i.id, { approved: true, status });
  return (
    <>
      <section className="capture">
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Одна идея или сразу список, каждая с новой строки. Можно надиктовать с клавиатуры телефона" />
        <div className="acts">
          <span className="sub" style={{ fontSize: 12, flex: 1 }}>Claude предложит площадку и формат, ты утверждаешь</span>
          <ClaudeBtn label="Предложить формат в Claude ↗" prompt={() => ideasPrompt(text, liked)} hint="Ответ Claude вставь в поле ниже" />
          <button className="btn pri" onClick={save}>Сохранить</button>
        </div>
        <div className="addbar" style={{ margin: 0 }}>
          <textarea className="input" style={{ minHeight: 44, flex: "1 1 260px" }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ Claude: идея | площадка | формат | почему" />
          <button className="btn" onClick={readAnswer} disabled={!answer.trim()}>Разобрать ответ</button>
        </div>
      </section>

      {waiting.length > 0 && (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
          <h2>На утверждение · {waiting.length}
            {waiting.some((i) => i.platform) && <button className="btn" style={{ marginLeft: "auto" }} onClick={async () => { for (const i of waiting) if (i.platform) await approve(i, 0); }}>Всё в банк</button>}
          </h2>
          {waiting.map((i) => (
            <div className="row" key={i.id} style={{ flexWrap: "wrap" }}>
              <div className="t" style={{ flex: "1 1 220px" }}><b>{i.title}</b><span>{i.why || (i.platform ? "" : "ждёт предложения Claude или выбери сам")}</span></div>
              <select className="input" style={{ flex: "0 1 130px" }} aria-label="Площадка" value={i.platform ?? ""} onChange={(e) => { const p = (e.target.value || null) as Platform | null; patchRec("ideas", i.id, { platform: p, format: p ? PLATFORMS[p][0] : "" }); }}>
                <option value="">Площадка</option>
                {PLATS.map((p) => <option key={p} value={p}>{PLAT[p].n}</option>)}
              </select>
              <select className="input" style={{ flex: "0 1 140px" }} aria-label="Формат" value={i.format} disabled={!i.platform} onChange={(e) => patchRec("ideas", i.id, { format: e.target.value })}>
                {i.platform ? PLATFORMS[i.platform].map((f) => <option key={f} value={f}>{FMT_NAME[f]}</option>) : <option value="">Формат</option>}
              </select>
              <button className="btn pri" disabled={!i.platform} onClick={() => approve(i, 1)}>В работу</button>
              <button className="mini" disabled={!i.platform} onClick={() => approve(i, 0)}>в банк</button>
              <button className="mini" aria-label="Удалить" onClick={() => removeRec("ideas", i.id)}>✕</button>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h2>Банк идей · {bank.length}</h2>
        <div className="list">
          {bank.length ? bank.map((i) => (
            <div className="row" key={i.id} style={{ flexWrap: "wrap" }}>
              <Dot p={i.platform} />
              <div className="t" style={{ flex: "1 1 200px" }}><b>{i.title}</b><span>{i.platform ? PLAT[i.platform].n : ""} · {fmtName(i.platform, i.format)}</span></div>
              <ClaudeBtn className="mini" label="переупаковать ↗" prompt={() => repackPrompt(i.title, i.platform, i.format)} hint="Ответ Claude вставь в поле ответа сверху" />
              <button className="btn" onClick={() => patchRec("ideas", i.id, { status: 1 })}>В работу</button>
              <button className="mini" aria-label="Удалить" onClick={() => confirm(`Удалить «${i.title}»?`) && removeRec("ideas", i.id)}>✕</button>
            </div>
          )) : <Empty>Идей пока нет</Empty>}
        </div>
      </section>
    </>
  );
}

function Plan({ match }: { match: (i: IdeaRow) => boolean }) {
  const { rec, today, patchRec } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const items = rec.ideas.filter((i) => i.approved && i.status > 0 && match(i));
  return (
    <div className="kanban" style={{ gridTemplateColumns: "repeat(3,minmax(230px,1fr))" }}>
      {[1, 2, 3].map((st) => {
        const col = items.filter((i) => i.status === st).sort((a, b) => (st === 3 ? (b.date ?? "").localeCompare(a.date ?? "") : (a.date ?? "9").localeCompare(b.date ?? "9")));
        return (
          <div className="col" key={st}>
            <h3>{STATUS[st]}<span>{col.length}</span></h3>
            {col.length === 0 && <div className="sub" style={{ fontSize: 12 }}>{st === 1 ? "Возьми идею из банка" : "Пусто"}</div>}
            {col.map((i) => (
              <div className="card" key={i.id}>
                <b>{i.title}</b>
                <div className="meta"><Dot p={i.platform} />{fmtName(i.platform, i.format)}</div>
                <div className="meta">
                  <input className="input" type="date" aria-label="Дата публикации" value={i.date ?? ""} onChange={(e) => patchRec("ideas", i.id, { date: e.target.value || null })} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }} />
                  {st < 3 && <button className="mini" onClick={() => patchRec("ideas", i.id, { status: st + 1, ...(st === 2 && !i.date ? { date: today } : {}) })}>{STATUS[st + 1]} →</button>}
                  {st > 1 && <button className="mini" title="Вернуть назад" aria-label="Вернуть назад" onClick={() => patchRec("ideas", i.id, { status: st - 1 })}>←</button>}
                </div>
                {st < 3 ? (
                  <>
                    <div className="meta">
                      <ClaudeBtn className="mini" label="сценарий в Claude ↗" prompt={() => scriptPrompt(i.title, i.platform, i.format)} hint="Готовый сценарий вставь сюда" />
                      <button className="mini" onClick={() => setOpen(open === i.id ? null : i.id)}>{i.script ? "открыть сценарий" : "вставить сценарий"}</button>
                    </div>
                    {open === i.id && <ScriptBox i={i} />}
                  </>
                ) : (
                  <div className="meta"><span>{i.date ? fd(i.date, today) : ""}</span><span style={{ marginLeft: "auto" }}>охват {i.reach ?? "—"} · заявки {i.leads ?? "—"}</span></div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ScriptBox({ i }: { i: IdeaRow }) {
  const { patchRec, toast } = useApp();
  const [v, setV] = useState(i.script);
  return (
    <>
      <textarea className="input" style={{ minHeight: 120, width: "100%" }} value={v} onChange={(e) => setV(e.target.value)} placeholder="Сценарий" />
      <button className="btn" disabled={v === i.script} onClick={async () => { if (await patchRec("ideas", i.id, { script: v })) toast("Сценарий сохранён"); }}>Сохранить</button>
    </>
  );
}

function Spark({ v, c }: { v: number[]; c: string }) {
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${38 - ((x - min) / (max - min || 1)) * 34}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function Stats({ pf }: { pf: Platform | "all" }) {
  const { rec, settings, today, setSetting, patchRec, toast } = useApp();
  const [nums, setNums] = useState<Record<string, string>>({});
  const plats = pf === "all" ? PLATS : [pf];
  const fol = settings.followers;
  async function saveFollowers(p: Platform) {
    const n = int(nums[p] ?? "");
    if (n === null) return toast("Впиши число подписчиков");
    const hist = [...fol[p].filter((x) => x.date !== today), { date: today, n }].sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
    if (await setSetting("followers", { ...fol, [p]: hist })) { setNums({ ...nums, [p]: "" }); toast("Записал"); }
  }
  const rows = plats.flatMap((p) => PLATFORMS[p].map((f) => {
    const all = rec.ideas.filter((i) => i.approved && i.platform === p && i.format === f);
    const pub = all.filter((i) => i.status === 3);
    return { p, f, bank: all.filter((i) => i.status === 0).length, work: all.filter((i) => i.status === 1 || i.status === 2).length, pub: pub.length, reach: pub.reduce((s, i) => s + (i.reach ?? 0), 0), leads: pub.reduce((s, i) => s + (i.leads ?? 0), 0) };
  }));
  const maxPub = Math.max(1, ...rows.map((r) => r.pub));
  const pubs = rec.ideas.filter((i) => i.status === 3 && i.platform && plats.includes(i.platform)).sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0) || (b.reach ?? 0) - (a.reach ?? 0));
  return (
    <>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        {plats.map((p) => {
          const h = fol[p], last = h[h.length - 1], d = h.length > 1 ? last.n - h[0].n : 0;
          return (
            <section className="panel" key={p}>
              <div className="plat"><Dot p={p} />{PLAT[p].n}{h.length > 1 && <span className={"pill " + (d >= 0 ? "p-ok" : "p-bad")} style={{ marginLeft: "auto" }}>{d >= 0 ? "+" : ""}{d.toLocaleString("ru-RU")} с {fd(h[0].date, today)}</span>}</div>
              <div className="kpi" style={{ border: 0, padding: "8px 0 0", background: "none" }}><div className="v">{last ? last.n.toLocaleString("ru-RU") : "—"}</div><div className="n">подписчиков{last ? `, ${fd(last.date, today)}` : ""}</div></div>
              <Spark v={h.map((x) => x.n)} c={PLAT[p].c} />
              <form className="addbar" style={{ margin: "10px 0 0" }} onSubmit={(e) => { e.preventDefault(); saveFollowers(p); }}>
                <input className="input" inputMode="numeric" placeholder="Сколько сейчас" value={nums[p] ?? ""} onChange={(e) => setNums({ ...nums, [p]: e.target.value })} style={{ flex: "1 1 100px" }} />
                <button className="btn">Обновить</button>
              </form>
            </section>
          );
        })}
      </div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>По форматам</h2>
        <div className="tbl-wrap"><table style={{ minWidth: 520 }}>
          <thead><tr><th>Площадка</th><th>Формат</th><th className="r">В банке</th><th className="r">В работе</th><th className="r">Выложено</th><th className="r">Охват</th><th className="r">Заявки</th><th style={{ width: "18%" }} /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.p + r.f}><td><Dot p={r.p} /> {PLAT[r.p].n}</td><td>{FMT_NAME[r.f]}</td><td className="r amt">{r.bank}</td><td className="r amt">{r.work}</td><td className="r amt"><b>{r.pub}</b></td><td className="r amt">{r.reach.toLocaleString("ru-RU")}</td><td className="r amt" style={{ color: "var(--ok)" }}><b>{r.leads}</b></td>
              <td><div className="bar" style={{ margin: 0 }}><i style={{ width: `${(r.pub / maxPub) * 100}%`, background: PLAT[r.p].c }} /></div></td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <section className="panel">
        <h2>Выложенные публикации · что приносит заявки</h2>
        {pubs.length ? <div className="tbl-wrap"><table style={{ minWidth: 560 }}>
          <thead><tr><th>Публикация</th><th>Формат</th><th>Дата</th><th className="r">Охват</th><th className="r">Заявки</th><th /></tr></thead>
          <tbody>{pubs.map((i) => (
            <tr key={i.id}>
              <td><Dot p={i.platform} /> {i.title}</td><td style={{ color: "var(--muted)" }}>{fmtName(i.platform, i.format)}</td><td style={{ color: "var(--muted)" }}>{i.date ? fd(i.date, today) : "—"}</td>
              <td className="r"><input className="input mono-in" inputMode="numeric" aria-label="Охват" defaultValue={i.reach ?? ""} onBlur={(e) => int(e.target.value) !== i.reach && patchRec("ideas", i.id, { reach: int(e.target.value) })} style={{ textAlign: "right" }} /></td>
              <td className="r"><input className="input" inputMode="numeric" aria-label="Заявки" defaultValue={i.leads ?? ""} onBlur={(e) => int(e.target.value) !== i.leads && patchRec("ideas", i.id, { leads: int(e.target.value) })} style={{ width: 64, textAlign: "right" }} /></td>
              <td><ClaudeBtn className="mini" label="переупаковать ↗" prompt={() => repackPrompt(i.title, i.platform, i.format)} hint="Ответ Claude вставь в «Банк идей»" /></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty>Когда публикация попадёт в «Выложено», здесь можно будет вписать охват и заявки</Empty>}
        <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Охват вписываешь из статистики площадки, заявки отмечаешь, когда клиент пишет «увидел ваш пост»</div>
      </section>
    </>
  );
}
