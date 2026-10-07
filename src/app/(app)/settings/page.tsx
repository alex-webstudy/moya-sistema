"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/store";
import { copy } from "@/components/ui";
import type { Settings } from "@/lib/records";

const THEMES: [Settings["theme"], string][] = [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]];
const REMINDERS: [string, string, string][] = [
  ["План на день", "Дела, тренировка, списания на сегодня и завтра, кому выставить счёт и написать", "11:00"],
  ["Вечерний разбор", "Повтор каждые 30 мин до 22:30, пока не заполнишь", "21:00"],
  ["Итоги недели", "Итоги, 3 главных дела и замеры", "Вс 20:00"],
  ["Дела со временем", "За 15 минут до начала", "по задаче"],
  ["Отчёт и взносы ИП", "Внутри плана на день 9-го и 10-го", "10 числа"],
  ["Финансовый разбор месяца", "Внутри плана на день 1-го числа", "1 числа"],
];

const DAYS: [number, string][] = [[1, "Пн"], [2, "Вт"], [3, "Ср"], [4, "Чт"], [5, "Пт"], [6, "Сб"], [0, "Вс"]];

function TrainingForm() {
  const { settings, setSetting, toast } = useApp();
  const [t, setT] = useState(settings.training);
  const [norm, setNorm] = useState(String(settings.kcal_norm));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!t.start || !t.end || t.end <= t.start) return toast("Конец тренировки должен быть позже начала");
    const n = Math.round(Number(norm));
    if (!(n >= 800 && n <= 6000)) return toast("Норма калорий от 800 до 6000");
    if ((await setSetting("training", t)) && (n === settings.kcal_norm || (await setSetting("kcal_norm", n)))) toast("Сохранено");
  }
  return (
    <form onSubmit={save} className="form">
      <div className="tabs" style={{ margin: 0 }}>
        {DAYS.map(([d, n]) => (
          <button type="button" key={d} className={t.days.includes(d) ? "on" : ""} onClick={() => setT({ ...t, days: t.days.includes(d) ? t.days.filter((x) => x !== d) : [...t.days, d] })}>{n}</button>
        ))}
      </div>
      <div className="addbar" style={{ margin: 0, alignItems: "flex-end" }}>
        <label className="lbl" style={{ flex: "0 1 120px" }}>Начало<input className="input" type="time" value={t.start} onChange={(e) => setT({ ...t, start: e.target.value })} /></label>
        <label className="lbl" style={{ flex: "0 1 120px" }}>Конец<input className="input" type="time" value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} /></label>
        <label className="lbl" style={{ flex: "0 1 140px" }}>Норма, ккал<input className="input" inputMode="numeric" value={norm} onChange={(e) => setNorm(e.target.value)} /></label>
        <button className="btn pri">Сохранить</button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { settings, setSetting, toast, ai } = useApp();
  const [usd, setUsd] = useState(String(settings.rates.usd));
  const [rub, setRub] = useState(String(settings.rates.rub));

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    const r = { usd: Number(usd.replace(",", ".")), rub: Number(rub.replace(",", ".")) };
    if (!(r.usd > 0 && r.rub > 0)) return toast("Курс должен быть больше нуля");
    if (await setSetting("rates", r)) toast("Курс сохранён");
  }
  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    // Full reload on purpose: drop all in-memory state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/login";
  }

  return (
    <>
      <div className="head"><div><h1>Настройки</h1></div></div>
      <div className="grid g2">
        <section className="panel">
          <h2>Claude {ai ? <span className="pill p-ok">подключён</span> : <span className="pill p-mute">не подключён</span>}</h2>
          <div className="sub">{ai
            ? "Кнопки со значком ✦ отвечают прямо в приложении: ответ сам встаёт в нужное поле, остаётся проверить и сохранить."
            : "Сейчас кнопки «… в Claude ↗» открывают чат Claude, а ответ нужно вставить обратно. Чтобы Claude отвечал прямо здесь, добавь ключ ANTHROPIC_API_KEY в Vercel: Settings → Environment Variables, затем Redeploy."}</div>
        </section>
        <section className="panel">
          <h2>Тема</h2>
          <div className="tabs" style={{ margin: 0 }}>
            {THEMES.map(([k, n]) => <button key={k} className={settings.theme === k ? "on" : ""} style={{ padding: "6px 16px" }} onClick={() => setSetting("theme", k)}>{n}</button>)}
          </div>
          <div className="sub" style={{ marginTop: 10 }}>Авто: светлая с 7:00 до 19:00, тёмная вечером и ночью</div>
        </section>
        <section className="panel">
          <h2>Валюта</h2>
          <div className="sub" style={{ marginBottom: 8 }}>Все суммы в сумах. Если вводишь в $ или ₽, перевожу по этому курсу</div>
          <form className="addbar" style={{ margin: 0, alignItems: "center" }} onSubmit={saveRates}>
            <span>1 $ =</span><input className="input mono-in" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 110 }} aria-label="Курс доллара" /><span>сум</span>
            <span style={{ marginLeft: 8 }}>1 ₽ =</span><input className="input mono-in" inputMode="decimal" value={rub} onChange={(e) => setRub(e.target.value)} aria-label="Курс рубля" /><span>сум</span>
            <button className="btn pri">Сохранить</button>
          </form>
        </section>
        <section className="panel">
          <h2>Тренировки и питание</h2>
          <div className="sub" style={{ marginBottom: 8 }}>Дни и время тренировок видны в календаре, на главной и в вечернем разборе</div>
          <TrainingForm />
        </section>
        <section className="panel">
          <h2>Telegram-бот {settings.telegram ? <span className="pill p-ok">подключён</span> : <span className="pill p-mute">не подключён</span>}</h2>
          <TgBot />
        </section>
        <section className="panel">
          <h2>Напоминания</h2>
          <Push />
          <div className="list" style={{ marginTop: 12 }}>
            {REMINDERS.map(([n, d, t]) => (
              <div className="row" key={n}><div className="t"><b>{n}</b><span>{d}</span></div><span className="amt">{t}</span></div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Вход</h2>
          <div className="sub" style={{ marginBottom: 10 }}>Вход по паролю, сессия хранится на этом устройстве</div>
          <button className="btn" onClick={logout}>Выйти</button>
        </section>
      </div>
    </>
  );
}

const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

function deviceName() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Браузер";
}

/** Turns push on for this device and shows the one-time schedule SQL. */
function Push() {
  const { toast } = useApp();
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [info, setInfo] = useState<{ publicKey: string; cronSql: string; devices: { endpoint: string; device: string }[] } | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sql, setSql] = useState(false);

  useEffect(() => {
    fetch("/api/push/setup").then((r) => (r.ok ? r.json() : null)).then(setInfo, () => {});
    if (supported) navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => setMine(s?.endpoint ?? null), () => {});
  }, [supported]);

  async function on() {
    if (!info) return;
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return toast("Уведомления запрещены: разреши их в настройках браузера");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64(info.publicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...sub.toJSON(), device: deviceName() }) });
      if (!res.ok) return toast(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Не получилось включить");
      setMine(sub.endpoint);
      setInfo({ ...info, devices: [...info.devices.filter((d) => d.endpoint !== sub.endpoint), { endpoint: sub.endpoint, device: deviceName() }] });
      toast("Напоминания включены на этом устройстве");
    } catch {
      toast("Не получилось включить уведомления");
    } finally {
      setBusy(false);
    }
  }
  async function off() {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    if (info) setInfo({ ...info, devices: info.devices.filter((d) => d.endpoint !== mine) });
    setMine(null);
    toast("Напоминания на этом устройстве выключены");
  }
  async function test() {
    const r = await fetch("/api/push/test", { method: "POST" });
    toast(r.ok ? "Отправил, сейчас придёт" : (((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Не получилось"));
  }

  const n = info?.devices.length ?? 0;
  return (
    <>
      {!supported ? (
        <div className="sub">На iPhone уведомления работают, только если приложение добавлено на экран «Домой»: в Safari нажми «Поделиться» → «На экран „Домой“» и открой «Моя система» оттуда.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {mine ? <button className="btn" onClick={off}>Выключить на этом устройстве</button>
            : <button className="btn pri" disabled={busy || !info} onClick={on}>{busy ? "Включаю…" : "Включить на этом устройстве"}</button>}
          {n > 0 && <button className="btn" onClick={test}>Прислать пробное</button>}
          <span className="sub" style={{ fontSize: 12 }}>{n ? "Включено: " + info!.devices.map((d) => d.device || "устройство").join(", ") : "Пока ни на одном устройстве"}</span>
        </div>
      )}
      {info && (
        <div style={{ marginTop: 12 }}>
          <button className="mini" onClick={() => setSql(!sql)}>{sql ? "▴" : "▾"} Расписание: один раз запустить в Supabase</button>
          {sql && (
            <>
              <div className="sub" style={{ fontSize: 12, margin: "6px 0" }}>Без этого напоминания не придут. Скопируй и запусти в Supabase → SQL Editor. В запросе ключ доступа к напоминаниям: никому его не пересылай.</div>
              <pre className="input" style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 180, overflow: "auto" }}>{info.cronSql}</pre>
              <button className="btn" onClick={() => copy(info.cronSql, toast)}>Копировать</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Connects the owner's Telegram bot: the token goes to Vercel, the link binds this chat. */
function TgBot() {
  const { settings, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    try {
      const r = await fetch("/api/telegram", { method: "POST" });
      const out = (await r.json().catch(() => ({}))) as { link?: string; error?: string };
      if (!r.ok || !out.link) return toast(out.error ?? "Не получилось подключить");
      setLink(out.link);
      window.open(out.link, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sub" style={{ marginBottom: 10 }}>{settings.telegram
        ? `Бот пишет в чат ${settings.telegram.name || ""}. Отправляй ему мысли, дела и скриншоты: Claude разложит их по разделам. Напоминания тоже приходят туда.`
        : "1) В Telegram у @BotFather создай бота (/newbot) и скопируй токен. 2) Добавь его в Vercel как TELEGRAM_BOT_TOKEN и сделай Redeploy. 3) Нажми «Подключить» и в открывшемся Telegram нажми «Старт»."}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className={settings.telegram ? "btn" : "btn pri"} disabled={busy} onClick={connect}>{busy ? "Подключаю…" : settings.telegram ? "Подключить заново" : "Подключить"}</button>
        {link && <a className="mini" href={link} target="_blank" rel="noopener">открыть бота ↗</a>}
      </div>
    </>
  );
}
