"use client";
import { useState } from "react";
import { useApp } from "@/components/store";
import type { Settings } from "@/lib/records";

const THEMES: [Settings["theme"], string][] = [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]];
const REMINDERS: [string, string, string][] = [
  ["Утренний бриф", "План дня, встречи, тренировка, списания", "11:00"],
  ["Вечерний разбор", "Повтор каждые 30 мин, пока не заполнишь", "21:00"],
  ["Итоги недели и план", "Воскресенье, плюс замеры", "Вс 20:00"],
  ["Списания по кредитам и подпискам", "За день до списания", "11:00"],
  ["Отчёт и взносы ИП", "9-го вечером и 10-го утром", "10 числа"],
  ["Финансовый разбор месяца", "Как поднять доход или срезать расходы", "1 числа"],
  ["Пора написать клиенту", "Жду ответа или тишина 5+ дней", "11:00"],
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
          <h2>Напоминания</h2>
          <div className="list">
            {REMINDERS.map(([n, d, t]) => (
              <div className="row" key={n}><div className="t"><b>{n}</b><span>{d}</span></div><span className="amt">{t}</span></div>
            ))}
          </div>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Начнут приходить, когда подключим Telegram-бот</div>
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
