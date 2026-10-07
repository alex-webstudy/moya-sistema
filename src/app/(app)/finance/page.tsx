"use client";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { useApp } from "@/components/store";
import { ClaudeBtn, CurSelect, Empty, Fold } from "@/components/ui";
import { fd, MONN } from "@/lib/dates";
import { chargeNext, dueThisMonth, monthKey, nextTaxDate, paymentsLeft, prevCharge, rub, toUZS, type Cur } from "@/lib/money";
import { FIN_PROMPT, TAX_PROMPT } from "@/lib/prompts";
import type { Charge, Debt } from "@/lib/records";

type Folder = "ai" | "inc" | "tax" | "credit" | "sub" | "debt";
const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
const monthName = (ym: string) => MONN[+ym.slice(5) - 1] + " " + ym.slice(0, 4);
const total = (a: { sum: number }[]) => a.reduce((s, x) => s + x.sum, 0);
const debtLeft = (d: Debt) => Math.max(0, d.total - total(d.payments));

export default function Finance() {
  const { rec, today } = useApp();
  const [open, setOpen] = useState<Folder | null>(null);
  const mk = monthKey(today);
  const incMonth = rec.income.filter((i) => i.date.startsWith(mk));
  // Finished instalments drop out of the totals; they stay listed as closed.
  const all = rec.charges.map((c) => ({ ...c, next: chargeNext(c, today), left: paymentsLeft(c, today), due: dueThisMonth(c, today) }));
  const ch = all.filter((c): c is typeof c & { next: string } => c.next !== null);
  const cr = ch.filter((c) => c.type === "credit").sort((a, b) => a.next.localeCompare(b.next));
  const sb = ch.filter((c) => c.type === "sub").sort((a, b) => a.next.localeCompare(b.next));
  const closed = all.filter((c) => c.next === null);
  // This month: only payments not yet confirmed.
  const dueNow = ch.filter((c) => c.due);
  const debts = rec.debts.filter((d) => debtLeft(d) > 0);
  const debtSum = debts.reduce((s, d) => s + debtLeft(d), 0);
  const upcoming = [...ch].sort((a, b) => a.next.localeCompare(b.next))[0];
  const lastTax = [...rec.taxes].sort((a, b) => b.month.localeCompare(a.month))[0];
  const month = MONN[+mk.slice(5) - 1].toLowerCase();
  const monthIn = MONTH_IN[+mk.slice(5) - 1];

  const F: [Folder, string, string][] = [
    ["ai", "Финансовый разбор", "Claude смотрит цифры и предлагает шаги"],
    ["inc", "Поступления на р/с", `${rub(total(incMonth))} в этом месяце · ${rec.income.length} записей`],
    ["tax", "Налоги и взносы ИП", `следующий срок ${fd(nextTaxDate(today), today)}`],
    ["credit", "Кредиты", `осталось в ${monthIn} ${rub(total(cr.filter((c) => c.due)))} · ${cr.length}`],
    ["sub", "Подписки", `осталось в ${monthIn} ${rub(total(sb.filter((c) => c.due)))} · ${sb.length}`],
    // The debts folder is shown only while something is still owed.
    ...(debts.length ? [["debt", "Долги", `осталось ${rub(debtSum)} · ${debts.length}`] as [Folder, string, string]] : []),
  ];

  return (
    <>
      <div className="head"><div><h1>Финансы</h1><div className="sub">Всё в сумах. Сумму в $ или ₽ можно вводить как есть, переведу по курсу из настроек</div></div></div>
      <div className="kpis">
        <div className="kpi"><div className="l">Пришло на р/с, {month}</div><div className="v" style={{ color: "var(--ok)" }}>{rub(total(incMonth))}</div><div className="n">{incMonth.length} поступлений</div></div>
        <div className="kpi"><div className="l">Осталось оплатить в {monthIn}</div><div className="v">{rub(total(dueNow))}</div><div className="n">{dueNow.length ? `${dueNow.length} платеж${dueNow.length === 1 ? "" : dueNow.length < 5 ? "а" : "ей"} · из ${rub(total(all.filter((c) => c.due || c.paid_to?.startsWith(mk))))} за месяц` : "всё оплачено"}</div></div>
        <div className="kpi"><div className="l">Следующее списание</div><div className="v" style={{ fontSize: 18 }}>{upcoming ? fd(upcoming.next, today) : "—"}</div><div className="n">{upcoming ? `${upcoming.name} · ${rub(upcoming.sum)}` : "нет списаний"}</div></div>
        <div className="kpi"><div className="l">Налог{lastTax ? " за " + monthName(lastTax.month).toLowerCase() : ""}</div><div className="v">{lastTax ? rub(lastTax.tax) : "—"}</div><div className="n">по отчёту</div></div>
      </div>

      {open ? (
        <>
          <div className="crumbs fpath" style={{ marginBottom: 12 }}>
            <button className="mini" onClick={() => setOpen(null)}>Финансы</button><span>›</span><b>{F.find((f) => f[0] === open)?.[1] ?? "Долги"}</b>
          </div>
          {open === "ai" && <Review />}
          {open === "inc" && <IncomePanel />}
          {open === "tax" && <TaxPanel />}
          {(open === "credit" || open === "sub") && <Charges type={open} list={open === "credit" ? cr : sb} closed={closed.filter((c) => c.type === open)} monthIn={monthIn} />}
          {open === "debt" && <Debts />}
        </>
      ) : (
        <div className="fgrid">
          {F.map(([id, n, sub]) => (
            <button key={id} className="fcard" style={id === "ai" ? { borderColor: "var(--accent)" } : undefined} onClick={() => setOpen(id)}>
              {Icons.proj}<b>{n}</b><span>{sub}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Review() {
  const { rec, today } = useApp();
  function data() {
    const byMonth: Record<string, number> = {};
    rec.income.forEach((i) => (byMonth[i.date.slice(0, 7)] = (byMonth[i.date.slice(0, 7)] ?? 0) + i.sum));
    return FIN_PROMPT + JSON.stringify({
      сегодня: today,
      приход_по_месяцам: byMonth,
      поступления: rec.income.slice(-40).map((i) => ({ дата: i.date, от: i.source, за: i.note, сумма: i.sum })),
      кредиты_и_подписки: rec.charges.map((c) => ({ тип: c.type === "credit" ? "кредит" : "подписка", название: c.name, сумма_в_месяц: c.sum, число: c.day, последний_платёж: c.until })),
      долги: rec.debts.map((d) => ({ долг: d.name, всего: d.total, осталось: debtLeft(d) })),
      налоги: rec.taxes.map((t) => ({ месяц: t.month, налог: t.tax })),
      клиенты: rec.clients.map((c) => ({ клиент: c.name, работа: c.work, сумма: c.sum, оплачено: c.paid })),
    }, null, 1);
  }
  return (
    <section className="panel" style={{ borderColor: "var(--accent)" }}>
      <h2>Финансовый разбор месяца</h2>
      <div className="sub" style={{ marginBottom: 12 }}>Раз в месяц, 1-го числа: Claude смотрит поступления, кредиты, подписки, налоги и клиентов и предлагает 3–5 шагов, как поднять доход на 10–20% или срезать расходы. Данные уже вложены в запрос</div>
      <ClaudeBtn pri label="Сделать разбор в Claude ↗" prompt={data} hint="Данные и запрос открыты в Claude" />
    </section>
  );
}

function IncomePanel() {
  const { rec, settings, today, addRec, removeRec, toast } = useApp();
  const [from, setFrom] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [sum, setSum] = useState("");
  const [cur, setCur] = useState<Cur>("uzs");
  const [date, setDate] = useState(today);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const client = rec.clients.find((c) => c.id === from);
    const source = client?.name ?? other.trim();
    if (!source) return toast("Укажи, от кого пришло");
    if (num(sum) <= 0) return toast("Укажи сумму");
    const m = toUZS(num(sum), cur, settings.rates);
    if ((await addRec("income", [{ date, source, note: note.trim(), ...m, client_id: client?.id ?? null }])).length) {
      setSum(""); setNote(""); setOther("");
      toast("Поступление записано");
    }
  }
  return (
    <section className="panel">
      <h2>Поступления на расчётный счёт</h2>
      <form className="addbar" onSubmit={add}>
        <select className="input" style={{ flex: "1 1 160px" }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="От кого">
          <option value="">Другое…</option>
          {rec.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!from && <input className="input" placeholder="От кого" value={other} onChange={(e) => setOther(e.target.value)} style={{ flex: "1 1 140px" }} />}
        <input className="input" placeholder="За что" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 120px" }} />
        <input className="input" inputMode="decimal" placeholder="Сумма" value={sum} onChange={(e) => setSum(e.target.value)} style={{ flex: "0 1 120px" }} />
        <CurSelect value={cur} onChange={setCur} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: "0 1 150px" }} />
        <button className="btn pri">Добавить</button>
      </form>
      <div className="list">
        {rec.income.length ? [...rec.income].sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
          <div className="row" key={i.id}>
            <div className="t"><b>{i.source}</b><span>{i.note ? i.note + " · " : ""}{fd(i.date, today)}{i.orig ? " · " + i.orig : ""}</span></div>
            <span className="amt" style={{ color: "var(--ok)" }}>+{rub(i.sum)}</span>
            <button className="mini" aria-label="Удалить" onClick={() => removeRec("income", i.id)}>✕</button>
          </div>
        )) : <Empty>Пока нет поступлений</Empty>}
      </div>
      <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Оплата, отмеченная в «Клиентах», попадает сюда сама</div>
    </section>
  );
}

function TaxPanel() {
  const { rec, today, addRec, removeRec, toast } = useApp();
  const [line, setLine] = useState("");
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  });
  const [tax, setTax] = useState("");
  const [note, setNote] = useState("");

  function readLine(s: string) {
    setLine(s);
    // Claude answers «ГГГГ-ММ | сумма | пометка».
    const p = s.split("|").map((x) => x.trim());
    if (/^\d{4}-\d{2}$/.test(p[0] ?? "")) setMonth(p[0]);
    if (p[1]) setTax(p[1].replace(/[^\d]/g, ""));
    if (p[2]) setNote(p[2]);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return toast("Месяц в виде 2026-09");
    if ((await addRec("taxes", [{ month, tax: Math.round(num(tax)), note: note.trim() }])).length) { setTax(""); setNote(""); setLine(""); toast("Налог записан"); }
  }
  return (
    <section className="panel">
      <h2>Налоги и взносы ИП</h2>
      <div className="row" style={{ borderTop: 0, paddingTop: 0 }}>
        <span className="pill p-warn">{fd(nextTaxDate(today), today)}</span>
        <div className="t"><b>Отчёт, минимальная зарплата (банк) и пенсионный фонд</b><span>Каждое 10-е число. Налог 1% с поступлений на р/с</span></div>
      </div>
      <div className="addbar" style={{ margin: "10px 0" }}>
        <ClaudeBtn label="Прочитать скриншот в Claude ↗" prompt={() => TAX_PROMPT} hint="Прикрепи скриншот отчёта в Claude, ответ вставь сюда" />
        <input className="input" placeholder="Ответ Claude: 2026-09 | 120000 | пометка" value={line} onChange={(e) => readLine(e.target.value)} />
      </div>
      <form className="addbar" onSubmit={add}>
        <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: "0 1 160px" }} aria-label="Месяц" />
        <input className="input" inputMode="numeric" placeholder="Налог, сум" value={tax} onChange={(e) => setTax(e.target.value)} style={{ flex: "0 1 140px" }} required />
        <input className="input" placeholder="Пометка" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn pri">Записать</button>
      </form>
      <div className="list">
        {rec.taxes.length ? [...rec.taxes].sort((a, b) => b.month.localeCompare(a.month)).map((t) => (
          <div className="row" key={t.id}>
            <div className="t"><b>{monthName(t.month)}</b><span>{t.note}</span></div>
            <span className="amt">{rub(t.tax)}</span>
            <button className="mini" aria-label="Удалить" onClick={() => removeRec("taxes", t.id)}>✕</button>
          </div>
        )) : <Empty>Пока нет отчётов</Empty>}
      </div>
    </section>
  );
}

type Row = Charge & { next: string | null; left: number | null; due: string | null };
const dmy = (s: string) => s.split("-").reverse().join(".");
const MONTH_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

function Charges({ type, list, closed, monthIn }: { type: "credit" | "sub"; list: Row[]; closed: Row[]; monthIn: string }) {
  const { settings, today, addRec, patchRec, removeRec, toast } = useApp();
  const credit = type === "credit";
  const [name, setName] = useState("");
  const [sum, setSum] = useState("");
  const [cur, setCur] = useState<Cur>("uzs");
  const [day, setDay] = useState("");
  const [bank, setBank] = useState("");
  const [until, setUntil] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const d = Math.round(num(day));
    if (!name.trim() || num(sum) <= 0 || d < 1 || d > 31) return toast("Заполни название, сумму и число от 1 до 31");
    if ((await addRec("charges", [{ type, name: name.trim(), sum: toUZS(num(sum), cur, settings.rates).sum, day: d, bank: bank.trim(), until: until || null }])).length) {
      setName(""); setSum(""); setDay(""); setBank(""); setUntil("");
    }
  }
  return (
    <section className="panel">
      <h2>{credit ? "Кредиты" : "Подписки"} <span className="amt" style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 500 }}>осталось в {monthIn} {rub(total(list.filter((c) => c.due)))}</span></h2>
      <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Нажми «Оплачено», когда списание прошло: сумма уйдёт из остатка этого месяца</div>
      <div className="list">
        {list.length ? list.map((c) => (
          <div className="row" key={c.id}>
            <span className="amt" style={{ width: 56, flex: "none", color: "var(--muted)" }}>{c.day} чис.</span>
            <div className="t"><b>{c.name}</b><span>{c.bank ? c.bank + " · " : ""}{c.due
              ? (c.due < today ? <b style={{ color: "var(--warn)" }}>{fd(c.due, today)}, не отмечено</b> : fd(c.due, today))
              : <><span style={{ color: "var(--ok)" }}>✓ оплачено</span>{" · следующее " + (c.start && c.start > today ? dmy(c.next!) : fd(c.next!, today))}</>}
              {c.until ? ` · до ${dmy(c.until)}, осталось ${c.left}` : ""}</span></div>
            <span className="amt" style={c.due ? undefined : { color: "var(--muted)", textDecoration: "line-through" }}>{rub(c.sum)}</span>
            {c.due
              ? <button className="btn" onClick={() => patchRec("charges", c.id, { paid_to: c.due })}>Оплачено</button>
              : c.paid_to && <button className="mini" title="Отменить отметку" aria-label="Отменить отметку" onClick={() => patchRec("charges", c.id, { paid_to: prevCharge(c, c.paid_to!) })}>↶</button>}
            <button className="mini" aria-label="Удалить" onClick={() => confirm(`Удалить «${c.name}»?`) && removeRec("charges", c.id)}>✕</button>
          </div>
        )) : <Empty>Пока пусто</Empty>}
      </div>
      {closed.length > 0 && (
        <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>
          Закрыты: {closed.map((c, i) => <span key={c.id}>{i ? ", " : ""}{c.name} ({dmy(c.until!)}){c.paid_to && <> <button className="mini" title="Отменить последнюю отметку" aria-label="Отменить отметку" onClick={() => patchRec("charges", c.id, { paid_to: prevCharge(c, c.paid_to!) })}>↶</button></>} <button className="mini" aria-label="Удалить" onClick={() => removeRec("charges", c.id)}>✕</button></span>)}
        </div>
      )}
      <form className="addbar" onSubmit={add} style={{ margin: "12px 0 0" }}>
        <input className="input" placeholder={credit ? "Например «Автокредит»" : "Например «Claude Pro»"} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" inputMode="decimal" placeholder="В месяц" value={sum} onChange={(e) => setSum(e.target.value)} style={{ flex: "0 1 110px" }} />
        <CurSelect value={cur} onChange={setCur} />
        <input className="input" inputMode="numeric" placeholder="Число" value={day} onChange={(e) => setDay(e.target.value)} style={{ flex: "0 1 80px" }} />
        {credit && <input className="input" placeholder="Банк" value={bank} onChange={(e) => setBank(e.target.value)} style={{ flex: "1 1 120px" }} />}
        {credit && <label className="lbl" style={{ flex: "0 1 150px" }}>Последний платёж<input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
        <button className="btn pri">Добавить</button>
      </form>
      {credit && <div style={{ marginTop: 12 }}><Fold title="Добавить долг" sub="считается отдельно, в папке «Долги»"><DebtAdd /></Fold></div>}
    </section>
  );
}

function Debts() {
  const { rec, settings, today, patchRec, removeRec, toast } = useApp();
  const [pay, setPay] = useState<Record<string, string>>({});
  const [cur, setCur] = useState<Cur>("uzs");
  const open = rec.debts.filter((d) => debtLeft(d) > 0);
  const done = rec.debts.filter((d) => debtLeft(d) === 0);

  async function addPay(d: Debt) {
    const amt = toUZS(num(pay[d.id] ?? ""), cur, settings.rates).sum;
    if (amt <= 0) return toast("Впиши, сколько внёс");
    await patchRec("debts", d.id, { payments: [...d.payments, { date: today, sum: amt }] });
    setPay({ ...pay, [d.id]: "" });
    toast(amt >= debtLeft(d) ? "Долг закрыт" : `Осталось ${rub(debtLeft(d) - amt)}`);
  }
  return (
    <>
      <section className="panel">
        <h2>Долги <span className="amt" style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 500 }}>осталось {rub(open.reduce((s, d) => s + debtLeft(d), 0))}</span></h2>
        <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Считаются отдельно от платежей месяца. Впиши, сколько внёс, и остаток пересчитается. Когда долгов не останется, эта папка пропадёт</div>
        <div className="list">
          {open.length ? open.map((d) => {
            const paid = total(d.payments);
            return (
              <div key={d.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <div className="row" style={{ borderTop: 0, padding: 0 }}>
                  <div className="t"><b>{d.name}</b><span>{d.note ? d.note + " · " : ""}внесено {rub(paid)} из {rub(d.total)}</span></div>
                  <span className="amt">{rub(debtLeft(d))}</span>
                  <button className="mini" aria-label="Удалить" onClick={() => confirm(`Удалить «${d.name}»?`) && removeRec("debts", d.id)}>✕</button>
                </div>
                <div className="progress" style={{ margin: "8px 0" }}><i style={{ width: `${Math.min(100, (paid / d.total) * 100)}%`, background: "var(--ok)" }} /></div>
                <form className="addbar" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); addPay(d); }}>
                  <input className="input" inputMode="decimal" placeholder="Сколько внёс" value={pay[d.id] ?? ""} onChange={(e) => setPay({ ...pay, [d.id]: e.target.value })} style={{ flex: "1 1 140px" }} />
                  <CurSelect value={cur} onChange={setCur} />
                  <button className="btn pri">Записать</button>
                </form>
                {d.payments.length > 0 && (
                  <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>
                    {d.payments.map((p, i) => <span key={i}>{i ? ", " : ""}{dmy(p.date)}: {rub(p.sum)} <button className="mini" aria-label="Убрать взнос" onClick={() => patchRec("debts", d.id, { payments: d.payments.filter((_, j) => j !== i) })}>✕</button></span>)}
                  </div>
                )}
              </div>
            );
          }) : <Empty>Долгов нет</Empty>}
        </div>
        {done.length > 0 && (
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>
            Погашены: {done.map((d, i) => <span key={d.id}>{i ? ", " : ""}{d.name} <button className="mini" aria-label="Удалить" onClick={() => removeRec("debts", d.id)}>✕</button></span>)}
          </div>
        )}
      </section>
      <Fold title="Добавить долг"><DebtAdd /></Fold>
    </>
  );
}

function DebtAdd() {
  const { settings, addRec, toast } = useApp();
  const [name, setName] = useState("");
  const [sum, setSum] = useState("");
  const [cur, setCur] = useState<Cur>("uzs");
  const [note, setNote] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = toUZS(num(sum), cur, settings.rates).sum;
    if (!name.trim() || t <= 0) return toast("Заполни название и сумму долга");
    if ((await addRec("debts", [{ name: name.trim(), total: t, note: note.trim() }])).length) { setName(""); setSum(""); setNote(""); toast("Долг записан, он в папке «Долги»"); }
  }
  return (
    <form className="addbar" onSubmit={add}>
      <input className="input" placeholder="Например «Долг за квартиру»" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" inputMode="decimal" placeholder="Сумма долга" value={sum} onChange={(e) => setSum(e.target.value)} style={{ flex: "0 1 130px" }} />
      <CurSelect value={cur} onChange={setCur} />
      <input className="input" placeholder="Пометка" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 120px" }} />
      <button className="btn pri">Добавить</button>
    </form>
  );
}
