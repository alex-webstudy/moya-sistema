"use client";
import { useState } from "react";
import { Files, Upload } from "@/components/files";
import { useApp } from "@/components/store";
import { ClaudeBtn, copy, CurSelect, Empty, Fold } from "@/components/ui";
import { activeNow, invoiceState, isMonthly, ledger, needsInvoice, nextNo, paidOn, payDate } from "@/lib/accounting";
import { diffDays, fd, MON, MONN } from "@/lib/dates";
import { rub, toUZS, type Cur } from "@/lib/money";
import { followPrompt } from "@/lib/prompts";
import type { Client, Invoice } from "@/lib/records";

const FOLLOW_DAYS = 5;
const CST = ["Не отправлен", "Отправлен", "Подписан"];
const CSTc = ["p-bad", "p-warn", "p-ok"];
const IST = { paid: ["Оплачен", "p-ok"], part: ["Частично", "p-warn"], wait: ["Ждём оплату", "p-mute"] } as const;
const dmy = (s: string) => s.split("-").reverse().join(".");
const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
const monthIn = (d: string) => MONN[+d.slice(5, 7) - 1].toLowerCase();

type Draft = { name: string; work: string; contract: number; contract_no: string; contract_from: string; contract_until: string; sum: string; cur: Cur; monthly: boolean; pay_day: string; due: string; waiting: string };
const blank: Draft = { name: "", work: "", contract: 0, contract_no: "", contract_from: "", contract_until: "", sum: "", cur: "uzs", monthly: true, pay_day: "", due: "", waiting: "" };
const toDraft = (c: Client): Draft => ({
  name: c.name, work: c.work, contract: c.contract, contract_no: c.contract_no, contract_from: c.contract_from ?? "", contract_until: c.contract_until ?? "",
  sum: c.sum ? String(c.sum) : "", cur: "uzs", monthly: c.pay_day !== null, pay_day: c.pay_day ? String(c.pay_day) : "", due: c.due ?? "", waiting: c.waiting,
});

export default function Clients() {
  const { rec } = useApp();
  // Other sections link to a client card with ?c=<id>. Pages render only on the client, after state loads.
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get("c"));
  const c = rec.clients.find((x) => x.id === openId);
  return c ? <Card c={c} onBack={() => setOpenId(null)} /> : <List onOpen={setOpenId} />;
}

/** One-off clients count as owed until marked paid; monthly ones by their unpaid invoices. */
function owedBy(c: Client, invoices: Invoice[], income: ReturnType<typeof useApp>["rec"]["income"], today: string) {
  return isMonthly(c) || invoices.some((i) => i.client_id === c.id) ? ledger(c, invoices, income, today).owed : c.paid ? 0 : c.sum;
}

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { rec, today, patchRec } = useApp();
  const [adding, setAdding] = useState(false);
  const clients = rec.clients;
  const needFollow = (c: Client) => !c.paid && (!!c.waiting || diffDays(c.last_contact, today) <= -FOLLOW_DAYS);
  const follow = clients.filter(needFollow).sort((a, b) => a.last_contact.localeCompare(b.last_contact));
  const toInvoice = clients.filter((c) => needsInvoice(c, rec.invoices, today));
  const owed = clients.map((c) => ({ c, owed: owedBy(c, rec.invoices, rec.income, today) })).filter((x) => x.owed > 0);
  const lateInv = rec.invoices.filter((i) => invoiceState(i, rec.income) !== "paid" && diffDays(i.date, today) <= -14);
  const ending = clients.filter((c) => c.contract_until && c.contract_until >= today && diffDays(c.contract_until, today) <= 30);

  return (
    <>
      <div className="head">
        <div><h1>Клиенты и документы</h1><div className="sub">Договоры, счета-фактуры, оплаты и кому пора написать</div></div>
        <button className="btn pri" onClick={() => setAdding(true)}>+ Клиент</button>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Ждём оплату</div><div className="v">{rub(owed.reduce((s, x) => s + x.owed, 0))}</div><div className="n">{owed.length ? `от ${owed.length} клиент${owed.length === 1 ? "а" : "ов"}` : "все оплатили"}</div></div>
        <div className="kpi"><div className="l">Выставить счёт-фактуру</div><div className="v" style={{ color: toInvoice.length ? "var(--warn)" : undefined }}>{toInvoice.length}</div><div className="n">за {monthIn(today)}</div></div>
        <div className="kpi"><div className="l">Счета без оплаты 2+ недели</div><div className="v" style={{ color: lateInv.length ? "var(--bad)" : undefined }}>{lateInv.length}</div><div className="n">{rub(lateInv.reduce((s, i) => s + i.sum - paidOn(i, rec.income), 0))}</div></div>
        <div className="kpi"><div className="l">Пора написать</div><div className="v" style={{ color: follow.length ? "var(--warn)" : undefined }}>{follow.length}</div><div className="n">{ending.length ? `договор кончается у ${ending.length}` : `тишина ${FOLLOW_DAYS}+ дней`}</div></div>
      </div>

      {adding && <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}><h2>Новый клиент</h2><ClientForm onDone={(id) => { setAdding(false); if (id) onOpen(id); }} /></section>}

      {toInvoice.length > 0 && <InvoiceReminder list={toInvoice} onOpen={onOpen} />}

      {follow.length > 0 && (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--warn)" }}>
          <h2>Пора написать</h2>
          {follow.map((c) => {
            const ago = -diffDays(c.last_contact, today);
            return (
              <div className="row" key={c.id} style={{ flexWrap: "wrap" }}>
                <div className="t" style={{ flex: "1 1 220px" }}><b>{c.name}</b><span>{c.waiting ? "Жду: " + c.waiting + " · " : ""}последний контакт {fd(c.last_contact, today)}{ago > 1 ? ` (${ago} дн назад)` : ""}</span></div>
                <ClaudeBtn label="Сообщение в Claude ↗" prompt={() => followPrompt(c.name, c.work, c.waiting, ago)} hint="Claude напишет 2 варианта сообщения" />
                <button className="mini" onClick={() => patchRec("clients", c.id, { last_contact: today })}>написал</button>
              </div>
            );
          })}
        </section>
      )}

      <section className="panel" style={{ marginBottom: 16 }}>
        {clients.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Клиент</th><th>Договор</th><th>Действует до</th><th className="r">Сумма</th><th>Оплата</th><th className="r">Ждём</th><th>Контакт</th></tr></thead>
            <tbody>
              {clients.map((c) => {
                const o = owedBy(c, rec.invoices, rec.income, today);
                const left = c.contract_until ? diffDays(c.contract_until, today) : null;
                return (
                  <tr key={c.id}>
                    <td><button className="mini" style={{ color: "var(--fg)", fontWeight: 600, fontSize: 13, padding: 0, textAlign: "left" }} title="Открыть карточку клиента" onClick={() => onOpen(c.id)}>{c.name}</button><div className="sub" style={{ fontSize: 12, marginTop: 0 }}>{c.work}</div></td>
                    <td><button className={"pill " + CSTc[c.contract]} title="Нажми, чтобы сменить статус" onClick={() => patchRec("clients", c.id, { contract: (c.contract + 1) % 3 })}>{c.contract_no ? "№ " + c.contract_no : CST[c.contract]}</button></td>
                    <td>{c.contract_until ? <>{dmy(c.contract_until)}{left !== null && left < 0 ? <> <span className="pill p-mute">истёк</span></> : left !== null && left <= 30 ? <> <span className="pill p-warn">{left} дн</span></> : null}</> : "—"}</td>
                    <td className="r amt">{rub(c.sum)}{isMonthly(c) && <span className="sub" style={{ fontSize: 11 }}> /мес</span>}</td>
                    <td>{isMonthly(c) ? `${c.pay_day} числа` : c.due ? fd(c.due, today) : "—"}</td>
                    <td className="r amt" style={{ color: o ? "var(--warn)" : "var(--ok)" }}>{o ? rub(o) : "✓"}</td>
                    <td style={{ color: "var(--muted)" }}>{fd(c.last_contact, today)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : <Empty>Клиентов пока нет. Добавь первого кнопкой «+ Клиент»</Empty>}
        <div className="sub" style={{ fontSize: 12, marginTop: 10 }}>Имя открывает карточку клиента: договор, счета-фактуры, оплаты и файлы. Оплата, записанная в «Финансах», сразу закрывает счёт</div>
      </section>

      <Fold title="Договор по шаблону" sub="заполнить договор для клиента"><Contract /></Fold>
    </>
  );
}

/** Monthly clients without an invoice this month: issue one in a click, the file can be attached in the card. */
function InvoiceReminder({ list, onOpen }: { list: Client[]; onOpen: (id: string) => void }) {
  const { rec, today, addRec, toast } = useApp();
  async function issue(c: Client) {
    const no = nextNo(rec.invoices.filter((i) => i.client_id === c.id));
    if ((await addRec("invoices", [{ client_id: c.id, no, date: today, sum: c.sum || 1 }])).length) toast(`Счёт-фактура №${no} записана`);
  }
  return (
    <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
      <h2>Выставить счёт-фактуру за {monthIn(today)}</h2>
      {list.map((c) => (
        <div className="row" key={c.id} style={{ flexWrap: "wrap" }}>
          <div className="t" style={{ flex: "1 1 200px" }}><b>{c.name}</b><span>{c.contract_no ? `договор № ${c.contract_no} · ` : ""}оплата {fd(payDate(c, today)!, today)}</span></div>
          <span className="amt">{rub(c.sum)}</span>
          <button className="btn pri" disabled={!c.sum} onClick={() => issue(c)}>Выставил</button>
          <button className="mini" onClick={() => onOpen(c.id)}>карточка</button>
        </div>
      ))}
    </section>
  );
}

function ClientForm({ c, onDone }: { c?: Client; onDone: (id?: string) => void }) {
  const { rec, settings, today, addRec, patchRec, toast } = useApp();
  const [d, setD] = useState<Draft>(c ? toDraft(c) : blank);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const pd = Math.round(num(d.pay_day));
    if (d.monthly && (pd < 1 || pd > 31)) return toast("Число оплаты от 1 до 31");
    const row = {
      name: d.name.trim(), work: d.work.trim(), contract: d.contract, contract_no: d.contract_no.trim(),
      contract_from: d.contract_from || null, contract_until: d.contract_until || null,
      sum: toUZS(num(d.sum), d.cur, settings.rates).sum, pay_day: d.monthly ? pd : null, due: d.monthly ? null : d.due || null, waiting: d.waiting.trim(),
    };
    if (!row.name) return toast("Напиши имя клиента");
    if (c) { if (await patchRec("clients", c.id, row)) onDone(c.id); return; }
    const [n] = await addRec("clients", [{ ...row, last_contact: today }]);
    if (!n) return;
    // Every client gets a folder in «Клиентские проекты» for notes and meetings.
    const parent = rec.folders.find((f) => !f.parent_id && f.name === "Клиентские проекты");
    if (parent && !rec.folders.some((f) => f.parent_id === parent.id && f.name === row.name)) await addRec("folders", [{ parent_id: parent.id, name: row.name, project: "Клиенты" }]);
    onDone(n.id);
  }
  return (
    <form className="form" onSubmit={save} style={{ padding: "4px 0" }}>
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" placeholder="Клиент" value={d.name} onChange={set("name")} required autoFocus />
        <input className="input" placeholder="Работа, например «Поддержка сайта»" value={d.work} onChange={set("work")} />
      </div>
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" placeholder="Номер договора" value={d.contract_no} onChange={set("contract_no")} style={{ flex: "1 1 130px" }} />
        <select className="input" value={d.contract} onChange={(e) => setD({ ...d, contract: +e.target.value })} aria-label="Статус договора" style={{ flex: "0 1 150px" }}>
          {CST.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </select>
        <label className="lbl" style={{ flex: "0 1 150px" }}>Действует с<input className="input" type="date" value={d.contract_from} onChange={set("contract_from")} /></label>
        <label className="lbl" style={{ flex: "0 1 150px" }}>до<input className="input" type="date" value={d.contract_until} onChange={set("contract_until")} /></label>
      </div>
      <div className="tabs" style={{ margin: 0 }}>
        <button type="button" className={d.monthly ? "on" : ""} onClick={() => setD({ ...d, monthly: true })}>Оплата каждый месяц</button>
        <button type="button" className={!d.monthly ? "on" : ""} onClick={() => setD({ ...d, monthly: false })}>Разовая оплата</button>
      </div>
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" inputMode="decimal" placeholder={d.monthly ? "Сумма в месяц" : "Сумма"} value={d.sum} onChange={set("sum")} style={{ flex: "1 1 120px" }} />
        <CurSelect value={d.cur} onChange={(cur) => setD({ ...d, cur })} />
        {d.monthly
          ? <input className="input" inputMode="numeric" placeholder="Число оплаты" value={d.pay_day} onChange={set("pay_day")} style={{ flex: "0 1 120px" }} />
          : <label className="lbl" style={{ flex: "0 1 160px" }}>Срок оплаты<input className="input" type="date" value={d.due} onChange={set("due")} /></label>}
      </div>
      <input className="input" placeholder="Что жду от клиента (если жду)" value={d.waiting} onChange={set("waiting")} />
      <div className="addbar" style={{ margin: 0 }}>
        <button className="btn pri">Сохранить</button>
        <button className="mini" type="button" onClick={() => onDone(c?.id)}>отмена</button>
      </div>
    </form>
  );
}

function Card({ c, onBack }: { c: Client; onBack: () => void }) {
  const { rec, today, patchRec, removeRec, addRec, toast } = useApp();
  const [edit, setEdit] = useState(false);
  const L = ledger(c, rec.invoices, rec.income, today);
  const invoices = rec.invoices.filter((i) => i.client_id === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const docs = rec.files.filter((f) => f.client_id === c.id && !f.invoice_id);
  const pays = rec.income.filter((i) => i.client_id === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const left = c.contract_until ? diffDays(c.contract_until, today) : null;
  const oneOff = !isMonthly(c) && !invoices.length;

  async function drop() {
    if (confirm(`Удалить клиента «${c.name}»? Его счета-фактуры и файлы удалятся, поступления останутся в финансах`) && (await removeRec("clients", c.id))) onBack();
  }
  /** Marks an invoice paid: the rest of its sum goes to «Финансы» as income on the settlement account. */
  async function pay(i: Invoice) {
    const rest = i.sum - paidOn(i, rec.income);
    if (rest <= 0) return;
    if ((await addRec("income", [{ date: today, source: c.name, note: `счёт-фактура №${i.no}`, sum: rest, client_id: c.id, invoice_id: i.id }])).length) toast("Оплата записана в «Финансы»");
  }
  async function unpay(i: Invoice) {
    const linked = rec.income.filter((x) => x.invoice_id === i.id);
    if (!confirm(`Убрать оплату по счёту №${i.no}? Из «Финансов» уйдёт ${rub(linked.reduce((s, x) => s + x.sum, 0))}`)) return;
    for (const x of linked) await removeRec("income", x.id);
  }
  async function togglePaid() {
    if (!c.paid) {
      if (!(await patchRec("clients", c.id, { paid: true }))) return;
      if (c.sum > 0) { await addRec("income", [{ date: today, source: c.name, note: c.work, sum: c.sum, client_id: c.id }]); toast("Оплата записана в «Финансы»"); }
    } else {
      if (!(await patchRec("clients", c.id, { paid: false }))) return;
      const linked = rec.income.filter((i) => i.client_id === c.id && !i.invoice_id);
      for (const i of linked) await removeRec("income", i.id);
      if (linked.length) toast("Поступление убрано из «Финансов»");
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="crumbs fpath"><button className="mini" onClick={onBack}>Клиенты</button><span>›</span><b>{c.name}</b></div>
          <h1>{c.name}</h1><div className="sub">{c.work || "работа не указана"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setEdit(!edit)}>{edit ? "Закрыть" : "Изменить"}</button>
          <button className="btn" onClick={onBack}>← Все клиенты</button>
        </div>
      </div>

      {edit && <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}><h2>Клиент и договор</h2><ClientForm c={c} onDone={() => setEdit(false)} /></section>}

      <div className="kpis">
        <div className="kpi"><div className="l">Счетов-фактур</div><div className="v">{L.count}</div><div className="n">на {rub(L.invoiced)}</div></div>
        <div className="kpi"><div className="l">Оплачено</div><div className="v" style={{ color: "var(--ok)" }}>{rub(oneOff ? L.paidAll : L.paid)}</div><div className="n">{pays.length} {pays.length % 10 === 1 && pays.length % 100 !== 11 ? "поступление" : [2, 3, 4].includes(pays.length % 10) && ![12, 13, 14].includes(pays.length % 100) ? "поступления" : "поступлений"}</div></div>
        <div className="kpi"><div className="l">Ждём оплату</div><div className="v" style={{ color: L.owed || (oneOff && !c.paid && c.sum) ? "var(--warn)" : undefined }}>{rub(oneOff ? (c.paid ? 0 : c.sum) : L.owed)}</div><div className="n">{oneOff ? (c.due ? "срок " + fd(c.due, today) : "разовая оплата") : "по выставленным счетам"}</div></div>
        <div className="kpi"><div className="l">Ещё предстоит по договору</div><div className="v">{L.ahead === null ? "—" : rub(L.ahead)}</div><div className="n">{L.ahead === null ? "договор без даты окончания" : isMonthly(c) ? "счета, которые ещё выставлять" : "разовая оплата"}</div></div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <h2>Договор</h2>
          <div className="cred" style={{ gridTemplateColumns: "auto 1fr" }}>
            <span className="k">Номер</span><span>{c.contract_no || "—"}</span>
            <span className="k">Статус</span><span><button className={"pill " + CSTc[c.contract]} onClick={() => patchRec("clients", c.id, { contract: (c.contract + 1) % 3 })}>{CST[c.contract]}</button></span>
            <span className="k">Действует</span><span>{c.contract_from ? "с " + dmy(c.contract_from) + " " : ""}{c.contract_until ? "до " + dmy(c.contract_until) : c.contract_from ? "" : "—"}{left !== null && (left < 0 ? " · истёк" : ` · осталось ${left} дн`)}</span>
            <span className="k">Сумма</span><span className="amt">{rub(c.sum)}{isMonthly(c) ? " в месяц" : ""}</span>
            <span className="k">Оплата</span><span>{isMonthly(c) ? `каждый месяц ${c.pay_day} числа${activeNow(c, today) ? ", ближайшая " + fd(payDate(c, today)!, today) : ""}` : c.due ? "до " + dmy(c.due) : "—"}</span>
            {c.waiting && <><span className="k">Жду</span><span>{c.waiting}</span></>}
          </div>
          {oneOff && <div style={{ marginTop: 10 }}><button className={"pill " + (c.paid ? "p-ok" : "p-mute")} onClick={togglePaid}>{c.paid ? "Оплачено" : "Ждём оплату — отметить оплату"}</button></div>}
          <h2 style={{ marginTop: 16 }}>Файлы договора</h2>
          <Files list={docs} />
          {!docs.length && <Empty>Договор ещё не загружен</Empty>}
          <div style={{ marginTop: 8 }}><Upload client_id={c.id} kind="contract" label="Загрузить договор" /></div>
        </section>
        <section className="panel">
          <h2>Оплаты <span className="sub" style={{ marginLeft: "auto", fontWeight: 500, fontSize: 12, marginTop: 0 }}>из «Финансов»</span></h2>
          <div className="list">
            {pays.length ? pays.map((p) => (
              <div className="row" key={p.id}>
                <div className="t"><b>{fd(p.date, today)}</b><span>{p.invoice_id ? `по счёту №${rec.invoices.find((i) => i.id === p.invoice_id)?.no ?? "?"}` : p.note || "без счёта"}{p.account === "card" ? " · на карту" : ""}</span></div>
                <span className="amt" style={{ color: "var(--ok)" }}>+{rub(p.sum)}</span>
              </div>
            )) : <Empty>Поступлений от клиента пока нет</Empty>}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Счета-фактуры · {invoices.length}</h2>
        {invoices.length ? (
          <div className="tbl-wrap"><table style={{ minWidth: 560 }}>
            <thead><tr><th>№</th><th>Дата</th><th className="r">Сумма</th><th className="r">Оплачено</th><th>Статус</th><th>Файл</th><th /></tr></thead>
            <tbody>
              {invoices.map((i) => {
                const st = invoiceState(i, rec.income), p = paidOn(i, rec.income), files = rec.files.filter((f) => f.invoice_id === i.id);
                return (
                  <tr key={i.id}>
                    <td><b>{i.no}</b>{i.note && <div className="sub" style={{ fontSize: 11, marginTop: 0 }}>{i.note}</div>}</td>
                    <td>{dmy(i.date)}</td>
                    <td className="r amt">{rub(i.sum)}</td>
                    <td className="r amt" style={{ color: p ? "var(--ok)" : "var(--muted)" }}>{p ? rub(p) : "—"}</td>
                    <td>{st === "paid" ? <button className={"pill " + IST[st][1]} title="Убрать оплату" onClick={() => unpay(i)}>{IST[st][0]}</button> : <span className={"pill " + IST[st][1]}>{IST[st][0]}</span>}</td>
                    <td><Files list={files} compact />{!files.length && <Upload client_id={c.id} invoice_id={i.id} kind="invoice" label="прикрепить" className="mini" />}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {st !== "paid" && <button className="btn" onClick={() => pay(i)}>Оплачено</button>}
                      <button className="mini" aria-label="Удалить счёт" onClick={() => confirm(`Удалить счёт-фактуру №${i.no}? Оплаты по нему останутся в «Финансах» без привязки`) && removeRec("invoices", i.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : <Empty>Счетов-фактур ещё нет</Empty>}
        <NewInvoice c={c} />
      </section>

      <button className="mini" style={{ color: "var(--bad)" }} onClick={drop}>Удалить клиента</button>
    </>
  );
}

function NewInvoice({ c }: { c: Client }) {
  const { rec, today, settings, addRec, toast } = useApp();
  const mine = rec.invoices.filter((i) => i.client_id === c.id);
  const [no, setNo] = useState("");
  const [date, setDate] = useState(today);
  const [sum, setSum] = useState("");
  const [cur, setCur] = useState<Cur>("uzs");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = no.trim() || nextNo(mine);
    const s = sum.trim() ? toUZS(num(sum), cur, settings.rates).sum : c.sum;
    if (s <= 0) return toast("Впиши сумму счёта");
    if ((await addRec("invoices", [{ client_id: c.id, no: n, date, sum: s }])).length) { setNo(""); setSum(""); toast(`Счёт-фактура №${n} записана, файл можно прикрепить в строке`); }
  }
  return (
    <form className="addbar" onSubmit={add} style={{ margin: "12px 0 0" }}>
      <input className="input" placeholder={`№ ${nextNo(mine)}`} value={no} onChange={(e) => setNo(e.target.value)} style={{ flex: "0 1 110px" }} aria-label="Номер счёта" />
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: "0 1 150px" }} aria-label="Дата счёта" />
      <input className="input" inputMode="decimal" placeholder={c.sum ? rub(c.sum) : "Сумма"} value={sum} onChange={(e) => setSum(e.target.value)} style={{ flex: "1 1 120px" }} aria-label="Сумма счёта" />
      <CurSelect value={cur} onChange={setCur} />
      <button className="btn pri">Выставить счёт</button>
    </form>
  );
}

function Contract() {
  const { rec, settings, today, setSetting, toast } = useApp();
  const tpl = settings.contract_tpl;
  const keys = [...new Set([...tpl.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]))];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [editTpl, setEditTpl] = useState<string | null>(null);
  const [y, m, dd] = today.split("-");
  const auto: Record<string, string> = { дата: `«${+dd}» ${MON[+m - 1]} ${y} г.`, город: "Ташкент" };
  const v = (k: string) => vals[k] ?? auto[k] ?? "";
  const out = tpl.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, k: string) => v(k) || `[${k}]`);

  function fromClient(id: string) {
    const c = rec.clients.find((x) => x.id === id);
    if (!c) return;
    setVals({ ...vals, заказчик: c.name, услуги: c.work, сумма: c.sum ? Math.round(c.sum).toLocaleString("ru-RU") : "" });
  }

  if (editTpl !== null) return (
    <div className="form">
      <div className="sub" style={{ fontSize: 12 }}>Поля для заполнения пиши в двойных фигурных скобках, например {"{{заказчик}}"}. Из них соберётся форма</div>
      <textarea className="input" rows={16} value={editTpl} onChange={(e) => setEditTpl(e.target.value)} />
      <div className="addbar" style={{ margin: 0 }}>
        <button className="btn pri" onClick={async () => { if (await setSetting("contract_tpl", editTpl)) { setEditTpl(null); toast("Шаблон сохранён"); } }}>Сохранить шаблон</button>
        <button className="mini" onClick={() => setEditTpl(null)}>отмена</button>
      </div>
    </div>
  );

  return (
    <div className="grid g2">
      <div className="form" style={{ minWidth: 0 }}>
        {rec.clients.length > 0 && (
          <select className="input" defaultValue="" onChange={(e) => fromClient(e.target.value)} aria-label="Взять данные клиента">
            <option value="" disabled>Взять данные клиента…</option>
            {rec.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {keys.map((k) => (
          <label className="lbl" key={k}>{k.replace(/_/g, " ")}<input className="input" value={v(k)} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>
        ))}
        <div className="addbar" style={{ margin: 0 }}>
          <button className="btn pri" onClick={() => copy(out, toast)}>Копировать договор</button>
          <button className="mini" onClick={() => setEditTpl(tpl)}>изменить шаблон</button>
        </div>
      </div>
      <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>Готовый договор</b><div className="draft" style={{ marginTop: 8, maxHeight: 420, overflow: "auto" }}>{out}</div></div>
    </div>
  );
}
