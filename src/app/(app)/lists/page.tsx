"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { ClaudeBtn, CurSelect, Empty } from "@/components/ui";
import { diffDays, fd, monthOf, MONN, weekDays } from "@/lib/dates";
import { parsePurchases, shopPrompt } from "@/lib/health";
import { rub, toUZS, type Cur } from "@/lib/money";
import type { ListItem, Purchase } from "@/lib/records";

type Tab = "buy" | "read" | "plans" | "saved";
const DN = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
const total = (a: { sum: number }[]) => a.reduce((s, x) => s + x.sum, 0);

export default function Lists() {
  const { rec } = useApp();
  const [tab, setTab] = useState<Tab>("buy");
  const T: [Tab, string][] = [["buy", "Покупки"], ["read", "Книги и фильмы"], ["plans", "Планы и отдых"], ["saved", "Сохранённое · " + rec.saved.length]];
  return (
    <>
      <div className="head"><div><h1>Списки</h1><div className="sub">Покупки, книги и фильмы, планы и отдых, сохранённые ссылки</div></div></div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {T.map(([k, n]) => <button key={k} className={tab === k ? "on" : ""} style={{ fontSize: 14, padding: "6px 16px" }} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      {tab === "buy" && <Buy />}
      {tab === "read" && (
        <div className="grid g2">
          <section className="panel"><h2>Книги</h2><ListBox list="books" /></section>
          <section className="panel"><h2>Фильмы</h2><ListBox list="films" /></section>
        </div>
      )}
      {tab === "plans" && <Plans />}
      {tab === "saved" && <SavedLinks />}
    </>
  );
}

function ListBox({ list }: { list: ListItem["list"] }) {
  const { rec, addRec, patchRec, removeRec } = useApp();
  const [text, setText] = useState("");
  const items = rec.list_items.filter((x) => x.list === list).sort((a, b) => Number(a.done) - Number(b.done));
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && (await addRec("list_items", [{ list, text: text.trim() }])).length) setText("");
  }
  return (
    <>
      <form className="addbar" style={{ marginBottom: 6 }} onSubmit={add}>
        <input className="input" placeholder="Добавить" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" aria-label="Добавить">+</button>
      </form>
      {items.length ? items.map((x) => (
        <div key={x.id} className={"chk-row" + (x.done ? " done" : "")}>
          <button className={"chk" + (x.done ? " on" : "")} aria-label="Отметить" onClick={() => patchRec("list_items", x.id, { done: !x.done })} />
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{x.text}</span>
          <button className="mini" aria-label="Удалить" onClick={() => removeRec("list_items", x.id)}>✕</button>
        </div>
      )) : <Empty>Пусто</Empty>}
    </>
  );
}

function Buy() {
  const { rec, settings, today, addRec, removeRec, toast } = useApp();
  const [paste, setPaste] = useState("");
  const [boSum, setBoSum] = useState("");
  const [boCur, setBoCur] = useState<Cur>("uzs");
  const [pName, setPName] = useState("");
  const [pSum, setPSum] = useState("");
  const [pCur, setPCur] = useState<Cur>("uzs");
  const [dict, setDict] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [range, setRange] = useState<"week" | "month">("week");

  const buy = rec.list_items.filter((x) => x.list === "buy");
  const got = buy.filter((x) => x.done);
  const week = weekDays(today);
  const W = rec.purchases.filter((p) => p.date >= week[0] && p.date <= week[6]);
  const M = rec.purchases.filter((p) => p.date.slice(0, 7) === today.slice(0, 7));
  const prefs = settings.dish_prefs;

  async function addLines() {
    const lines = paste.split("\n").map((l) => l.replace(/^\s*(?:[-•*–—]|\d+[.)](?=\s))\s*/, "").trim()).filter((l) => l && !/:$/.test(l));
    if (!lines.length) return toast("Вставь список, по продукту на строку");
    const have = new Set(buy.filter((x) => !x.done).map((x) => x.text.toLowerCase()));
    const fresh = lines.filter((l) => !have.has(l.toLowerCase())).slice(0, 100);
    if ((await addRec("list_items", fresh.map((text) => ({ list: "buy", text: text.slice(0, 300) })))).length) { setPaste(""); toast("Добавлено в список: " + fresh.length); }
  }
  async function bought(e: React.FormEvent) {
    e.preventDefault();
    if (num(boSum) <= 0) return toast("Впиши, сколько потратил");
    const m = toUZS(num(boSum), boCur, settings.rates);
    if ((await addRec("purchases", [{ date: today, name: "Покупки по списку", items: got.map((x) => x.text.slice(0, 200)), ...m }])).length) {
      for (const x of got) await removeRec("list_items", x.id);
      setBoSum(""); toast("Записал в покупки недели");
    }
  }
  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || num(pSum) <= 0) return toast("Напиши, что купил, и сумму");
    if ((await addRec("purchases", [{ date: today, name: pName.trim(), ...toUZS(num(pSum), pCur, settings.rates) }])).length) { setPName(""); setPSum(""); }
  }
  async function addDict() {
    const items = parsePurchases(dict, settings.rates);
    if (!items.length) return toast("Не нашёл сумм: «такси 45 тысяч, кофе 3 доллара»");
    if ((await addRec("purchases", items.map((x) => ({ date: today, ...x })))).length) { setDict(""); toast("Записано покупок: " + items.length); }
  }

  // «Что покупал»: how often each thing shows up, from list purchases (items) and single ones (name).
  const counts = new Map<string, { name: string; n: number }>();
  for (const p of range === "week" ? W : M) for (const raw of p.items.length ? p.items : [p.name]) {
    const k = raw.toLowerCase().replace(/\s+\d.*$/, "").trim();
    const c = counts.get(k) ?? { name: raw.replace(/\s+\d.*$/, "").trim(), n: 0 };
    c.n++; counts.set(k, c);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...top.map((x) => x.n));

  return (
    <>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <h2>Нужно купить <span className="sub" style={{ marginLeft: "auto", fontWeight: 500 }}>{buy.length - got.length}</span></h2>
          <div className="addbar">
            <ClaudeBtn label="Список продуктов в Claude ↗" prompt={() => shopPrompt(Object.keys(prefs).filter((k) => prefs[k] > 0), settings.menu?.items.map((x) => x.name) ?? [], buy.filter((x) => !x.done).map((x) => x.text))} hint="Вставь список от Claude в поле ниже" onAnswer={setPaste} />
          </div>
          <ListBox list="buy" />
          <div className="addbar" style={{ marginTop: 8 }}>
            <textarea className="input" rows={1} style={{ minHeight: 40 }} placeholder="Вставь список от Claude, по продукту на строку" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn" onClick={addLines}>В список</button>
          </div>
          {got.length > 0 ? (
            <form className="buyout" onSubmit={bought}>
              <div className="sub" style={{ fontSize: 13 }}>Купил: {got.map((x) => x.text).join(", ")}</div>
              <div className="addbar" style={{ margin: "8px 0 0" }}>
                <input className="input" inputMode="decimal" placeholder="Сколько потратил всего" value={boSum} onChange={(e) => setBoSum(e.target.value)} />
                <CurSelect value={boCur} onChange={setBoCur} />
                <button className="btn pri">Купил</button>
              </div>
            </form>
          ) : <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Отмечай, что купил, потом впиши общую сумму. Она уйдёт в покупки недели</div>}
        </section>
        <section className="panel">
          <h2>Покупки на этой неделе <span className="amt" style={{ marginLeft: "auto" }}>{rub(total(W))}</span></h2>
          <div className="pweek">
            {week.map((ds, i) => {
              const ps = rec.purchases.filter((p) => p.date === ds);
              return (
                <div key={ds}>
                  <button className={"pday" + (openDay === ds ? " on" : "")} disabled={!ps.length} style={ds > today ? { opacity: 0.45 } : undefined} onClick={() => setOpenDay(openDay === ds ? null : ds)}>
                    <span className="dn">{DN[i]}</span><span className="dd">{fd(ds, today)}</span><span className="amt">{ps.length ? rub(total(ps)) : "—"}</span><span className="cv">{ps.length ? (openDay === ds ? "▴" : "▾") : ""}</span>
                  </button>
                  {openDay === ds && <div className="pday-in">{ps.map((p) => <PurchaseRow key={p.id} p={p} onDelete={() => removeRec("purchases", p.id)} />)}</div>}
                </div>
              );
            })}
          </div>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Нажми на день, чтобы увидеть, что купил</div>
        </section>
      </div>

      <section className="capture" style={{ marginBottom: 16 }}>
        <form className="addbar" style={{ margin: 0 }} onSubmit={addOne}>
          <input className="input" placeholder="Купил без списка, например «Такси»" value={pName} onChange={(e) => setPName(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Сумма" value={pSum} onChange={(e) => setPSum(e.target.value)} style={{ flex: "0 1 120px" }} />
          <CurSelect value={pCur} onChange={setPCur} />
          <button className="btn pri">Записать</button>
        </form>
        <div className="addbar" style={{ margin: 0 }}>
          <input className="input" placeholder="Или списком: «продукты 320 тысяч, такси 45 тысяч, кофе 3 доллара»" value={dict} onChange={(e) => setDict(e.target.value)} />
          <button className="btn" type="button" onClick={addDict}>Разобрать</button>
        </div>
      </section>

      <div className="kpis">
        <div className="kpi"><div className="l">Потратил на этой неделе</div><div className="v">{rub(total(W))}</div><div className="n">{W.length} покупок</div></div>
        <div className="kpi"><div className="l">За {MONN[monthOf(today)].toLowerCase()}</div><div className="v">{rub(total(M))}</div><div className="n">{M.length} покупок</div></div>
      </div>
      <section className="panel">
        <h2>Что покупал
          <span className="tabs" style={{ margin: "0 0 0 auto" }}>
            <button className={range === "week" ? "on" : ""} onClick={() => setRange("week")}>Неделя</button>
            <button className={range === "month" ? "on" : ""} onClick={() => setRange("month")}>Месяц</button>
          </span>
        </h2>
        {top.length ? (
          <>
            <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Топ-5 чаще всего</div>
            {top.slice(0, 5).map((x, i) => (
              <div key={x.name} style={{ margin: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><span><b className="amt" style={{ color: "var(--muted)", marginRight: 6 }}>{i + 1}</b>{x.name}</span><span className="amt">{x.n} раз</span></div>
                <div className="bar" style={{ marginTop: 4 }}><i style={{ width: (x.n / max) * 100 + "%", background: "var(--accent)" }} /></div>
              </div>
            ))}
            {top.length > 5 && <div className="sub" style={{ fontSize: 12, marginTop: 12 }}>Всё остальное: {top.slice(5).map((x) => `${x.name} (${x.n})`).join(", ")}</div>}
          </>
        ) : <Empty>Пока нет покупок</Empty>}
      </section>
    </>
  );
}

function PurchaseRow({ p, onDelete }: { p: Purchase; onDelete: () => void }) {
  return (
    <div className="row">
      <div className="t"><b>{p.name}</b>{p.items.length > 0 && <span className="ln">{p.items.join(", ")}</span>}{p.orig && <span className="ln">{p.orig}</span>}</div>
      <span className="amt">{rub(p.sum)}</span>
      <button className="mini" aria-label="Удалить" onClick={onDelete}>✕</button>
    </div>
  );
}

function Plans() {
  const { rec, today, addRec, removeRec, toast } = useApp();
  const [f, setF] = useState({ title: "", city: "", date: "", date2: "", note: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return toast("Напиши, что за план, и дату");
    if ((await addRec("trips", [{ ...f, title: f.title.trim(), date2: f.date2 || null }])).length) setF({ title: "", city: "", date: "", date2: "", note: "" });
  }
  return (
    <section className="panel">
      <h2>Планы и отдых</h2>
      <form className="addbar" onSubmit={add}>
        <input className="input" placeholder="Что: поездка, концерт, отель, отдых" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="input" placeholder="Где" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={{ flex: "0 1 140px" }} />
        <label className="lbl" style={{ flex: "0 1 150px" }}>С<input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="lbl" style={{ flex: "0 1 150px" }}>По<input className="input" type="date" value={f.date2} onChange={(e) => setF({ ...f, date2: e.target.value })} /></label>
        <input className="input" placeholder="Заметка: бронь, отель, билеты" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button className="btn pri">Добавить</button>
      </form>
      <div className="list">
        {rec.trips.length ? [...rec.trips].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
          const dd = diffDays(t.date, today);
          return (
            <div className="row" key={t.id}>
              <div className="t"><b>{t.title}</b><span>{t.city ? t.city + " · " : ""}{fd(t.date, today)}{t.date2 ? " — " + fd(t.date2, today) : ""}{t.note ? " · " + t.note : ""}</span></div>
              <span className={"pill " + (dd < 0 ? "p-mute" : dd <= 7 ? "p-warn" : "p-info")}>{dd < 0 ? "прошло" : dd === 0 ? "сегодня" : `через ${dd} дн`}</span>
              <button className="mini" aria-label="Удалить" onClick={() => removeRec("trips", t.id)}>✕</button>
            </div>
          );
        }) : <Empty>Пока нет планов</Empty>}
      </div>
    </section>
  );
}

function SavedLinks() {
  const { rec, today, addRec, removeRec, toast } = useApp();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!u) return toast("Вставь ссылку");
    let title = u;
    try { const x = new URL(u); title = x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? x.pathname.slice(0, 60) : ""); } catch { /* not a URL: keep as typed */ }
    if ((await addRec("saved", [{ url: u.slice(0, 2000), title: title.slice(0, 300), note: note.trim() }])).length) { setUrl(""); setNote(""); }
  }
  const safe = (u: string) => /^https?:\/\//i.test(u);
  return (
    <>
      <section className="capture" style={{ marginBottom: 16 }}>
        <form className="addbar" style={{ margin: 0 }} onSubmit={add}>
          <input className="input" placeholder="Ссылка: статья, видео, пост" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input" placeholder="Зачем сохранил" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn pri">Сохранить</button>
        </form>
        <span className="sub" style={{ fontSize: 12 }}>PDF и файлы с выжимкой от Claude добавим, когда подключим ключ</span>
      </section>
      <section className="panel">
        <h2>Сохранённое</h2>
        {rec.saved.length ? [...rec.saved].reverse().map((x) => (
          <div className="item" key={x.id}>
            <div className="kind">Ссылка</div>
            <div className="body">
              <b>{x.title}</b>
              {x.url && (safe(x.url) ? <div><a href={x.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--info)", fontSize: 13, overflowWrap: "anywhere" }}>{x.url}</a></div> : <div className="sub">{x.url}</div>)}
              {x.note && <div className="sub">{x.note}</div>}
              <div className="sub" style={{ fontSize: 12, marginTop: 4 }}>{fd(x.created_at.slice(0, 10), today)} <button className="mini" onClick={() => removeRec("saved", x.id)}>удалить</button></div>
            </div>
          </div>
        )) : <Empty>Пока пусто</Empty>}
      </section>
    </>
  );
}
