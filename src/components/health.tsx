"use client";
import { useState } from "react";
import { FOOD_PROMPT, parseFood, WATER_GOAL } from "@/lib/health";
import type { Day } from "@/lib/records";
import { weekday } from "@/lib/dates";
import { useApp } from "./store";
import { ClaudeBtn } from "./ui";

/** Whether `date` is a training day by the schedule in Settings. */
export function useTraining() {
  const { settings } = useApp();
  const t = settings.training;
  return { ...t, on: (date: string) => t.days.includes(weekday(date)) };
}
const fmtL = (x: number) => (Math.round(x * 100) / 100).toLocaleString("ru-RU");

/** Today's (or any date's) health row; empty defaults until the first write. */
export function useDay(date: string) {
  const { rec, patchDay } = useApp();
  const day: Pick<Day, "workout" | "workout_note" | "water" | "food_ok" | "food" | "ev_tasks" | "ev_tomorrow"> =
    rec.days.find((d) => d.date === date) ?? { workout: null, workout_note: "", water: 0, food_ok: null, food: [], ev_tasks: false, ev_tomorrow: false };
  return { day, set: (patch: Partial<Day>) => patchDay(date, patch) };
}

export function Workout({ date }: { date: string }) {
  const { day, set } = useDay(date);
  const [note, setNote] = useState<string | null>(null);
  const train = useTraining().on(date);
  return (
    <>
      <div className="yn">
        <button className={"y" + (day.workout === true ? " on" : "")} onClick={() => set({ workout: day.workout === true ? null : true })}>{train ? "Да, был" : "Всё равно тренировался"}</button>
        {train && <button className={"n" + (day.workout === false ? " on" : "")} onClick={() => set({ workout: day.workout === false ? null : false })}>Пропустил</button>}
      </div>
      {day.workout && (
        <textarea className="input" rows={2} placeholder="Что делали с тренером: упражнения, подходы, веса" value={note ?? day.workout_note}
          onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== null && note !== day.workout_note) set({ workout_note: note }); setNote(null); }} />
      )}
    </>
  );
}

export function Water({ date }: { date: string }) {
  const { day, set } = useDay(date);
  const add = (x: number) => set({ water: Math.max(0, Math.round((day.water + x) * 100) / 100) });
  return (
    <>
      <div className="water">
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={day.water >= (i + 1) * 0.25 ? "on" : ""} />)}
        <span className="sub" style={{ fontSize: 12 }}>{fmtL(day.water)} из {fmtL(WATER_GOAL)} л</span>
      </div>
      <div className="yn">
        <button onClick={() => add(0.25)}>+ стакан 250 мл</button>
        <button onClick={() => add(0.5)}>+ бутылка 0,5</button>
        <button onClick={() => add(-0.25)} aria-label="Убрать 250 мл">−</button>
      </div>
    </>
  );
}

export function KcalBar({ eaten, norm }: { eaten: number; norm: number }) {
  const over = eaten > norm;
  return (
    <div className="kbar">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
        <b>{eaten} из {norm} ккал</b>
        <span style={{ color: over ? "var(--bad)" : eaten >= norm * 0.9 ? "var(--ok)" : "var(--muted)" }}>{over ? `перебор ${eaten - norm} ккал` : eaten >= norm * 0.9 ? "норма набрана" : `осталось ${norm - eaten} ккал`}</span>
      </div>
      <div className="bar" style={{ marginTop: 6 }}><i style={{ width: Math.min(100, (eaten / norm) * 100) + "%", background: over ? "var(--bad)" : "var(--ok)" }} /></div>
    </div>
  );
}

export function FoodLog({ date }: { date: string }) {
  const { settings, toast } = useApp();
  const { day, set } = useDay(date);
  const [ate, setAte] = useState("");
  const [answer, setAnswer] = useState("");
  const kcal = day.food.reduce((s, x) => s + x.kcal, 0), protein = day.food.reduce((s, x) => s + x.protein, 0);

  async function addAnswer() {
    const items = parseFood(answer);
    if (!items.length) return toast("Не нашёл строк «блюдо | ккал | белок»");
    if (await set({ food: [...day.food, ...items] })) { setAnswer(""); setAte(""); toast("Добавлено блюд: " + items.length); }
  }
  return (
    <>
      <textarea className="input" rows={2} placeholder="Что ел: «на завтрак омлет из 3 яиц и кофе, в обед плов, вечером куриная грудка с салатом»" value={ate} onChange={(e) => setAte(e.target.value)} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ClaudeBtn label="Посчитать калории в Claude ↗" prompt={() => FOOD_PROMPT + ate.trim()} hint="Скопируй ответ Claude и вставь ниже" onAnswer={setAnswer} />
        <span className="sub" style={{ fontSize: 12 }}>или просто отметь:</span>
        <div className="yn">
          <button className={"y" + (day.food_ok === true ? " on" : "")} onClick={() => set({ food_ok: day.food_ok === true ? null : true })}>Правильно</button>
          <button className={"n" + (day.food_ok === false ? " on" : "")} onClick={() => set({ food_ok: day.food_ok === false ? null : false })}>Неправильно</button>
        </div>
      </div>
      <div className="addbar" style={{ margin: 0 }}>
        <textarea className="input" rows={1} style={{ minHeight: 40 }} placeholder="Ответ Claude: «Плов | 650 | 22»" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button className="btn" onClick={addAnswer}>Добавить</button>
      </div>
      <KcalBar eaten={kcal} norm={settings.kcal_norm} />
      {day.food.length > 0 && (
        <div className="draft">
          <b>≈ {kcal} ккал · белок {protein} г</b>
          {day.food.map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>{x.name}</span>
              <span className="amt">{x.kcal} ккал · {x.protein} г <button className="mini" aria-label="Убрать" onClick={() => set({ food: day.food.filter((_, j) => j !== i) })}>✕</button></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
