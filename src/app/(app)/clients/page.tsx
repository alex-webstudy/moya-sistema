"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import { ClaudeBtn, copy, CurSelect, Empty, Fold } from "@/components/ui";
import { diffDays, fd, MON } from "@/lib/dates";
import { rub, toUZS, type Cur } from "@/lib/money";
import { followPrompt } from "@/lib/prompts";
import type { Client } from "@/lib/records";

const FOLLOW_DAYS = 5;
const CST = ["Не отправлен", "Отправлен", "Подписан"];
const CSTc = ["p-bad", "p-warn", "p-ok"];

type Draft = { name: string; work: string; sum: string; cur: Cur; due: string; waiting: string };
const blank: Draft = { name: "", work: "", sum: "", cur: "uzs", due: "", waiting: "" };

export default function Clients() {
  const { rec, settings, today, addRec, patchRec, removeRec, toast } = useApp();
  const [edit, setEdit] = useState<string | "new" | null>(null);
  const [d, setD] = useState<Draft>(blank);
  const clients = rec.clients;

  const needFollow = (c: Client) => !c.paid && (!!c.waiting || diffDays(c.last_contact, today) <= -FOLLOW_DAYS);
  const awaiting = clients.filter((c) => !c.paid);
  const late = awaiting.filter((c) => c.due && c.due < today && c.contract === 2);
  const follow = clients.filter(needFollow).sort((a, b) => a.last_contact.localeCompare(b.last_contact));
  const notSent = clients.filter((c) => c.contract === 0).length;
  const sum = (a: Client[]) => a.reduce((s, c) => s + c.sum, 0);

  function open(c?: Client) {
    setEdit(c ? c.id : "new");
    setD(c ? { name: c.name, work: c.work, sum: c.sum ? String(c.sum) : "", cur: "uzs", due: c.due ?? "", waiting: c.waiting } : blank);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(d.sum.replace(/\s/g, "").replace(",", ".")) || 0;
    const row = { name: d.name.trim(), work: d.work.trim(), sum: toUZS(n, d.cur, settings.rates).sum, due: d.due || null, waiting: d.waiting.trim() };
    if (!row.name) return toast("Напиши имя клиента");
    const ok = edit === "new" ? (await addRec("clients", [{ ...row, last_contact: today }])).length > 0 : await patchRec("clients", edit!, row);
    if (ok) setEdit(null);
  }
  async function drop(c: Client) {
    if (confirm(`Удалить клиента «${c.name}»? Поступления от него останутся в финансах`) && (await removeRec("clients", c.id))) setEdit(null);
  }
  async function togglePaid(c: Client) {
    if (!c.paid) {
      if (!(await patchRec("clients", c.id, { paid: true }))) return;
      if (c.sum > 0) {
        await addRec("income", [{ date: today, source: c.name, note: c.work, sum: c.sum, client_id: c.id }]);
        toast("Оплата записана в поступления");
      }
    } else {
      if (!(await patchRec("clients", c.id, { paid: false }))) return;
      const linked = rec.income.filter((i) => i.client_id === c.id);
      for (const i of linked) await removeRec("income", i.id);
      if (linked.length) toast("Поступление убрано из финансов");
    }
  }

  const form = (
    <form className="form" onSubmit={save} style={{ padding: "8px 0" }}>
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" placeholder="Клиент" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required autoFocus />
        <input className="input" placeholder="Работа, например «Лендинг»" value={d.work} onChange={(e) => setD({ ...d, work: e.target.value })} />
      </div>
      <div className="addbar" style={{ margin: 0 }}>
        <input className="input" inputMode="decimal" placeholder="Сумма" value={d.sum} onChange={(e) => setD({ ...d, sum: e.target.value })} style={{ flex: "1 1 120px" }} />
        <CurSelect value={d.cur} onChange={(cur) => setD({ ...d, cur })} />
        <label className="lbl" style={{ flex: "0 1 160px" }}>Срок оплаты<input className="input" type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></label>
        <input className="input" placeholder="Что жду от клиента (если жду)" value={d.waiting} onChange={(e) => setD({ ...d, waiting: e.target.value })} />
      </div>
      <div className="addbar" style={{ margin: 0 }}>
        <button className="btn pri">Сохранить</button>
        <button className="mini" type="button" onClick={() => setEdit(null)}>отмена</button>
        {edit !== "new" && <button className="mini" type="button" style={{ marginLeft: "auto" }} onClick={() => drop(clients.find((c) => c.id === edit)!)}>удалить клиента</button>}
      </div>
    </form>
  );

  return (
    <>
      <div className="head">
        <div><h1>Клиенты и документы</h1><div className="sub">Договоры, оплаты и кому пора написать</div></div>
        <button className="btn pri" onClick={() => open()}>+ Клиент</button>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Ожидаю всего</div><div className="v">{rub(sum(awaiting))}</div><div className="n">{awaiting.length} не оплатили</div></div>
        <div className="kpi"><div className="l">Просрочено</div><div className="v" style={{ color: late.length ? "var(--bad)" : undefined }}>{rub(sum(late))}</div><div className="n">{late.length} по подписанным</div></div>
        <div className="kpi"><div className="l">Пора написать</div><div className="v" style={{ color: follow.length ? "var(--warn)" : undefined }}>{follow.length}</div><div className="n">жду ответа или тишина {FOLLOW_DAYS}+ дней</div></div>
        <div className="kpi"><div className="l">Договор не отправлен</div><div className="v">{notSent}</div></div>
      </div>

      {edit === "new" && <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}><h2>Новый клиент</h2>{form}</section>}

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
            <thead><tr><th>Клиент</th><th>Работа</th><th>Договор</th><th className="r">Сумма</th><th>Срок оплаты</th><th>Оплата</th><th>Контакт</th></tr></thead>
            <tbody>
              {clients.map((c) => {
                const dd = c.due ? diffDays(c.due, today) : 0;
                return edit === c.id ? (
                  <tr key={c.id}><td colSpan={7}>{form}</td></tr>
                ) : (
                  <tr key={c.id}>
                    <td><button className="mini" style={{ color: "var(--fg)", fontWeight: 600, fontSize: 13, padding: 0, textAlign: "left" }} title="Изменить" onClick={() => open(c)}>{c.name}</button></td>
                    <td style={{ color: "var(--muted)" }}>{c.work}</td>
                    <td><button className={"pill " + CSTc[c.contract]} title="Нажми, чтобы сменить статус" onClick={() => patchRec("clients", c.id, { contract: (c.contract + 1) % 3 })}>{CST[c.contract]}</button></td>
                    <td className="r amt">{rub(c.sum)}</td>
                    <td>{c.due ? fd(c.due, today) : "—"}{!c.paid && c.due && dd < 0 && <> <span className="pill p-bad">+{-dd} дн</span></>}</td>
                    <td><button className={"pill " + (c.paid ? "p-ok" : "p-mute")} onClick={() => togglePaid(c)}>{c.paid ? "Оплачено" : "Ждём"}</button></td>
                    <td style={{ color: "var(--muted)" }}>{fd(c.last_contact, today)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : <Empty>Клиентов пока нет. Добавь первого кнопкой «+ Клиент»</Empty>}
        <div className="sub" style={{ fontSize: 12, marginTop: 10 }}>Статусы меняются по клику, имя открывает редактирование. Оплата, отмеченная здесь, сама попадает в поступления</div>
      </section>

      <Fold title="Договор по шаблону" sub="заполнить договор для клиента"><Contract /></Fold>
    </>
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
