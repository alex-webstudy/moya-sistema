"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import { useApp } from "@/components/store";
import { copy, Empty, Fold } from "@/components/ui";
import { createMeta, genPassword, open, seal, unlock, type Entry } from "@/lib/vault";

// Everything is decrypted only in this page's memory. Leaving the page or 5 minutes without activity locks the vault.
const IDLE_MS = 5 * 60_000;
const CATS = ["Сайты и Tilda", "Хостинг и домены", "Соцсети", "Почта", "Банки", "Клиенты", "Сервисы", "Другое"];
type Item = Entry & { id: string };
const plural = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "запись" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "записи" : "записей"}`;
const blank: Entry = { cat: CATS[0], name: "", login: "", pass: "", url: "", note: "" };

export default function Vault() {
  const { settings } = useApp();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const lock = useCallback(() => setKey(null), []);
  if (!settings.vault_meta) return <Setup onReady={setKey} />;
  return key ? <Opened k={key} onLock={lock} onRekey={setKey} /> : <Locked onOpen={setKey} />;
}

function Head({ sub, children }: { sub: string; children?: React.ReactNode }) {
  return <div className="head"><div><h1>Пароли</h1><div className="sub">{sub}</div></div>{children}</div>;
}

function Setup({ onReady }: { onReady: (k: CryptoKey) => void }) {
  const { setSetting, toast } = useApp();
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (a.length < 8) return toast("Мастер-пароль не короче 8 символов");
    if (a !== b) return toast("Пароли не совпадают");
    setBusy(true);
    const { meta, key } = await createMeta(a);
    if (await setSetting("vault_meta", meta)) { onReady(key); toast("Сейф создан"); }
    setBusy(false);
  }
  return (
    <>
      <Head sub="Отдельный сейф для логинов и доступов, со своей защитой" />
      <section className="panel" style={{ maxWidth: 480 }}>
        <form className="form" onSubmit={create}>
          <span style={{ color: "var(--accent)" }}>{Icons.vault}</span>
          <b>Придумай мастер-пароль для сейфа</b>
          <div className="sub">Он отличается от пароля входа в приложение. Все записи шифруются на твоём устройстве этим паролем, на сервер уходит только шифр: прочитать его не сможет ни сервер, ни Claude.</div>
          <div className="sub" style={{ color: "var(--warn)" }}>Если забыть мастер-пароль, восстановить записи нельзя. Запиши его на бумаге и храни дома.</div>
          <input className="input" type="password" autoComplete="new-password" placeholder="Мастер-пароль, от 8 символов" value={a} onChange={(e) => setA(e.target.value)} />
          <input className="input" type="password" autoComplete="new-password" placeholder="Повтори мастер-пароль" value={b} onChange={(e) => setB(e.target.value)} />
          <button className="btn pri" disabled={busy}>{busy ? "Создаю…" : "Создать сейф"}</button>
        </form>
      </section>
    </>
  );
}

function Locked({ onOpen }: { onOpen: (k: CryptoKey) => void }) {
  const { settings, toast } = useApp();
  const [p, setP] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const k = await unlock(p, settings.vault_meta!);
    setBusy(false);
    if (k) onOpen(k);
    else { setP(""); toast("Неверный мастер-пароль"); }
  }
  return (
    <>
      <Head sub="Все логины и доступы в одном сейфе, отдельно от проектов" />
      <section className="panel" style={{ maxWidth: 440 }}>
        <form className="form" onSubmit={go}>
          <span style={{ color: "var(--accent)" }}>{Icons.vault}</span>
          <b>Сейф закрыт</b>
          <div className="sub">Данные зашифрованы мастер-паролем. Без него их не прочитает даже сервер.</div>
          <input className="input" type="password" autoComplete="current-password" placeholder="Мастер-пароль" value={p} onChange={(e) => setP(e.target.value)} autoFocus />
          <button className="btn pri" disabled={busy || !p}>{busy ? "Открываю…" : "Открыть сейф"}</button>
        </form>
      </section>
    </>
  );
}

function Opened({ k, onLock, onRekey }: { k: CryptoKey; onLock: () => void; onRekey: (k: CryptoKey) => void }) {
  const { rec, addRec, patchRec, removeRec, setSetting, toast } = useApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [broken, setBroken] = useState(0);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Decrypt whatever the store holds; re-runs when rows are added or changed.
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Item[] = [];
      let bad = 0;
      for (const r of rec.vault) {
        try { out.push({ ...blank, ...(await open<Entry>(k, r)), id: r.id }); } catch { bad++; }
      }
      if (live) { setItems(out); setBroken(bad); }
    })();
    return () => { live = false; };
  }, [rec.vault, k]);

  // Auto-lock after inactivity.
  useEffect(() => {
    const poke = () => { clearTimeout(timer.current); timer.current = setTimeout(onLock, IDLE_MS); };
    poke();
    const ev = ["pointerdown", "keydown", "scroll"] as const;
    ev.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    return () => { clearTimeout(timer.current); ev.forEach((e) => window.removeEventListener(e, poke)); };
  }, [onLock]);

  async function save(e: Entry, id?: string) {
    const box = await seal(k, e);
    const ok = id ? await patchRec("vault", id, box) : (await addRec("vault", [box])).length > 0;
    if (ok) { setEdit(null); toast("Сохранено"); }
  }
  async function rekey(next: string) {
    if (!items) return;
    const { meta, key } = await createMeta(next);
    const old = new Map(rec.vault.map((r) => [r.id, { data: r.data, iv: r.iv }]));
    const done: string[] = [];
    for (const it of items) {
      const { id, ...e } = it;
      if (!(await patchRec("vault", id, await seal(key, e)))) {
        // Put back what was already re-encrypted so every row stays under the old password.
        for (const d of done) await patchRec("vault", d, old.get(d)!);
        return toast("Не получилось сменить пароль, всё осталось как было");
      }
      done.push(id);
    }
    if (await setSetting("vault_meta", meta)) { onRekey(key); toast("Мастер-пароль сменён"); }
  }

  const list = (items ?? []).filter((v) => !q || (v.name + v.login + v.cat + v.url + v.note).toLowerCase().includes(q.toLowerCase()));
  const cats = [...new Set(list.map((v) => v.cat))].sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b));
  return (
    <>
      <Head sub={`${items ? plural(items.length) : "…"} · сейф закроется сам через 5 минут без действий`}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn pri" onClick={() => setEdit("new")}>Добавить</button>
          <button className="btn" onClick={onLock}>Закрыть сейф</button>
        </div>
      </Head>
      {broken > 0 && <div className="vault">Не удалось расшифровать записей: {broken}</div>}
      <input className="input" placeholder="Поиск: tilda, хостинг, банк" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", maxWidth: 420, marginBottom: 16 }} />
      {items === null ? <Empty>Расшифровываю…</Empty> : cats.length ? (
        <div className="grid g2">
          {cats.map((c) => (
            <section className="panel" key={c}>
              <h2>{c}</h2>
              {list.filter((v) => v.cat === c).map((v) => (
                <div className="item" key={v.id}>
                  <div className="body">
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <b style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{v.name}</b>
                      <button className="mini" onClick={() => setEdit(v)}>изменить</button>
                    </div>
                    <div className="cred">
                      {v.login && <><span className="k">Логин</span><span className="val">{v.login}</span><span><button className="mini" onClick={() => copy(v.login, toast)}>копировать</button></span></>}
                      {v.pass && <><span className="k">Пароль</span><span className="val">{shown[v.id] ? v.pass : "•••••••••••"}</span>
                        <span><button className="mini" onClick={() => setShown({ ...shown, [v.id]: !shown[v.id] })}>{shown[v.id] ? "скрыть" : "показать"}</button><button className="mini" onClick={() => copy(v.pass, toast)}>копировать</button></span></>}
                      {v.url && <><span className="k">Адрес</span><span className="val">{/^https?:\/\//i.test(v.url) ? <a href={v.url} target="_blank" rel="noreferrer noopener" style={{ color: "inherit" }}>{v.url}</a> : v.url}</span><span /></>}
                      {v.note && <><span className="k">Заметка</span><span className="val" style={{ fontFamily: "var(--body)" }}>{v.note}</span><span /></>}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : <section className="panel"><Empty>{q ? "Ничего не нашлось" : "Сейф пуст. Нажми «Добавить» и впиши первый доступ"}</Empty></section>}
      <div style={{ marginTop: 16 }}><Fold title="Сменить мастер-пароль"><Rekey onDo={rekey} /></Fold></div>
      {edit && <Editor init={edit === "new" ? null : edit} onSave={save} onDelete={async (id) => { if (confirm("Удалить запись?") && (await removeRec("vault", id))) setEdit(null); }} onClose={() => setEdit(null)} />}
    </>
  );
}

function Editor({ init, onSave, onDelete, onClose }: { init: Item | null; onSave: (e: Entry, id?: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const { toast } = useApp();
  const [e, setE] = useState<Entry>(init ? { cat: init.cat, name: init.name, login: init.login, pass: init.pass, url: init.url, note: init.note } : blank);
  const [show, setShow] = useState(!init);
  const set = (k: keyof Entry) => (x: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setE({ ...e, [k]: x.target.value.slice(0, k === "note" ? 2000 : 500) });
  return (
    <div className="sheet-bg" onClick={onClose}>
      <form className="sheet" onClick={(x) => x.stopPropagation()} onSubmit={(x) => { x.preventDefault(); if (!e.name.trim()) return toast("Напиши, что это за доступ"); onSave({ ...e, name: e.name.trim() }, init?.id); }}>
        <b>{init ? "Изменить запись" : "Новая запись"}</b>
        <input className="input" placeholder="Что это, например «Tilda, аккаунт студии»" value={e.name} onChange={set("name")} autoFocus />
        <select className="input" value={CATS.includes(e.cat) ? e.cat : "Другое"} onChange={set("cat")} aria-label="Раздел">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input" placeholder="Логин, почта или телефон" value={e.login} onChange={set("login")} autoComplete="off" />
        <div className="addbar" style={{ margin: 0 }}>
          <input className="input" type={show ? "text" : "password"} placeholder="Пароль" value={e.pass} onChange={set("pass")} autoComplete="off" style={{ fontFamily: "var(--mono)" }} />
          <button type="button" className="btn" onClick={() => setShow(!show)}>{show ? "Скрыть" : "Показать"}</button>
          <button type="button" className="btn" onClick={() => { setE({ ...e, pass: genPassword() }); setShow(true); }}>Сгенерировать</button>
        </div>
        <input className="input" placeholder="Адрес входа (необязательно)" value={e.url} onChange={set("url")} />
        <textarea className="input" placeholder="Заметка: 2FA, кодовое слово, у кого ещё доступ" value={e.note} onChange={set("note")} />
        <div className="acts">
          <button className="btn pri">Сохранить</button>
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          {init && <button type="button" className="mini" style={{ marginLeft: "auto", color: "var(--bad)" }} onClick={() => onDelete(init.id)}>Удалить</button>}
        </div>
      </form>
    </div>
  );
}

function Rekey({ onDo }: { onDo: (p: string) => Promise<unknown> }) {
  const { toast } = useApp();
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      if (a.length < 8) return toast("Мастер-пароль не короче 8 символов");
      if (a !== b) return toast("Пароли не совпадают");
      setBusy(true); await onDo(a); setBusy(false); setA(""); setB("");
    }}>
      <div className="sub">Все записи перешифруются новым паролем. Старый перестанет работать.</div>
      <input className="input" type="password" autoComplete="new-password" placeholder="Новый мастер-пароль" value={a} onChange={(e) => setA(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" placeholder="Повтори новый" value={b} onChange={(e) => setB(e.target.value)} />
      <button className="btn" style={{ alignSelf: "flex-start" }} disabled={busy}>{busy ? "Перешифровываю…" : "Сменить"}</button>
    </form>
  );
}
